require('dotenv').config({ path: './functions/.env' });
const axios = require('axios');

async function callFetchRestaurants() {
  const functionUrl = 'https://europe-west1-nomi-mvp.cloudfunctions.net/fetchAndCacheRestaurants';

  // Test coordinates - Bairro Alto (cache cleared earlier)
  const data = {
    lat: 38.714,
    lng: -9.146,
    radius: 500,
    maxResults: 3  // Just 3 to test quickly
  };

  console.log('🚀 Calling fetchAndCacheRestaurants...');
  console.log('📍 Coordinates:', data);
  console.log('⏳ This may take 30-60 seconds as photos upload to Cloudinary...\n');

  try {
    const response = await axios.post(functionUrl, { data }, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 120000, // 2 minutes
    });

    console.log('✅ Success!');
    console.log('📊 Response:');
    console.log(`   Source: ${response.data.result.source}`);
    console.log(`   Count: ${response.data.result.count}`);
    console.log(`   Restaurants: ${response.data.result.restaurants.length}\n`);

    // Show first restaurant with photo details
    if (response.data.result.restaurants[0]) {
      const first = response.data.result.restaurants[0];
      console.log('🍽️  First restaurant:');
      console.log(`   Name: ${first.name}`);
      console.log(`   Photo:`, first.photos[0]);
      console.log('');
    }

    console.log('🎯 Now check the database:');
    console.log('   node scripts/checkCloudinaryPhotos.js\n');

  } catch (error) {
    if (error.response) {
      console.error('❌ Error response:', error.response.status, error.response.data);
    } else {
      console.error('❌ Error:', error.message);
    }
  }
}

callFetchRestaurants();
