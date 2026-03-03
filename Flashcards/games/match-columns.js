// match-columns.js
(function () {
  const rawDecks = window.RAW_DECKS || {};

  // Build decks
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
  const pairCountEl = document.getElementById("pair-count");
  const spanishLeftEl = document.getElementById("spanish-left");
  const newRoundBtn = document.getElementById("new-round");
  const colAEl = document.getElementById("col-a");
  const colBEl = document.getElementById("col-b");
  const matchedEl = document.getElementById("matched");
  const totalEl = document.getElementById("total");
  const mistakesEl = document.getElementById("mistakes");
  const timerEl = document.getElementById("timer");
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

  // pick n unique cards that have both es and en and are non-empty
  // For matching games we also avoid duplicate left/right texts within a round
  // (so the user never sees two identical tiles).
  function pickCards(deckId, n) {
    const pool = (decks[deckId] || decks.all).cards
      .filter(c => typeof c.es === "string" && c.es.trim() && typeof c.en === "string" && c.en.trim());

    // avoid exact-duplicate pairs in the source
    const seenPair = new Set();
    const uniquePairs = [];
    for (const c of pool) {
      const key = `${c.es}|||${c.en}`;
      if (seenPair.has(key)) continue;
      seenPair.add(key);
      uniquePairs.push(c);
    }

    shuffle(uniquePairs);

    // pick a round set with unique ES and unique EN strings
    const usedEs = new Set();
    const usedEn = new Set();
    const picked = [];
    for (const c of uniquePairs) {
      const esKey = c.es.trim().toLowerCase();
      const enKey = c.en.trim().toLowerCase();
      if (usedEs.has(esKey) || usedEn.has(enKey)) continue;
      usedEs.add(esKey);
      usedEn.add(enKey);
      picked.push(c);
      if (picked.length >= n) break;
    }

    return picked;
  }

  let round = null;
  let selectedA = null;
  let selectedB = null;
  let mistakes = 0;
  let matched = 0;

  let timerStart = null;
  let timerHandle = null;

  function fmtTime(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
  }

  function startTimer() {
    stopTimer();
    timerStart = Date.now();
    timerHandle = setInterval(() => {
      timerEl.textContent = fmtTime(Date.now() - timerStart);
    }, 250);
  }

  function stopTimer() {
    if (timerHandle) clearInterval(timerHandle);
    timerHandle = null;
  }

  function setHint(msg) {
    hintEl.textContent = msg || "";
  }

  function clearSelection() {
    if (selectedA) selectedA.btn.setAttribute("aria-selected", "false");
    if (selectedB) selectedB.btn.setAttribute("aria-selected", "false");
    selectedA = null;
    selectedB = null;
  }

  function tryMatch() {
    if (!selectedA || !selectedB) return;
    const aId = selectedA.pairId;
    const bId = selectedB.pairId;
    if (aId === bId) {
      // matched!
      selectedA.btn.classList.add("is-matched");
      selectedB.btn.classList.add("is-matched");
      selectedA.btn.disabled = true;
      selectedB.btn.disabled = true;
      matched += 1;
      matchedEl.textContent = String(matched);
      setHint("✅ Nice!");
      clearSelection();
      if (matched >= round.total) {
        stopTimer();
        setHint("🎉 Completed! Hit “New round” to play again.");
      }
    } else {
      mistakes += 1;
      mistakesEl.textContent = String(mistakes);
      setHint("❌ Not a match. Try again.");
      // brief flash then clear
      const aBtn = selectedA.btn;
      const bBtn = selectedB.btn;
      aBtn.classList.add("wrong");
      bBtn.classList.add("wrong");
      setTimeout(() => {
        aBtn.classList.remove("wrong");
        bBtn.classList.remove("wrong");
        clearSelection();
      }, 400);
    }
  }

  function renderRound(deckId) {
    const n = parseInt(pairCountEl.value, 10) || 10;
    const spanishLeft = !!spanishLeftEl.checked;

    const picked = pickCards(deckId, n);
    round = {
      total: picked.length,
      pairs: picked.map((c, idx) => ({
        pairId: c.id, // unique
        a: spanishLeft ? c.es : c.en,
        b: spanishLeft ? c.en : c.es,
      })),
    };

    matched = 0;
    mistakes = 0;
    matchedEl.textContent = "0";
    mistakesEl.textContent = "0";
    totalEl.textContent = String(round.total);
    timerEl.textContent = "0:00";
    setHint("");

    colAEl.innerHTML = "";
    colBEl.innerHTML = "";
    clearSelection();

    // build shuffled lists
    const aItems = shuffle(round.pairs.map(p => ({ pairId: p.pairId, text: p.a })));
    const bItems = shuffle(round.pairs.map(p => ({ pairId: p.pairId, text: p.b })));

    function makeBtn(item, col) {
      const btn = document.createElement("button");
      btn.className = "btn-tile";
      btn.type = "button";
      btn.textContent = item.text;
      btn.setAttribute("aria-selected", "false");
      btn.addEventListener("click", () => {
        if (btn.classList.contains("is-matched")) return;

        // toggle selection
        if (col === "a") {
          if (selectedA && selectedA.btn === btn) {
            btn.setAttribute("aria-selected", "false");
            selectedA = null;
            return;
          }
          if (selectedA) selectedA.btn.setAttribute("aria-selected", "false");
          selectedA = { btn, pairId: item.pairId };
          btn.setAttribute("aria-selected", "true");
        } else {
          if (selectedB && selectedB.btn === btn) {
            btn.setAttribute("aria-selected", "false");
            selectedB = null;
            return;
          }
          if (selectedB) selectedB.btn.setAttribute("aria-selected", "false");
          selectedB = { btn, pairId: item.pairId };
          btn.setAttribute("aria-selected", "true");
        }
        tryMatch();
      });
      return btn;
    }

    aItems.forEach(item => colAEl.appendChild(makeBtn(item, "a")));
    bItems.forEach(item => colBEl.appendChild(makeBtn(item, "b")));

    startTimer();
  }

  // Init
  populateDeckSelect();

  if (window.SF_SCORES && typeof window.SF_SCORES.wireSaveScore === "function") {
    window.SF_SCORES.wireSaveScore({
      mode: "Match translations",
      getScore: () => ({
        correct: matched,
        wrong: mistakes,
        streak: 0,
        timeMs: timerStart ? Date.now() - timerStart : undefined,
      }),
      getMeta: () => {
        const deckId = deckSelectEl.value || "all";
        const deckLabel = (decks[deckId] || decks.all || {}).label || deckId;
        const dir = spanishLeftEl.checked ? "ES (left) ↔ EN (right)" : "EN (left) ↔ ES (right)";
        return { deckId, deckLabel, direction: dir };
      },
    });
  }

  newRoundBtn.addEventListener("click", () => renderRound(deckSelectEl.value));
  deckSelectEl.addEventListener("change", () => renderRound(deckSelectEl.value));
  pairCountEl.addEventListener("change", () => renderRound(deckSelectEl.value));
  spanishLeftEl.addEventListener("change", () => renderRound(deckSelectEl.value));

  deckSelectEl.value = "all";
  renderRound("all");
})();
