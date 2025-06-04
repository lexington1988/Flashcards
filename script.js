let cardsSeen = 0;
let delayedCards = []; // cards to show again soon
let allFlashcards = []; // Stores the full set from CSV
let delayCounter = 0;
let againQueue = [];
let flashcards = [];
let currentCardIndex = 0;
let showingFront = true;
let reviewing = false;
const cardEl = document.getElementById("card");
const cardText = document.getElementById("card-text");
const ratingButtons = document.getElementById("rating-buttons");
const progressEl = document.createElement("div");
progressEl.id = "progress";
progressEl.style.marginTop = "10px";
progressEl.style.fontSize = "0.95rem";
progressEl.style.color = "#555";
document.body.insertBefore(progressEl, cardEl);

const CSV_URL = "https://lexington1988.github.io/flashcards/Flashcards.csv";
let completedToday = new Set();

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function startReview() {
  if (!reviewing) {
    fetchCSV(CSV_URL).then((cards) => {
      const settings = getSettings();

      // ✅ Store full list for switching modes later
      allFlashcards = cards;

      // If Custom Study is enabled, select only N cards
      let selectedCards = cards;
      if (settings.customCount > 0 && settings.customCount < cards.length) {
        selectedCards = shuffle(cards).slice(0, settings.customCount);
      }

      flashcards = loadProgress(selectedCards);
      reviewing = true;
      document.getElementById("start-btn").classList.add("hidden");
      cardEl.classList.remove("hidden");
      ratingButtons.classList.remove("hidden");
      const toggleBtn = document.getElementById("toggle-mode-btn");
toggleBtn.classList.remove("hidden");

// Set correct label based on current mode
if (flashcards.length < allFlashcards.length) {
  toggleBtn.textContent = "Switch to Full Deck";
} else {
  toggleBtn.textContent = "Switch to Custom Study";
}

      showNextCard();
    });
  }
}

function toggleStudyMode() {
  const settings = getSettings();
  const toggleBtn = document.getElementById("toggle-mode-btn");

  const usingCustom = flashcards.length < allFlashcards.length;

  if (usingCustom) {
    flashcards = loadProgress(allFlashcards);
    toggleBtn.textContent = "Switch to Custom Study";
    alert("✅ Switched to Full Deck mode");
  } else {
    if (settings.customCount > 0 && settings.customCount < allFlashcards.length) {
      flashcards = loadProgress(shuffle(allFlashcards).slice(0, settings.customCount));
      toggleBtn.textContent = "Switch to Full Deck";
      alert(`✅ Switched to Custom Study (${settings.customCount} cards)`);
    } else {
      alert("⚠️ Custom Study count is not set or too large.");
      return;
    }
  }

  completedToday = new Set();
  delayedCards = [];
  showNextCard();
}

function fetchCSV(url) {
  return fetch(url)
    .then((res) => res.text())
    .then((text) => {
      const rows = text.trim().split("\n").slice(1);
      return rows.map((row, index) => {
        const [front, back] = row.split(/,(.+)/);
        return {
          id: index,
          front: front.trim(),
          back: back.trim(),
          ef: 2.5,
          interval: 0,
          repetitions: 0,
          due: Date.now(),
        };
      });
    });
}

function loadProgress(cards) {
  const saved = JSON.parse(localStorage.getItem("flashcards-progress") || "{}");
  return cards.map((card, i) => Object.assign(card, saved[i] || {}));
}

function saveProgress() {
  const saveData = flashcards.reduce((acc, card, i) => {
    acc[i] = {
      ef: card.ef,
      interval: card.interval,
      repetitions: card.repetitions,
      due: card.due,
    };
    return acc;
  }, {});
  localStorage.setItem("flashcards-progress", JSON.stringify(saveData));
}

function showNextCard() {
  const now = Date.now();
  const settings = getSettings();

  // Decrement delays for delayed cards
  delayedCards.forEach(obj => obj.delay--);

  // Check if any delayed card is ready
  const readyRetry = delayedCards.find(obj => obj.delay <= 0);
  if (readyRetry) {
    delayedCards = delayedCards.filter(obj => obj !== readyRetry);
    currentCardIndex = flashcards.indexOf(readyRetry.card);
  } else {
    // Get due cards that haven't been completed today
    let dueCards = flashcards.filter(card => card.due <= now && !completedToday.has(card.id));

    // Enforce daily limit
    if (settings.dailyLimit && dueCards.length > 0) {
      const remaining = settings.dailyLimit - completedToday.size;
      if (remaining <= 0) {
        cardText.textContent = "🎉 You've reached your daily limit!";
        ratingButtons.classList.add("hidden");
        updateProgress();
        return;
      }
      dueCards = dueCards.slice(0, remaining);
    }

    if (dueCards.length === 0) {
      cardText.textContent = "🎉 All cards reviewed for now!";
      ratingButtons.classList.add("hidden");
      updateProgress();
      return;
    }

    currentCardIndex = flashcards.indexOf(dueCards[0]);
  }

  showingFront = true;
  cardText.textContent = flashcards[currentCardIndex].front;
  cardEl.onclick = toggleCard;
  updateProgress();
  cardsSeen++;
if (cardsSeen > 5) {
  document.getElementById("flip-hint").style.display = "none";
} else {
  document.getElementById("flip-hint").style.display = "block";
}

}





function updateProgress() {
  const now = Date.now();
  const settings = getSettings();

  const newCards = flashcards.filter(
    card => card.repetitions === 0 && card.due <= now && !completedToday.has(card.id)
  ).length;

  const reviewCards = flashcards.filter(
    card => card.repetitions > 0 && card.due <= now && !completedToday.has(card.id)
  ).length;

  const delayedReviewCount = delayedCards.length;
  const totalDue = newCards + reviewCards + delayedReviewCount;

  const remaining = Math.max(0, settings.dailyLimit - completedToday.size);
  const showDue = Math.min(totalDue, remaining);

  progressEl.textContent = `New: ${newCards} | Review: ${reviewCards + delayedReviewCount} | Left Today: ${showDue}`;
} // ✅ This closes updateProgress()

function toggleCard() {
  showingFront = !showingFront;
  const card = flashcards[currentCardIndex];

  // Update the card content
  cardText.innerHTML = showingFront ? card.front : card.back;

  // Update the side label
  document.getElementById("card-side-label").textContent = showingFront ? "Front" : "Back";

  // Change text color for answer side
  if (showingFront) {
    cardText.classList.remove("purple-answer");
  } else {
    cardText.classList.add("purple-answer");
  }
}



function rateCard(quality) {
  const card = flashcards[currentCardIndex];
  const now = Date.now();

  if (quality === 1) {
    // "Again" — retry later in the session (after 10 other cards)
    card.repetitions = 0;
    card.interval = 0.01;
    card.due = now + 15 * 60 * 1000;
  const settings = getSettings();
delayedCards.push({ card, delay: settings.againDelay });

  } else {
    completedToday.add(card.id);
    card.repetitions++;

    if (card.repetitions === 1) {
      card.interval = 1;
    } else if (card.repetitions === 2) {
      card.interval = 4;
    } else {
      let multiplier;
      if (quality === 2) multiplier = 1.2;
      else if (quality === 3) multiplier = card.ef;
      else if (quality === 4) multiplier = card.ef + 0.15;
      else multiplier = card.ef;

      card.interval = Math.round(card.interval * multiplier);
    }

    if (quality >= 3) {
      card.ef += (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
      if (card.ef < 1.3) card.ef = 1.3;
    }

    card.due = now + card.interval * 24 * 60 * 60 * 1000;
  }

  saveProgress();
  showNextCard();
}
