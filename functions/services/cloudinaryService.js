const axios = require("axios");
const {v2: cloudinary} = require("cloudinary");
const logger = require("firebase-functions/logger");

const GOOGLE_PHOTO_BASE_URL = "https://maps.googleapis.com/maps/api/place/photo";

function configureCloudinary() {
  if (!process.env.CLOUDINARY_CLOUD_NAME ||
      !process.env.CLOUDINARY_API_KEY ||
      !process.env.CLOUDINARY_API_SECRET) {
    throw new Error("Cloudinary credentials not set in environment");
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

async function getOrUploadPhoto(photoReference, placeId, photoIndex) {
  try {
    configureCloudinary();

    const publicId = `restaurants/${placeId}/${photoIndex}`;

    // Check if already exists in Cloudinary
    try {
      const existing = await cloudinary.api.resource(publicId);
      if (existing && existing.secure_url) {
        logger.info("Photo already exists in Cloudinary", {publicId});
        return existing.secure_url;
      }
    } catch (error) {
      // Photo doesn't exist, continue to upload
    }

    // Fetch from Google Places
    const googleApiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!googleApiKey) {
      throw new Error("GOOGLE_PLACES_API_KEY not set");
    }

    const photoUrl = `${GOOGLE_PHOTO_BASE_URL}?photoreference=${photoReference}&maxwidth=1600&key=${googleApiKey}`;

    // Download photo
    const response = await axios.get(photoUrl, {
      responseType: "arraybuffer",
      timeout: 30000,
    });

    // Upload to Cloudinary
    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
          {
            public_id: publicId,
            folder: "restaurants",
            resource_type: "image",
            overwrite: false,
          },
          (error, result) => {
            if (error) {
              reject(error);
            } else {
              resolve(result);
            }
          },
      );

      uploadStream.end(Buffer.from(response.data));
    });

    logger.info("Photo uploaded to Cloudinary", {
      publicId,
      url: uploadResult.secure_url,
    });

    return uploadResult.secure_url;
  } catch (error) {
    logger.error("Failed to upload photo to Cloudinary", {
      photoReference,
      placeId,
      error: error.message,
    });
    return null;
  }
}

module.exports = {
  getOrUploadPhoto,
};
