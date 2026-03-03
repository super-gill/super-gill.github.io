// pairs.js
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
  const pairCountEl = document.getElementById("pair-count");
  const newRoundBtn = document.getElementById("new-round");
  const gridEl = document.getElementById("grid");
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

    // pick a round set with unique ES and unique EN strings (so tiles are not ambiguous)
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

  let first = null;
  let second = null;
  let lock = false;
  let matched = 0;
  let mistakes = 0;

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
  function setHint(msg) { hintEl.textContent = msg || ""; }

  function resetSelection() {
    first = null;
    second = null;
  }

  function renderRound(deckId) {
    const n = parseInt(pairCountEl.value, 10) || 8;
    const picked = pickCards(deckId, n);

    // Make tiles: each picked card becomes two tiles: one es, one en, same pairId
    const tiles = [];
    for (const c of picked) {
      tiles.push({ pairId: c.id, side: "es", text: c.es });
      tiles.push({ pairId: c.id, side: "en", text: c.en });
    }
    shuffle(tiles);

    gridEl.innerHTML = "";
    matched = 0;
    mistakes = 0;
    matchedEl.textContent = "0";
    mistakesEl.textContent = "0";
    totalEl.textContent = String(picked.length);
    timerEl.textContent = "0:00";
    setHint("");
    lock = false;
    resetSelection();

    tiles.forEach((t) => {
      const btn = document.createElement("button");
      btn.className = "pair-card";
      btn.type = "button";
      btn.textContent = "•";
      btn.dataset.pairId = String(t.pairId);
      btn.dataset.side = t.side;
      btn.dataset.text = t.text;

      btn.addEventListener("click", () => {
        if (lock) return;
        if (btn.classList.contains("matched")) return;
        if (btn.classList.contains("flipped")) return;

        btn.classList.add("flipped");
        btn.textContent = t.text;

        if (!first) {
          first = btn;
          return;
        }
        second = btn;
        lock = true;

        const samePair = first.dataset.pairId === second.dataset.pairId;
        const differentSide = first.dataset.side !== second.dataset.side;

        if (samePair && differentSide) {
          // match
          setHint("✅ Matched!");
          first.classList.add("matched");
          second.classList.add("matched");
          matched += 1;
          matchedEl.textContent = String(matched);

          setTimeout(() => {
            first.disabled = true;
            second.disabled = true;
            resetSelection();
            lock = false;

            if (matched >= picked.length) {
              stopTimer();
              setHint("🎉 Completed! Hit “New round” to play again.");
            }
          }, 250);
        } else {
          // mismatch
          mistakes += 1;
          mistakesEl.textContent = String(mistakes);
          setHint("❌ Not a match.");
          setTimeout(() => {
            [first, second].forEach(b => {
              b.classList.remove("flipped");
              b.textContent = "•";
            });
            resetSelection();
            lock = false;
          }, 650);
        }
      });

      gridEl.appendChild(btn);
    });

    startTimer();
  }

  populateDeckSelect();

  if (window.SF_SCORES && typeof window.SF_SCORES.wireSaveScore === "function") {
    window.SF_SCORES.wireSaveScore({
      mode: "Match pairs",
      getScore: () => ({
        correct: matched,
        wrong: mistakes,
        streak: 0,
        timeMs: timerStart ? Date.now() - timerStart : undefined,
      }),
      getMeta: () => {
        const deckId = deckSelectEl.value || "all";
        const deckLabel = (decks[deckId] || decks.all || {}).label || deckId;
        return { deckId, deckLabel, direction: "ES ↔ EN" };
      },
    });
  }

  newRoundBtn.addEventListener("click", () => renderRound(deckSelectEl.value));
  deckSelectEl.addEventListener("change", () => renderRound(deckSelectEl.value));
  pairCountEl.addEventListener("change", () => renderRound(deckSelectEl.value));

  deckSelectEl.value = "all";
  renderRound("all");
})();
