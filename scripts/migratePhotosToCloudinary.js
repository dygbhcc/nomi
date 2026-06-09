/**
 * Migration script: Refresh expired Google Places photo_references,
 * upload first photo to Cloudinary, and update Firestore.
 *
 * Usage:
 *   node scripts/migratePhotosToCloudinary.js [--dry-run] [--batch=200]
 *
 * Options:
 *   --dry-run       Don't actually upload or update, just show what would happen
 *   --batch=N       Process N restaurants per run (default: 200)
 */

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../functions/.env") });

const admin = require("../functions/node_modules/firebase-admin");
const axios = require("../functions/node_modules/axios");
const { v2: cloudinary } = require("../functions/node_modules/cloudinary");

// --- Config ---
const PLACES_KEY = process.env.GOOGLE_PLACES_API_KEY;
const CLOUDINARY_CLOUD = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_SECRET = process.env.CLOUDINARY_API_SECRET;

const DRY_RUN = process.argv.includes("--dry-run");
const MAX_PHOTOS = 5;
const BATCH_SIZE = parseInt(
  (process.argv.find((a) => a.startsWith("--batch=")) || "--batch=200").split("=")[1]
);

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
  console.log(`Batch size: ${BATCH_SIZE} | Max photos per restaurant: ${MAX_PHOTOS}\n`);

  const snapshot = await db.collection("restaurants").get();
  console.log(`Found ${snapshot.size} restaurants total`);

  // Filter to only restaurants that need migration
  const pending = snapshot.docs.filter((doc) => {
    const data = doc.data();
    if (!data.place_id) return false;
    const hasCloudinary = data.photos?.some((p) => p.source === "cloudinary" && p.url);
    return !hasCloudinary;
  });

  const alreadyDone = snapshot.size - pending.length;
  console.log(`Already migrated: ${alreadyDone}`);
  console.log(`Pending: ${pending.length}`);
  console.log(`Processing this batch: ${Math.min(BATCH_SIZE, pending.length)}\n`);

  if (pending.length === 0) {
    console.log("Nothing to do - all restaurants are migrated!");
    return;
  }

  const batch = pending.slice(0, BATCH_SIZE);
  let success = 0;
  let skipped = 0;
  let failed = 0;

  for (const doc of batch) {
    const data = doc.data();
    const placeId = data.place_id;
    const name = data.name || doc.id;

    try {
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

        // Rate limiting between uploads
        await new Promise((r) => setTimeout(r, 150));
      }

      if (!DRY_RUN) {
        await doc.ref.update({ photos: updatedPhotos });
      }

      console.log(`[OK] ${name} - ${updatedPhotos.length} photos`);
      success++;

      // Rate limiting between restaurants
      await new Promise((r) => setTimeout(r, 250));
    } catch (error) {
      console.error(`[FAIL] ${name} - ${error.message}`);
      failed++;
    }
  }

  console.log(`\n=== BATCH DONE ===`);
  console.log(`Success: ${success}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Failed: ${failed}`);
  console.log(`Remaining: ${pending.length - batch.length}`);
}

migrate().then(() => process.exit(0)).catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
