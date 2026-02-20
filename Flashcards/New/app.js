// app.js
(function () {
  // ============================================================
  // Grab data from decks-data.js
  // ============================================================
  const rawDecks = window.RAW_DECKS;

  // ============================================================
  // ELEMENTS
  // ============================================================
  const cardEl = document.getElementById("card");
  const questionEl = document.getElementById("card-question");
  const answerEl = document.getElementById("card-answer");
  const showAnswerBtn = document.getElementById("show-answer-btn");
  const correctBtn = document.getElementById("correct-btn");
  const incorrectBtn = document.getElementById("incorrect-btn");
  const scoreEl = document.getElementById("score");
  const deckCountEl = document.getElementById("deck-count");
  const messageEl = document.getElementById("message");
  const directionHintEl = document.getElementById("direction-hint");
  const modeRadios = document.querySelectorAll('input[name="direction-mode"]');
  const deckSelectEl = document.getElementById("deck-select");
  const gtLinkEl = document.getElementById("gt-link");
  const ttsBtn = document.getElementById("tts-btn");
  const voiceControlsEl = document.getElementById("voice-controls");
  const voiceSelectEl = document.getElementById("voice-select");
  const rateSliderEl = document.getElementById("rate-slider");

  if (!rawDecks || typeof rawDecks !== "object") {
    messageEl.textContent =
      "Deck data not loaded. Check decks-data.js (window.RAW_DECKS).";
    showAnswerBtn.disabled = true;
    correctBtn.disabled = true;
    incorrectBtn.disabled = true;
    return;
  }

  const GT_BASE = "https://translate.google.com/details?hl=en&sl=es&tl=en&text=";
  const GT_SUFFIX = "&op=translate";

  // ============================================================
  // Derived verb decks (no duplication of text)
  // ============================================================
  const VERB_DECK_IDS = [
    "ser","tener","llamarse","estar","gustar",
    "despertarseVerb","levantarseVerb","lavarseVerb","cepillarseVerb","ducharseVerb","banarseVerb",
    "vestirseVerb","desayunarVerb","irTrabajoVerb",
    "cenarVerb","ponerseVerb","leerVerb","verVerb","usarVerb","prepararVerb","irseVerb","dormirseVerb"
  ];

  const VERB_INF_MAP = {
    ser: "ser",
    tener: "tener",
    llamarse: "llamarse",
    estar: "estar",
    gustar: "gustar",
    despertarseVerb: "despertarse",
    levantarseVerb: "levantarse",
    lavarseVerb: "lavarse",
    cepillarseVerb: "cepillarse",
    ducharseVerb: "ducharse",
    banarseVerb: "bañarse",
    vestirseVerb: "vestirse",
    desayunarVerb: "desayunar",
    irTrabajoVerb: "ir",
    cenarVerb: "cenar",
    ponerseVerb: "ponerse",
    leerVerb: "leer",
    verVerb: "ver",
    usarVerb: "usar",
    prepararVerb: "preparar",
    irseVerb: "irse",
    dormirseVerb: "dormirse"
  };

  (function buildDerivedVerbDecks() {
    const verbNamesCards = [];
    const allVerbCards = [];
    const seenInfinitives = new Set();

    VERB_DECK_IDS.forEach((deckId) => {
      const deck = rawDecks[deckId];
      if (!deck || !Array.isArray(deck.cards)) return;

      deck.cards.forEach((card) => allVerbCards.push(card));

      const infinitive = VERB_INF_MAP[deckId];
      if (infinitive) {
        const found = deck.cards.find((c) => c.es === infinitive);
        if (found && !seenInfinitives.has(infinitive)) {
          verbNamesCards.push(found);
          seenInfinitives.add(infinitive);
        }
      }
    });

    rawDecks.verbNames = { label: "Verb list (infinitives)", cards: verbNamesCards };
    rawDecks.allVerbs = { label: "All verb practice (all verbs)", cards: allVerbCards };
  })();

  // ============================================================
  // Build decks with IDs and an "all" deck (excluding some)
  // ============================================================
  const decks = {};
  let allCards = [];
  let nextCardId = 1;
  const EXCLUDE_FROM_ALL = new Set(["verbNames", "allVerbs"]);

  for (const [deckId, def] of Object.entries(rawDecks)) {
    const cards = Array.isArray(def.cards) ? def.cards : [];
    const cardsWithId = cards.map((card) => ({
      ...card,
      id: nextCardId++,
      deckId
    }));

    decks[deckId] = { label: def.label || deckId, cards: cardsWithId };

    if (!EXCLUDE_FROM_ALL.has(deckId)) allCards = allCards.concat(cardsWithId);
  }

  decks.all = { label: "All cards (mixed)", cards: allCards };

  // ============================================================
  // STATE
  // ============================================================
  let currentDeckId = "all";
  let baseCards = [];
  let currentCards = [];
  let currentIndex = 0;
  let phase = "main"; // "main" | "review" | "done"

  let correctCount = 0;
  let incorrectCount = 0;

  let isShowingAnswer = false;
  let hasSeenAnswer = false;

  let currentFrontText = "";
  let currentBackText = "";
  let currentSpanishText = "";

  // Voice / TTS state
  let availableVoices = [];
  let selectedVoiceName = "";
  let rateValue = 0.9;

  // ============================================================
  // UTILS
  // ============================================================
  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  function updateScore() {
    scoreEl.innerHTML =
      "Correct: <strong>" + correctCount + "</strong> · Incorrect: <strong>" + incorrectCount + "</strong>";
  }

  function updateDeckCount() {
    const total = baseCards.length;
    if (!total) { deckCountEl.textContent = ""; return; }
    const remaining = baseCards.filter((c) => c._status !== "correct").length;
    deckCountEl.textContent = "Remaining: " + remaining + " of " + total;
  }

  function showMessage(text, timeout = 2000) {
    messageEl.textContent = text;
    if (timeout > 0) {
      setTimeout(() => { if (messageEl.textContent === text) messageEl.textContent = ""; }, timeout);
    }
  }

  function getCurrentMode() {
    const checked = document.querySelector('input[name="direction-mode"]:checked');
    return checked ? checked.value : "es-en";
  }

  function updateTranslateLink(card) {
    if (!card || !card.es) {
      gtLinkEl.href = "#";
      gtLinkEl.style.visibility = "hidden";
      return;
    }
    gtLinkEl.href = GT_BASE + encodeURIComponent(card.es) + GT_SUFFIX;
    gtLinkEl.style.visibility = "visible";
  }

  function updateTtsState() {
    if (!ttsBtn) return;

    if (!("speechSynthesis" in window)) {
      ttsBtn.style.display = "none";
      if (voiceControlsEl) voiceControlsEl.style.display = "none";
      return;
    }

    const hasText = currentSpanishText && currentSpanishText.trim().length > 0;
    if (hasText) {
      ttsBtn.disabled = false;
      ttsBtn.style.visibility = "visible";
    } else {
      ttsBtn.disabled = true;
      ttsBtn.style.visibility = "hidden";
    }
  }

  function populateVoices() {
    if (!("speechSynthesis" in window) || !voiceSelectEl) return;

    const synth = window.speechSynthesis;
    const voices = synth.getVoices();
    if (!voices || !voices.length) return;

    availableVoices = voices.slice();

    while (voiceSelectEl.firstChild) voiceSelectEl.removeChild(voiceSelectEl.firstChild);

    const defaultOpt = document.createElement("option");
    defaultOpt.value = "";
    defaultOpt.textContent = "(auto)";
    voiceSelectEl.appendChild(defaultOpt);

    const spanishVoices = voices.filter((v) => v.lang && v.lang.toLowerCase().startsWith("es"));
    const otherVoices = voices.filter((v) => !spanishVoices.includes(v));

    function addVoiceOptions(list) {
      list.forEach((v) => {
        const opt = document.createElement("option");
        opt.value = v.name;
        opt.textContent = `${v.name} (${v.lang})`;
        voiceSelectEl.appendChild(opt);
      });
    }

    if (spanishVoices.length) {
      addVoiceOptions(spanishVoices);
      if (!selectedVoiceName) {
        selectedVoiceName = spanishVoices[0].name;
        voiceSelectEl.value = selectedVoiceName;
      }
    }

    otherVoices.forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v.name;
      opt.textContent = `${v.name} (${v.lang})`;
      voiceSelectEl.appendChild(opt);
    });

    if (selectedVoiceName && !voices.find((v) => v.name === selectedVoiceName)) {
      selectedVoiceName = "";
      voiceSelectEl.value = "";
    }
  }

  function speakSpanish(text) {
    if (!("speechSynthesis" in window)) {
      showMessage("Speech not supported in this browser.", 3000);
      return;
    }

    const trimmed = (text || "").trim();
    if (!trimmed) return;

    const synth = window.speechSynthesis;
    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(trimmed);
    utterance.rate = rateValue || 1.0;

    let voice = null;
    const voices = availableVoices.length ? availableVoices : synth.getVoices();

    if (voices && voices.length) {
      if (selectedVoiceName) voice = voices.find((v) => v.name === selectedVoiceName) || null;
      if (!voice) voice = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("es")) || null;
    }

    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = "es-ES";
    }

    synth.speak(utterance);
  }

  // ============================================================
  // DECK CONTROL
  // ============================================================
  function startDeck(deckId) {
    currentDeckId = deckId;

    const deck = decks[deckId] || decks.all;
    baseCards = deck.cards.map((card) => ({ ...card, _status: "unseen" }));
    shuffle(baseCards);

    currentCards = baseCards.slice();
    currentIndex = 0;
    phase = "main";

    correctCount = 0;
    incorrectCount = 0;
    updateScore();
    updateDeckCount();

    loadCard();

    if (currentCards.length) {
      showMessage(`${currentCards.length} card${currentCards.length === 1 ? "" : "s"} in this deck.`, 1500);
    } else {
      showMessage("This deck is empty.", 3000);
    }
  }

  function finishDeck() {
    phase = "done";
    cardEl.classList.remove("flipped");
    cardEl.classList.remove("review-phase");

    questionEl.textContent = "Deck complete 🎉";
    answerEl.textContent = "";
    directionHintEl.textContent = "";
    showAnswerBtn.disabled = true;
    showAnswerBtn.textContent = "Show answer";
    correctBtn.disabled = true;
    incorrectBtn.disabled = true;

    gtLinkEl.style.visibility = "hidden";
    if (ttsBtn) {
      ttsBtn.disabled = true;
      ttsBtn.style.visibility = "hidden";
    }

    updateDeckCount();
    showMessage("All cards answered correctly. Choose another deck or change mode.", 4000);
  }

  function loadCard() {
    if (phase === "done" || !currentCards.length) { finishDeck(); return; }

    const card = currentCards[currentIndex];
    const mode = getCurrentMode();

    let showSpanishOnFront;
    if (mode === "es-en") showSpanishOnFront = true;
    else if (mode === "en-es") showSpanishOnFront = false;
    else showSpanishOnFront = Math.random() < 0.5;

    if (showSpanishOnFront) {
      currentFrontText = card.es;
      currentBackText = card.en;
      directionHintEl.textContent = "Translate into English";
    } else {
      currentFrontText = card.en;
      currentBackText = card.es;
      directionHintEl.textContent = "Translate into Spanish";
    }

    questionEl.textContent = currentFrontText;
    answerEl.textContent = "";

    currentSpanishText = card.es || "";

    isShowingAnswer = false;
    hasSeenAnswer = false;

    cardEl.classList.remove("flipped");
    if (phase === "review") cardEl.classList.add("review-phase");
    else cardEl.classList.remove("review-phase");

    showAnswerBtn.disabled = false;
    showAnswerBtn.textContent = "Show answer";

    correctBtn.disabled = true;
    incorrectBtn.disabled = true;

    messageEl.textContent = "";

    updateTranslateLink(card);
    updateTtsState();
    updateDeckCount();
  }

  function toggleAnswer() {
    if (phase === "done" || !currentCards.length) return;

    if (!isShowingAnswer) {
      hasSeenAnswer = true;
      isShowingAnswer = true;
      answerEl.textContent = currentBackText;
      cardEl.classList.add("flipped");
      showAnswerBtn.textContent = "Show question";

      correctBtn.disabled = false;
      incorrectBtn.disabled = false;
    } else {
      isShowingAnswer = false;
      cardEl.classList.remove("flipped");
      showAnswerBtn.textContent = "Show answer";
    }
  }

  function goToNextCard() {
    if (phase === "done" || !currentCards.length) { finishDeck(); return; }

    currentIndex++;

    if (currentIndex < currentCards.length) { loadCard(); return; }

    if (phase === "main") {
      const reviewCards = baseCards.filter((c) => c._status === "incorrect");
      if (reviewCards.length > 0) {
        currentCards = reviewCards.slice();
        shuffle(currentCards);
        currentIndex = 0;
        phase = "review";
        showMessage("Reviewing cards you missed.", 2500);
        loadCard();
      } else {
        finishDeck();
      }
    } else if (phase === "review") {
      const remaining = baseCards.filter((c) => c._status === "incorrect");
      if (remaining.length > 0) {
        currentCards = remaining.slice();
        shuffle(currentCards);
        currentIndex = 0;
        showMessage("Let's try those tricky ones again.", 2500);
        loadCard();
      } else {
        finishDeck();
      }
    }
  }

  function handleResult(isCorrect) {
    if (!hasSeenAnswer || phase === "done" || !currentCards.length) return;

    const card = currentCards[currentIndex];
    if (isCorrect) { correctCount++; card._status = "correct"; }
    else { incorrectCount++; card._status = "incorrect"; }

    updateScore();
    updateDeckCount();
    goToNextCard();
  }

  // ============================================================
  // EVENT LISTENERS
  // ============================================================
  showAnswerBtn.addEventListener("click", toggleAnswer);
  correctBtn.addEventListener("click", () => handleResult(true));
  incorrectBtn.addEventListener("click", () => handleResult(false));

  document.addEventListener("keydown", (e) => {
    if (e.key === " " || e.code === "Space") {
      e.preventDefault();
      if (phase !== "done") toggleAnswer();
    } else if (e.key === "ArrowRight") {
      handleResult(true);
    } else if (e.key === "ArrowLeft") {
      handleResult(false);
    }
  });

  modeRadios.forEach((radio) => {
    radio.addEventListener("change", () => {
      if (phase !== "done" && currentCards.length) loadCard();
    });
  });

  deckSelectEl.addEventListener("change", (e) => startDeck(e.target.value));

  if (ttsBtn) ttsBtn.addEventListener("click", () => speakSpanish(currentSpanishText));
  if (voiceSelectEl) voiceSelectEl.addEventListener("change", () => (selectedVoiceName = voiceSelectEl.value || ""));

  if (rateSliderEl) {
    rateSliderEl.addEventListener("input", () => (rateValue = parseFloat(rateSliderEl.value) || 1.0));
    rateValue = parseFloat(rateSliderEl.value) || 0.9;
  }

  // ============================================================
  // INIT TTS
  // ============================================================
  if ("speechSynthesis" in window) {
    populateVoices();
    window.speechSynthesis.onvoiceschanged = () => populateVoices();
  } else if (voiceControlsEl) {
    voiceControlsEl.style.display = "none";
  }

  // ============================================================
  // INIT DECK
  // ============================================================
  startDeck(deckSelectEl.value || "all");
})();
