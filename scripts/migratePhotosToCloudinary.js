/**
 * Migration script: Refresh expired Google Places photo_references,
 * upload first photo to Cloudinary, and update Firestore.
 *
 * Usage:
 *   1. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET to functions/.env
 *   2. node scripts/migratePhotosToCloudinary.js [--dry-run]
 */

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../functions/.env") });

const admin = require("../functions/node_modules/firebase-admin");
const axios = require("../functions/node_modules/axios");
const { v2: cloudinary } = require("../functions/node_modules/cloudinary");

// --- Config checks ---
const PLACES_KEY = process.env.GOOGLE_PLACES_API_KEY;
const CLOUDINARY_CLOUD = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_SECRET = process.env.CLOUDINARY_API_SECRET;

const DRY_RUN = process.argv.includes("--dry-run");
const MAX_PHOTOS = 5; // store up to 5 photos per restaurant

function checkEnv() {
  const missing = [];
  if (!PLACES_KEY) missing.push("GOOGLE_PLACES_API_KEY");
  if (!CLOUDINARY_CLOUD) missing.push("CLOUDINARY_CLOUD_NAME");
  if (!CLOUDINARY_KEY) missing.push("CLOUDINARY_API_KEY");
  if (!CLOUDINARY_SECRET) missing.push("CLOUDINARY_API_SECRET");
  if (missing.length > 0) {
    console.error("Missing env vars:", missing.join(", "));
    process.exit(1);
  }
}

// --- Firebase Admin ---
function initFirebase() {
  const projectId = process.env.SERVICE_ACCOUNT_PROJECT_ID;
  const clientEmail = process.env.SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.SERVICE_ACCOUNT_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    console.error("Missing Firebase service account env vars");
    process.exit(1);
  }

  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });

  return admin.firestore();
}

// --- Cloudinary ---
function initCloudinary() {
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD,
    api_key: CLOUDINARY_KEY,
    api_secret: CLOUDINARY_SECRET,
  });
}

async function uploadToCloudinary(imageBuffer, publicId) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        resource_type: "image",
        overwrite: false,
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    stream.end(imageBuffer);
  });
}

async function checkCloudinaryExists(publicId) {
  try {
    const result = await cloudinary.api.resource(publicId);
    return result?.secure_url || null;
  } catch {
    return null;
  }
}

// --- Google Places ---
async function fetchFreshPhotos(placeId) {
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=photos&key=${PLACES_KEY}`;
  const { data } = await axios.get(url, { timeout: 10000 });
  if (data.status !== "OK" || !data.result?.photos) return [];
  return data.result.photos.slice(0, MAX_PHOTOS);
}

async function downloadPhoto(photoReference, maxWidth = 1600) {
  const url = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${PLACES_KEY}`;
  const response = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 30000,
    maxRedirects: 5,
  });
  return Buffer.from(response.data);
}

// --- Main ---
async function migrate() {
  checkEnv();
  const db = initFirebase();
  initCloudinary();

  console.log(DRY_RUN ? "=== DRY RUN ===" : "=== LIVE MIGRATION ===");
  console.log(`Max photos per restaurant: ${MAX_PHOTOS}\n`);

  const snapshot = await db.collection("restaurants").get();
  console.log(`Found ${snapshot.size} restaurants\n`);

  let success = 0;
  let skipped = 0;
  let failed = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const placeId = data.place_id;
    const name = data.name || doc.id;

    if (!placeId) {
      console.log(`[SKIP] ${name} - no place_id`);
      skipped++;
      continue;
    }

    // Check if already migrated (has cloudinary URLs)
    const hasCloudinary = data.photos?.some((p) => p.source === "cloudinary" && p.url);
    if (hasCloudinary) {
      console.log(`[SKIP] ${name} - already has Cloudinary photos`);
      skipped++;
      continue;
    }

    try {
      // 1. Get fresh photos from Google
      const freshPhotos = await fetchFreshPhotos(placeId);
      if (freshPhotos.length === 0) {
        console.log(`[SKIP] ${name} - no photos from Google`);
        skipped++;
        continue;
      }

      const updatedPhotos = [];

      for (let i = 0; i < freshPhotos.length; i++) {
        const photo = freshPhotos[i];
        const publicId = `restaurants/${placeId}/${i}`;

        if (DRY_RUN) {
          console.log(`  [DRY] Would upload photo ${i} for ${name}`);
          updatedPhotos.push({
            url: `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/image/upload/${publicId}`,
            source: "cloudinary",
            width: photo.width,
            height: photo.height,
          });
          continue;
        }

        // Check if already in Cloudinary
        const existing = await checkCloudinaryExists(publicId);
        if (existing) {
          updatedPhotos.push({
            url: existing,
            source: "cloudinary",
            width: photo.width,
            height: photo.height,
          });
          continue;
        }

        // Download and upload
        const buffer = await downloadPhoto(photo.photo_reference);
        const result = await uploadToCloudinary(buffer, publicId);

        updatedPhotos.push({
          url: result.secure_url,
          source: "cloudinary",
          width: photo.width,
          height: photo.height,
        });

        // Rate limiting: 100ms between uploads
        await new Promise((r) => setTimeout(r, 100));
      }

      // 2. Update Firestore
      if (!DRY_RUN) {
        await doc.ref.update({ photos: updatedPhotos });
      }

      console.log(`[OK] ${name} - ${updatedPhotos.length} photos migrated`);
      success++;

      // Rate limiting: 200ms between restaurants (Places API quota)
      await new Promise((r) => setTimeout(r, 200));
    } catch (error) {
      console.error(`[FAIL] ${name} - ${error.message}`);
      failed++;
    }
  }

  console.log(`\n=== DONE ===`);
  console.log(`Success: ${success}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${snapshot.size}`);
}

migrate().then(() => process.exit(0)).catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
