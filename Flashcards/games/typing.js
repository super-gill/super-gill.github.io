// typing.js
(function () {
  const rawDecks = window.RAW_DECKS || {};

  // Build decks (same style as main app)
  const decks = {};
  let allCards = [];
  let nextId = 1;
  const EXCLUDE_FROM_ALL = new Set(["verbNames", "allVerbs"]);

  for (const [deckId, def] of Object.entries(rawDecks)) {
    const cards = Array.isArray(def.cards) ? def.cards : [];
    const cardsWithId = cards.map((c) => ({ ...c, id: nextId++, deckId }));
    decks[deckId] = { label: def.label || deckId, cards: cardsWithId };
    if (!EXCLUDE_FROM_ALL.has(deckId)) allCards = allCards.concat(cardsWithId);
  }
  decks.all = { label: "All cards (mixed)", cards: allCards };

  // Elements
  const deckSelectEl = document.getElementById("deck-select");
  const directionEl = document.getElementById("direction");
  const strictEl = document.getElementById("strict");
  const promptEl = document.getElementById("prompt");
  const subpromptEl = document.getElementById("subprompt");
  const answerEl = document.getElementById("answer");
  const checkBtn = document.getElementById("check");
  const revealBtn = document.getElementById("reveal");
  const skipBtn = document.getElementById("skip");
  const nextBtn = document.getElementById("next");
  const feedbackEl = document.getElementById("feedback");
  const answerBoxEl = document.getElementById("answerBox");
  const correctEl = document.getElementById("correct");
  const wrongEl = document.getElementById("wrong");
  const streakEl = document.getElementById("streak");
  const countEl = document.getElementById("count");

  // Populate deck dropdown
  function populateDeckSelect() {
    while (deckSelectEl.options.length > 1) deckSelectEl.remove(1);
    const items = Object.entries(decks)
      .filter(([id]) => id !== "all")
      .map(([id, d]) => ({ id, label: d.label || id }))
      .sort((a, b) => a.label.localeCompare(b.label));
    for (const { id, label } of items) {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = label;
      deckSelectEl.appendChild(opt);
    }
  }

  // Normalisation + matching helpers
function stripAccents(s) {
  return (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Base normalisation: case/spacing/punct + optional accent stripping (used for both ES/EN)
function normBasic(s, strictAccents) {
  let out = (s || "").toLowerCase().trim();
  if (!strictAccents) out = stripAccents(out);
  out = out
    .replace(/[¿?¡!.,;:"]/g, "")
    .replace(/\s+/g, " ");
  return out;
}

// Light equivalence rules for EN answers (paraphrase-ish, but safe)
function normEquivEn(s, strictAccents) {
  let x = normBasic(s, strictAccents);

  // Common contractions / variants (typed without apostrophes)
  x = x.replace(/\bi['’]?m\b/g, "i am");
  x = x.replace(/\bdon['’]?t\b/g, "do not");
  x = x.replace(/\bcan['’]?t\b/g, "cannot");
  x = x.replace(/\bwon['’]?t\b/g, "will not");

  // Common semantic equivalents
  x = x.replace(/\bthanks\b/g, "thank you");

  // Remove some harmless filler words (optional)
  x = x.replace(/\b(please|really|just)\b/g, "").replace(/\s+/g, " ").trim();

  return x;
}

function normForLang(s, lang, strictAccents) {
  if (lang === "en") return normEquivEn(s, strictAccents);
  return normBasic(s, strictAccents);
}

function tokensOf(s) {
  return (s || "").split(" ").filter(Boolean);
}


// Expand expected answers for typing mode:
// - Supports multiple acceptable answers separated by "/" or ";" or "|"
// - Trims and de-dupes
function expandExpectedList(list) {
  const out = [];
  const seen = new Set();

  const add = (s) => {
    const v = (s || "").trim();
    if (!v) return;
    const key = v.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(v);
  };

  for (const item of (list || [])) {
    if (typeof item !== "string") continue;

    // keep original
    add(item);

    // split on common separators for "either/or" answers
    const parts = item.split(/\s*[\/;|]\s*/g);
    if (parts.length > 1) parts.forEach(add);
  }
  return out;
}

function jaccard(tokensA, tokensB) {
  const A = new Set(tokensA);
  const B = new Set(tokensB);
  let inter = 0;
  for (const t of A) if (B.has(t)) inter += 1;
  const union = new Set([...A, ...B]).size;
  return union ? inter / union : 0;
}

// Small edit distance for typo tolerance (Levenshtein)
function levenshtein(a, b) {
  a = a || "";
  b = b || "";
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[a.length][b.length];
}

// Returns: { level: "accept"|"close"|"partial"|"wrong", score: 0..1, matched: expectedString }
function gradeAnswer(userRaw, expectedList, lang, strictAccents) {
  const user = normForLang(userRaw, lang, strictAccents);

  let best = { level: "wrong", score: 0, matched: expectedList[0] || "" };

  for (const expectedRaw of expectedList) {
    const exp = normForLang(expectedRaw, lang, strictAccents);

    // Exact after equivalence rules
    if (user === exp) return { level: "accept", score: 1, matched: expectedRaw };

    const tokScore = jaccard(tokensOf(user), tokensOf(exp));

    const dist = levenshtein(user, exp);
    const maxLen = Math.max(user.length, exp.length) || 1;
    const editScore = 1 - dist / maxLen;

    const score = Math.max(tokScore, editScore);

    if (score > best.score) best = { level: "wrong", score, matched: expectedRaw };
  }

  if (best.score >= 0.92) best.level = "close";
  else if (best.score >= 0.80) best.level = "partial";
  else best.level = "wrong";

  return best;
}

  // State
  let currentDeckId = "all";
  let pool = [];
  let current = null;
  let revealed = false;

  let correct = 0;
  let wrong = 0;
  let streak = 0;

  function setStats() {
    correctEl.textContent = String(correct);
    wrongEl.textContent = String(wrong);
    streakEl.textContent = String(streak);
    countEl.textContent = String(pool.length);
  }

  function buildPool() {
    currentDeckId = deckSelectEl.value || "all";
    const d = decks[currentDeckId] || decks.all;
    pool = [...(d.cards || [])];

    // Shuffle
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    setStats();
  }

  function getQA(card) {
    const dir = directionEl.value || "es2en";
    const question = dir === "es2en" ? card.es : card.en;
    const answer = dir === "es2en" ? card.en : card.es;
    const hint = dir === "es2en" ? "Type the English meaning" : "Type the Spanish phrase";
    return { question, answer, hint };
  }

  function showCard() {
    feedbackEl.style.display = "none";
    answerBoxEl.style.display = "none";
    answerBoxEl.textContent = "";
    revealed = false;

    if (!pool.length) {
      promptEl.textContent = "No cards found in this deck.";
      subpromptEl.textContent = "";
      current = null;
      return;
    }

    current = pool[0];
    const { question, hint } = getQA(current);
    promptEl.textContent = question || "—";
    subpromptEl.textContent = hint;

    answerEl.value = "";
    answerEl.focus();
  }

  function reveal() {
    if (!current) return;
    const { answer } = getQA(current);
    answerBoxEl.style.display = "block";
    answerBoxEl.textContent = "Answer: " + answer;
    revealed = true;
  }

  function markFeedback(ok, msg) {
    feedbackEl.style.display = "block";
    feedbackEl.className = "feedback " + (ok ? "ok" : "bad");
    feedbackEl.textContent = msg;
  }

  
function check() {
  if (!current) return;

  const strictAccents = (strictEl.value || "lenient") === "strict";
  const user = answerEl.value;

  const dir = directionEl.value || "es2en";
  const gradingLang = dir === "es2en" ? "en" : "es";
  const expectedMain = gradingLang === "en" ? (current.en || "") : (current.es || "");

  // Allow optional alternative accepted answers on the card:
  // { es, en, alts: { en: ["..."], es: ["..."] } }
  let expectedList = [expectedMain];
  if (current.alts && current.alts[gradingLang] && Array.isArray(current.alts[gradingLang])) {
    expectedList = expectedList.concat(current.alts[gradingLang]);
  }

  if (current.accept && current.accept[gradingLang] && Array.isArray(current.accept[gradingLang])) {
    expectedList = expectedList.concat(current.accept[gradingLang]);
  }

  expectedList = expandExpectedList(expectedList);

  const result = gradeAnswer(user, expectedList, gradingLang, strictAccents);

  if (result.level === "accept") {
    correct += 1;
    streak += 1;
    markFeedback(true, "Correct ✅");
    pool.shift();
    setStats();
    showCard();
    return;
  }

  if (result.level === "close") {
    // Close enough counts as correct, but we show a different message
    correct += 1;
    streak += 1;
    markFeedback(true, "Close enough ✅");
    answerBoxEl.style.display = "block";
    answerBoxEl.textContent = "Expected: " + (result.matched || expectedMain);
    pool.shift();
    setStats();
    showCard();
    return;
  }

  if (result.level === "partial") {
    // "Almost" does NOT count as wrong, but it breaks streak.
    streak = 0;
    markFeedback(false, "Almost — close meaning (not counted)");
    answerBoxEl.style.display = "block";
    answerBoxEl.textContent = "Expected: " + (result.matched || expectedMain);
    setStats();
    return;
  }

  // Wrong
  wrong += 1;
  streak = 0;
  markFeedback(false, "Not quite ❌");
  answerBoxEl.style.display = "block";
  answerBoxEl.textContent = "Expected: " + (result.matched || expectedMain);
  setStats();
}

function skip() {
    if (!current) return;
    // move to end
    pool.push(pool.shift());
    setStats();
    showCard();
  }

  function next() {
    // behave like skip, but doesn’t change score
    skip();
  }

  // Events
  deckSelectEl.addEventListener("change", () => {
    buildPool();
    showCard();
  });
  directionEl.addEventListener("change", () => {
    showCard();
  });
  strictEl.addEventListener("change", () => {
    // no-op; affects next check
    answerEl.focus();
  });

  checkBtn.addEventListener("click", check);
  revealBtn.addEventListener("click", reveal);
  skipBtn.addEventListener("click", skip);
  nextBtn.addEventListener("click", next);

  answerEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      check();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      reveal();
    }
  });

  // Init
  populateDeckSelect();
  buildPool();

  if (window.SF_SCORES && typeof window.SF_SCORES.wireSaveScore === "function") {
    window.SF_SCORES.wireSaveScore({
      mode: "Typing",
      getScore: () => ({ correct, wrong, streak }),
      getMeta: () => {
        const deckId = deckSelectEl.value || "all";
        const deckLabel = (decks[deckId] || decks.all || {}).label || deckId;
        const dir = directionEl.value === "en2es" ? "EN → ES" : "ES → EN";
        return { deckId, deckLabel, direction: dir };
      },
    });
  }

  showCard();
})();
