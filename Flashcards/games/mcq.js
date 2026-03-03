// mcq.js
(function () {
  const rawDecks = window.RAW_DECKS || {};

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

  const deckSelectEl = document.getElementById("deck-select");
  const directionEl = document.getElementById("direction");
  const nextBtn = document.getElementById("next");
  const promptEl = document.getElementById("prompt");
  const subEl = document.getElementById("sub");
  const optionsEl = document.getElementById("options");
  const correctEl = document.getElementById("correct");
  const wrongEl = document.getElementById("wrong");
  const streakEl = document.getElementById("streak");
  const hintEl = document.getElementById("hint");

  function populateDeckSelect() {
    while (deckSelectEl.options.length > 1) deckSelectEl.remove(1);
    const items = Object.entries(decks)
      .filter(([id]) => id !== "all")
      .map(([id, d]) => ({ id, label: d.label }))
      .sort((a, b) => a.label.localeCompare(b.label));
    items.forEach(({ id, label }) => {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = label;
      deckSelectEl.appendChild(opt);
    });
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function pickPool(deckId) {
    const pool = (decks[deckId] || decks.all).cards
      .filter(c => typeof c.es === "string" && c.es.trim() && typeof c.en === "string" && c.en.trim());
    // unique by pair
    const seen = new Set();
    const unique = [];
    for (const c of pool) {
      const key = `${c.es}|||${c.en}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(c);
    }
    return unique;
  }

  let score = { correct: 0, wrong: 0, streak: 0 };
  let current = null;
  let locked = false;

  function setHint(msg) { hintEl.textContent = msg || ""; }

  function newQuestion() {
    const deckId = deckSelectEl.value;
    const dir = directionEl.value;
    const pool = pickPool(deckId);
    if (pool.length < 4) {
      promptEl.textContent = "Not enough cards in this deck for MCQ.";
      subEl.textContent = "Pick another deck or add more cards.";
      optionsEl.innerHTML = "";
      return;
    }

    current = pool[Math.floor(Math.random() * pool.length)];
    const prompt = dir === "es_to_en" ? current.es : current.en;
    const answer = dir === "es_to_en" ? current.en : current.es;

    promptEl.textContent = prompt;
    subEl.textContent = dir === "es_to_en" ? "Pick the English meaning" : "Pick the Spanish translation";

    // collect distractors
    const distractors = [];
    const used = new Set([answer]);
    const shuffled = shuffle(pool.slice());
    for (const c of shuffled) {
      const opt = dir === "es_to_en" ? c.en : c.es;
      if (!opt || used.has(opt)) continue;
      used.add(opt);
      distractors.push(opt);
      if (distractors.length >= 3) break;
    }

    const options = shuffle([answer, ...distractors]).slice(0, 4);

    optionsEl.innerHTML = "";
    locked = false;
    setHint("");

    options.forEach((opt) => {
      const btn = document.createElement("button");
      btn.className = "mcq-option";
      btn.type = "button";
      btn.textContent = opt;

      btn.addEventListener("click", () => {
        if (locked) return;
        locked = true;

        // mark
        const isCorrect = opt === answer;
        if (isCorrect) {
          btn.classList.add("correct");
          score.correct += 1;
          score.streak += 1;
          setHint("✅ Correct!");
        } else {
          btn.classList.add("wrong");
          score.wrong += 1;
          score.streak = 0;
          setHint(`❌ Not quite. Correct answer: ${answer}`);
          // highlight correct option
          [...optionsEl.querySelectorAll(".mcq-option")].forEach(b => {
            if (b.textContent === answer) b.classList.add("correct");
          });
        }

        correctEl.textContent = String(score.correct);
        wrongEl.textContent = String(score.wrong);
        streakEl.textContent = String(score.streak);
      });

      optionsEl.appendChild(btn);
    });
  }

  populateDeckSelect();

  if (window.SF_SCORES && typeof window.SF_SCORES.wireSaveScore === "function") {
    window.SF_SCORES.wireSaveScore({
      mode: "Multiple choice",
      getScore: () => ({ correct: score.correct, wrong: score.wrong, streak: score.streak }),
      getMeta: () => {
        const deckId = deckSelectEl.value || "all";
        const deckLabel = (decks[deckId] || decks.all || {}).label || deckId;
        const dir = directionEl.value === "en_to_es" ? "EN → ES" : "ES → EN";
        return { deckId, deckLabel, direction: dir };
      },
    });
  }

  nextBtn.addEventListener("click", newQuestion);
  deckSelectEl.addEventListener("change", newQuestion);
  directionEl.addEventListener("change", newQuestion);

  // start
  deckSelectEl.value = "all";
  newQuestion();
})();
