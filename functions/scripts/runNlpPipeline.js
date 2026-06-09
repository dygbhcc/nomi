require("dotenv").config();
const fs = require("fs");
const os = require("os");
const path = require("path");
const admin = require("firebase-admin");

const projectId = process.env.SERVICE_ACCOUNT_PROJECT_ID || "nomi-mvp";
const clientEmail = process.env.SERVICE_ACCOUNT_EMAIL;
const privateKey = process.env.SERVICE_ACCOUNT_KEY.replace(/\\n/g, "\n");

admin.initializeApp({
  credential: admin.credential.cert({projectId, clientEmail, privateKey}),
});

// Vertex AI needs GOOGLE_APPLICATION_CREDENTIALS
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  const tmpPath = path.join(os.tmpdir(), "nomi-sa-tmp.json");
  fs.writeFileSync(tmpPath, JSON.stringify({
    type: "service_account",
    project_id: projectId,
    client_email: clientEmail,
    private_key: privateKey,
  }));
  process.env.GOOGLE_APPLICATION_CREDENTIALS = tmpPath;
}

// Set GCLOUD_PROJECT for the pipeline
process.env.GCLOUD_PROJECT = projectId;

const {runGeminiNlpBatch} = require("../services/geminiNlpPipeline");

(async () => {
  const batchSize = parseInt(process.argv[2] || "2500", 10);
  console.log("Starting NLP pipeline with batch size:", batchSize);
  const result = await runGeminiNlpBatch(batchSize);
  console.log("Pipeline result:", JSON.stringify(result));
})();
