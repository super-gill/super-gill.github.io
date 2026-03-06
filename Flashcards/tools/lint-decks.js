#!/usr/bin/env node
/**
 * Simple dataset linter for decks-data.js
 * Usage: node tools/lint-decks.js
 */
const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "..", "decks-data.js");
const text = fs.readFileSync(filePath, "utf8");

// Extract JSON object from: window.RAW_DECKS = { ... };
const m = text.match(/window\.RAW_DECKS\s*=\s*(\{[\s\S]*\})\s*;?/);
if (!m) {
  console.error("Could not find window.RAW_DECKS object in decks-data.js");
  process.exit(1);
}

let decks;
try {
  decks = JSON.parse(m[1]);
} catch (e) {
  console.error("Failed to parse decks-data.js as JSON. Keep it JSON-compatible.");
  console.error(e.message);
  process.exit(1);
}

const englishHints = new Set(["the","a","an","and","or","i","you","he","she","we","they","my","your","from","live","good","bad","what","where","how","old","please","thanks","thank"]);
const spanishHints = new Set(["el","la","los","las","un","una","de","y","en","por","para","me","te","se","soy","eres","es","somos","tengo","tienes","tiene","hola","buenos","buenas","adios","hasta","nos","vivo","años","qué","cómo"]);

function tokens(s) {
  return (s || "").toLowerCase().match(/[a-záéíóúñü']+/g) || [];
}
function looksEnglish(s) {
  const t = tokens(s);
  return t.some(x => englishHints.has(x)) && !looksSpanish(s);
}
function looksSpanish(s) {
  const lower = (s || "").toLowerCase();
  if (/[¿¡ñáéíóúü]/.test(lower)) return true;
  const t = tokens(lower);
  return t.some(x => spanishHints.has(x));
}

let flagged = 0;
let total = 0;

for (const [deckId, deck] of Object.entries(decks)) {
  const seenES = new Set();
  const seenEN = new Set();
  for (let i = 0; i < deck.cards.length; i++) {
    total++;
    const c = deck.cards[i];
    const es = c.es || "";
    const en = c.en || "";
    const issues = [];

    if (looksEnglish(es)) issues.push("ES looks English (possible swap)");
    if (looksSpanish(en)) issues.push("EN looks Spanish (possible swap)");
    if (en.includes("/")) issues.push("EN contains '/' — move variants into accept.en");
    if (/^\d+\//.test(es) || /^\d+\//.test(en)) issues.push("Worksheet numbering / fragment");
    if (/[🥵🌧️☀️🌪️⛈️🍃🌦️☔⚡🌥️]/.test(es + en)) issues.push("Emoji-only / emoji content");
    if (seenES.has(es)) issues.push("Duplicate ES prompt in deck (match modes may break)");
    if (seenEN.has(en)) issues.push("Duplicate EN prompt in deck (match modes may break)");

    seenES.add(es);
    seenEN.add(en);

    if (issues.length) {
      flagged++;
      console.log(`\n[${deckId}] card ${i + 1}`);
      console.log(`  ES: ${JSON.stringify(es)}`);
      console.log(`  EN: ${JSON.stringify(en)}`);
      for (const iss of issues) console.log(`  - ${iss}`);
    }
  }
}

console.log(`\nDone. Flagged ${flagged} / ${total} cards.`);
process.exit(flagged ? 2 : 0);
