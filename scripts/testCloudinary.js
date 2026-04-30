require('dotenv').config({ path: './functions/.env' });
const axios = require('axios');

const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;
const PLACES_KEY = process.env.GOOGLE_PLACES_API_KEY;

console.log('Cloud name:', CLOUDINARY_CLOUD_NAME ? '✅' : '❌ missing');
console.log('API key:', CLOUDINARY_API_KEY ? '✅' : '❌ missing');
console.log('API secret:', CLOUDINARY_API_SECRET ? '✅' : '❌ missing');
console.log('Places key:', PLACES_KEY ? '✅' : '❌ missing');

async function test() {
  const testPhotoRef = 'ATplDJa5K8ELyKBVLJiMFJeJzMLWJkXJCr6WT_gIgfLWJhMRFpRPKHqbqXD8Ew';
  const googlePhotoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${testPhotoRef}&key=${PLACES_KEY}`;
  
  console.log('\nTesting Cloudinary upload...');
  
  const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
  const auth = Buffer.from(`${CLOUDINARY_API_KEY}:${CLOUDINARY_API_SECRET}`).toString('base64');
  
  const params = new URLSearchParams({
    file: googlePhotoUrl,
    upload_preset: 'nomi_restaurants',
    public_id: 'restaurants/test/photo_0',
  });

  try {
    const response = await axios.post(cloudinaryUrl, params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${auth}`,
      },
      timeout: 15000,
    });
    console.log('✅ Upload success:', response.data.secure_url);
  } catch (error) {
    console.error('❌ Upload failed:', error.response?.data || error.message);
  }
}

test();