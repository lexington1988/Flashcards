let flashcards = [];
let currentCardIndex = 0;
let showingFront = true;
let reviewing = false;
const cardEl = document.getElementById("card");
const cardText = document.getElementById("card-text");
const ratingButtons = document.getElementById("rating-buttons");

const CSV_URL = "https://yourusername.github.io/lilac-flashcards/Flashcards.csv"; // Change this!

function startReview() {
  if (!reviewing) {
    fetchCSV(CSV_URL).then((cards) => {
      flashcards = loadProgress(cards);
      reviewing = true;
      document.getElementById("start-btn").classList.add("hidden");
      cardEl.classList.remove("hidden");
      ratingButtons.classList.remove("hidden");
      showNextCard();
    });
  }
}

function fetchCSV(url) {
  return fetch(url)
    .then((res) => res.text())
    .then((text) => {
      const rows = text.trim().split("\n").slice(1);
      return rows.map((row) => {
        const [front, back] = row.split(/,(.+)/); // Support comma in back
        return {
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
  const dueCards = flashcards.filter(card => card.due <= now);
  if (dueCards.length === 0) {
    cardText.textContent = "🎉 All cards reviewed for now!";
    ratingButtons.classList.add("hidden");
    return;
  }
  currentCardIndex = flashcards.indexOf(dueCards[0]);
  showingFront = true;
  cardText.textContent = flashcards[currentCardIndex].front;
  cardEl.onclick = toggleCard;
}

function toggleCard() {
  showingFront = !showingFront;
  const card = flashcards[currentCardIndex];
  cardText.textContent = showingFront ? card.front : card.back;
}

function rateCard(quality) {
  const card = flashcards[currentCardIndex];
  const now = Date.now();

  if (quality < 3) {
    card.repetitions = 0;
    card.interval = 1;
  } else {
    card.repetitions += 1;
    if (card.repetitions === 1) {
      card.interval = 1;
    } else if (card.repetitions === 2) {
      card.interval = 6;
    } else {
      card.interval = Math.round(card.interval * card.ef);
    }
    card.ef += (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (card.ef < 1.3) card.ef = 1.3;
  }

  card.due = now + card.interval * 24 * 60 * 60 * 1000;
  saveProgress();
  showNextCard();
}