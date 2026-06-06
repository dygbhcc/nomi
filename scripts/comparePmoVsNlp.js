require("dotenv").config({path: __dirname + "/../functions/.env"});
const admin = require("../functions/node_modules/firebase-admin");
const XLSX = require("../functions/node_modules/xlsx");
const path = require("path");

const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || "./service-account.json";
const sa = require(saPath);
admin.initializeApp({credential: admin.credential.cert(sa), projectId: "nomi-mvp"});
const db = admin.firestore();

// PMO score (1-10) to 0-1 scale for fair comparison with NLP
function pmoToNormalized(score) {
  if (!score || score < 1) return null;
  return Math.round(((score - 1) / 9) * 100) / 100;
}

function calcDiff(pmoNorm, nlpScore) {
  if (pmoNorm == null || nlpScore === "") return "";
  return Math.round((pmoNorm - nlpScore) * 100) / 100;
}

async function run() {
  // 1. Read PMO Excel - use raw cells to catch all columns
  const wb = XLSX.readFile("/Users/duygubahceci/Downloads/lisbon_restaurants (1).xlsx");
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const pmoData = XLSX.utils.sheet_to_json(sheet, {defval: ""});
  console.log(`PMO Excel: ${pmoData.length} rows`);
  console.log(`PMO columns: ${Object.keys(pmoData[0] || {}).join(", ")}`);

  // Build PMO lookup by place_id
  const pmoMap = new Map();
  for (const row of pmoData) {
    if (row.place_id) {
      pmoMap.set(row.place_id, row);
    }
  }

  // 2. Read Firestore
  const snap = await db.collection("restaurants").get();
  console.log(`Firestore: ${snap.size} restaurants`);

  // 3. Build comparison
  const rows = [];
  let matched = 0;
  let unmatched = 0;
  const unmatchedList = [];

  for (const doc of snap.docs) {
    const d = doc.data();
    const placeId = d.place_id;
    const pmo = pmoMap.get(placeId);

    const nlp = d.nlp_scores || {};
    const cs = d.confidence_scores || {};

    // NLP scores
    const nlpRomantic = nlp.romantic != null ? nlp.romantic : "";
    const nlpEnergetic = nlp.energetic != null ? nlp.energetic : "";
    const nlpChill = nlp.chill != null ? nlp.chill : "";
    const nlpExplorer = nlp.explorer != null ? nlp.explorer : "";
    const nlpFocus = nlp.focus != null ? nlp.focus : "";
    const nlpHungry = nlp.hungry_quick != null ? nlp.hungry_quick : "";

    if (!pmo) {
      unmatched++;
      unmatchedList.push({name: d.name, place_id: placeId});

      rows.push({
        place_id: placeId,
        name: d.name || "",
        neighborhood: d.neighborhood || "",
        google_rating: d.google_rating || 0,
        mood_tags: (d.mood_tags || []).join(", "),
        pmo_romantic: "", pmo_energetic: "", pmo_chill: "",
        pmo_explorer: "", pmo_focus: "", pmo_hungry: "",
        pmo_noise: "", pmo_local: "", pmo_notes: "", pmo_closed: "",
        nlp_romantic: nlpRomantic, nlp_energetic: nlpEnergetic,
        nlp_chill: nlpChill, nlp_explorer: nlpExplorer,
        nlp_focus: nlpFocus, nlp_hungry_quick: nlpHungry,
        diff_romantic: "", diff_energetic: "", diff_chill: "",
        diff_explorer: "", diff_focus: "", diff_hungry: "",
        conf_romantic: cs.romantic ?? "", conf_energetic: cs.energetic ?? "",
        conf_chill: cs.chill ?? "", conf_explorer: cs.explorer ?? "",
        conf_focus: cs.focus ?? "", conf_hungry_quick: cs.hungry_quick ?? "",
        nlp_processed: d.nlp_processed ? "YES" : "NO",
        in_pmo: "NO",
      });
      continue;
    }

    matched++;

    // PMO raw scores (1-10)
    const pmoRomantic = pmo.mood_tag_romantic || "";
    const pmoEnergetic = pmo.mood_tag_energetic || "";
    const pmoChill = pmo.mood_tag_chill || "";
    const pmoExplorer = pmo.mood_tag_explore || "";
    const pmoFocus = pmo.mood_tag_focus || "";
    const pmoHungry = pmo.mood_tag_hungry || "";

    // PMO normalized
    const pmoRomanticN = pmoToNormalized(pmo.mood_tag_romantic);
    const pmoEnergeticN = pmoToNormalized(pmo.mood_tag_energetic);
    const pmoChillN = pmoToNormalized(pmo.mood_tag_chill);
    const pmoExplorerN = pmoToNormalized(pmo.mood_tag_explore);
    const pmoFocusN = pmoToNormalized(pmo.mood_tag_focus);
    const pmoHungryN = pmoToNormalized(pmo.mood_tag_hungry);

    rows.push({
      place_id: placeId,
      name: d.name || "",
      neighborhood: d.neighborhood || "",
      google_rating: d.google_rating || 0,
      mood_tags: (d.mood_tags || []).join(", "),

      // PMO raw (1-10)
      pmo_romantic: pmoRomantic,
      pmo_energetic: pmoEnergetic,
      pmo_chill: pmoChill,
      pmo_explorer: pmoExplorer,
      pmo_focus: pmoFocus,
      pmo_hungry: pmoHungry,
      pmo_noise: pmo.noise_level || "",
      pmo_local: pmo.is_local_concept || "",
      pmo_notes: pmo.notes || "",
      pmo_closed: pmo["closed "] || pmo.closed || "",

      // NLP (0-1)
      nlp_romantic: nlpRomantic,
      nlp_energetic: nlpEnergetic,
      nlp_chill: nlpChill,
      nlp_explorer: nlpExplorer,
      nlp_focus: nlpFocus,
      nlp_hungry_quick: nlpHungry,

      // Differences
      diff_romantic: calcDiff(pmoRomanticN, nlpRomantic),
      diff_energetic: calcDiff(pmoEnergeticN, nlpEnergetic),
      diff_chill: calcDiff(pmoChillN, nlpChill),
      diff_explorer: calcDiff(pmoExplorerN, nlpExplorer),
      diff_focus: calcDiff(pmoFocusN, nlpFocus),
      diff_hungry: calcDiff(pmoHungryN, nlpHungry),

      // Confidence scores
      conf_romantic: cs.romantic ?? "",
      conf_energetic: cs.energetic ?? "",
      conf_chill: cs.chill ?? "",
      conf_explorer: cs.explorer ?? "",
      conf_focus: cs.focus ?? "",
      conf_hungry_quick: cs.hungry_quick ?? "",

      nlp_processed: d.nlp_processed ? "YES" : "NO",
      in_pmo: "YES",
    });
  }

  // Sort by name
  rows.sort((a, b) => a.name.localeCompare(b.name));

  console.log(`Matched: ${matched}`);
  console.log(`Not in PMO: ${unmatched}`);

  // 4. Write Excel
  const ws = XLSX.utils.json_to_sheet(rows);
  const wbOut = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wbOut, ws, "PMO vs NLP");

  // Legend sheet
  const legend = [
    {field: "pmo_romantic/energetic/chill/explorer/focus/hungry", description: "PMO skorlari (1-10 arasi, manual puanlama)"},
    {field: "nlp_romantic/energetic/chill/explorer/focus/hungry_quick", description: "NLP skorlari (0-1 arasi, Gemini uretimi)"},
    {field: "diff_*", description: "Fark (PMO normalized 0-1 - NLP 0-1). Pozitif = PMO daha yuksek verdi, negatif = NLP daha yuksek"},
    {field: "conf_*", description: "Weighted confidence skorlari (0-100). mood_tag atamasi icin >= 40 gerekli"},
    {field: "mood_tags", description: "Atanmis mood tag ler (confidence >= 40 olanlar)"},
    {field: "in_pmo", description: "YES = PMO Excel inde var, NO = sadece Firestore da"},
    {field: "Mapping", description: "pmo_explorer = mood_tag_explore, pmo_hungry = nlp_hungry_quick"},
  ];
  const wsLegend = XLSX.utils.json_to_sheet(legend);
  XLSX.utils.book_append_sheet(wbOut, wsLegend, "Legend");

  const outPath = path.join(__dirname, `pmo_vs_nlp_${new Date().toISOString().slice(0, 10)}.xlsx`);
  XLSX.writeFile(wbOut, outPath);
  console.log(`\nExcel: ${outPath}`);
  console.log(`Total rows: ${rows.length}`);
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
