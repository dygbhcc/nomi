const admin = require("firebase-admin");
const XLSX = require("xlsx");

function getDb() {
  return admin.firestore();
}

/**
 * Import manual scores from Excel data to Firestore
 * @param {Array} excelData - Array of restaurant objects from Excel
 * @param {Object} fieldMapping - Mapping of Excel columns to Firestore fields
 * @return {Object} - Import results
 */
async function importManualScores(excelData, fieldMapping) {
  const db = getDb();
  const results = {
    total: excelData.length,
    updated: 0,
    notFound: 0,
    errors: 0,
    notFoundList: [],
  };

  for (const row of excelData) {
    try {
      // Find restaurant by place_id or name
      const identifier = row[fieldMapping.identifier]; // place_id or name

      if (!identifier) {
        results.errors++;
        continue;
      }

      let query;
      if (fieldMapping.identifierField === "place_id") {
        query = db.collection("restaurants").where("place_id", "==", identifier);
      } else {
        query = db.collection("restaurants").where("name", "==", identifier);
      }

      const snapshot = await query.limit(1).get();

      if (snapshot.empty) {
        results.notFound++;
        results.notFoundList.push(identifier);
        continue;
      }

      const doc = snapshot.docs[0];

      // Build update object based on field mapping
      const updateData = {
        manual_scoring: {},
        has_manual_scoring: true,
        manual_scoring_date: admin.firestore.FieldValue.serverTimestamp(),
      };

      // Map Excel columns to Firestore fields
      Object.keys(fieldMapping.scoreFields).forEach((excelCol) => {
        const firestoreField = fieldMapping.scoreFields[excelCol];
        const value = row[excelCol];
        if (value !== undefined && value !== null && value !== "") {
          updateData.manual_scoring[firestoreField] = value;
        }
      });

      await doc.ref.update(updateData);
      results.updated++;
    } catch (error) {
      console.error(`Error processing row:`, error.message);
      results.errors++;
    }
  }

  return results;
}

/**
 * Export restaurants without manual scoring to Excel format
 * @return {Array} - Array of restaurant objects for Excel export
 */
async function exportRestaurantsWithoutScoring() {
  const db = getDb();

  const snapshot = await db.collection("restaurants")
      .where("has_manual_scoring", "==", false)
      .get();

  const restaurants = [];

  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    restaurants.push({
      place_id: data.place_id,
      name: data.name,
      address: data.address,
      google_rating: data.google_rating || 0,
      review_count: data.review_count || 0,
      business_status: data.business_status,
      // Add empty columns for manual scoring
      manual_food_quality: "",
      manual_service: "",
      manual_ambiance: "",
      manual_value: "",
      manual_notes: "",
    });
  });

  return restaurants;
}

/**
 * Convert array of objects to Excel buffer
 * @param {Array} data - Array of objects to convert
 * @return {Buffer} - Excel file buffer
 */
function arrayToExcelBuffer(data) {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Restaurants");
  return XLSX.write(workbook, {type: "buffer", bookType: "xlsx"});
}

/**
 * Parse Excel file buffer to array of objects
 * @param {Buffer} buffer - Excel file buffer
 * @return {Array} - Array of objects
 */
function excelBufferToArray(buffer) {
  const workbook = XLSX.read(buffer, {type: "buffer"});
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(worksheet);
}

module.exports = {
  importManualScores,
  exportRestaurantsWithoutScoring,
  arrayToExcelBuffer,
  excelBufferToArray,
};
