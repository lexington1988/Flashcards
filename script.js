let currentDeckName = "Flashcards.csv"; // default starting deck
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
    fetchCSV(currentDeckName).then((cards) => {
      const settings = getSettings();

      // ✅ Store full list for switching modes later
      allFlashcards = cards;

      // If Custom Study is enabled, select only N cards
      let selectedCards = cards;

      flashcards = loadProgress(selectedCards);
      reviewing = true;
      document.getElementById("start-btn").classList.add("hidden");
     document.getElementById("main-buttons").style.display = "none";
      cardEl.classList.remove("hidden");
      ratingButtons.classList.remove("hidden");
      document.getElementById("add-btn").classList.remove("hidden");
document.getElementById("edit-btn").classList.remove("hidden");
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
    ratingButtons.classList.remove("hidden"); // ✅ Show rating buttons again
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

function fetchCSV(deckName) {
  // Check localStorage first
  const localData = localStorage.getItem("deck-" + deckName);
  if (localData) {
    return Promise.resolve(JSON.parse(localData).map((card, index) => ({
      ...card,
      id: index,
      ef: card.ef ?? 2.5,
      interval: card.interval ?? 0,
      repetitions: card.repetitions ?? 0,
      due: card.due ?? Date.now()
    })));
  }

  // Otherwise fetch from GitHub
  return fetch("https://lexington1988.github.io/flashcards/" + deckName)
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
  cardText.classList.remove("purple-answer"); // Make sure question is black
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

  // Use textContent to avoid HTML parsing errors
  cardText.textContent = showingFront ? card.front : card.back;

  // Update the side label (optional: add this element if you want to show "Front"/"Back")
  const sideLabel = document.getElementById("card-side-label");
  if (sideLabel) {
    sideLabel.textContent = showingFront ? "Front" : "Back";
  }

  // Toggle purple color for back
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
function addNewCard() {
  const front = prompt("Enter the question (front):");
  if (!front) return;

  const back = prompt("Enter the answer (back):");
  if (!back) return;

  const newCard = {
    id: flashcards.length,
    front: front.trim(),
    back: back.trim(),
    ef: 2.5,
    interval: 0,
    repetitions: 0,
    due: Date.now()
  };

  flashcards.push(newCard);
  allFlashcards.push(newCard); // So it's available in both modes

  saveProgress(); // Store updates
if (!currentDeckName.endsWith(".csv")) {
  localStorage.setItem("deck-" + currentDeckName, JSON.stringify(allFlashcards));
}

  alert("✅ Card added!");
  showNextCard();
}

function editCurrentCard() {
  const card = flashcards[currentCardIndex];
  const newFront = prompt("Edit the question (front):", card.front);
  if (newFront === null) return; // Cancelled

  const newBack = prompt("Edit the answer (back):", card.back);
  if (newBack === null) return; // Cancelled

  card.front = newFront.trim();
  card.back = newBack.trim();

  saveProgress();
  alert("✅ Card updated!");
  showNextCard();
}
function exportDeck() {
  if (!allFlashcards.length) {
    alert("⚠️ No deck loaded yet.");
    return;
  }

  const csvRows = [["Front", "Back"]];
  allFlashcards.forEach(card => {
    const front = `"${card.front.replace(/"/g, '""')}"`;
    const back = `"${card.back.replace(/"/g, '""')}"`;
    csvRows.push([front, back].join(","));
  });

  const csvContent = csvRows.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = currentDeckName.replace(/\.csv$/, "_Export.csv");
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
function chooseDeck() {
  openDeckSelector();
}

function createDeck() {
  const name = prompt("Enter a name for your new deck (e.g., Science.csv):");
  if (!name) return;
  const trimmedName = name.trim();

  currentDeckName = trimmedName;
  allFlashcards = [];
  flashcards = [];

  // Save an empty array to localStorage for this deck
  localStorage.setItem("deck-" + trimmedName, JSON.stringify([]));

  alert(`🆕 New deck "${trimmedName}" created. Add cards and then export.`);
}

function openDeckSelector() {
  const modal = document.getElementById("deck-modal");
  const dropdown = document.getElementById("deck-dropdown");

  // Clear existing options
  dropdown.innerHTML = "";

  // GitHub repo directory listing (requires JSON API)
  fetch("https://api.github.com/repos/lexington1988/flashcards/contents")
    .then(res => res.json())
    .then(files => {
      const csvFiles = files.filter(file => file.name.endsWith(".csv"));

      if (csvFiles.length === 0) {
        const option = document.createElement("option");
        option.textContent = "No decks found";
        option.disabled = true;
        dropdown.appendChild(option);
        return;
      }

      csvFiles.forEach(file => {
        const option = document.createElement("option");
        option.value = file.name;
        option.textContent = file.name;
        dropdown.appendChild(option);
      });
    })
    .catch(err => {
      console.error("Failed to load decks:", err);
      const option = document.createElement("option");
      option.textContent = "Error loading decks";
      option.disabled = true;
      dropdown.appendChild(option);
    });

  modal.classList.remove("hidden");
  modal.style.display = "flex";
}

function closeDeckSelector() {
  document.getElementById("deck-modal").classList.add("hidden");
}

function confirmDeckSelection() {
  const selected = document.getElementById("deck-dropdown").value;
  currentDeckName = selected;
  alert(`✅ Selected deck: ${currentDeckName}`);
  closeDeckSelector();
}
function deleteDeck() {
  if (currentDeckName.endsWith(".csv")) {
    alert("❌ Cannot delete GitHub decks from the app.");
    return;
  }

  if (confirm(`Are you sure you want to delete "${currentDeckName}"? This cannot be undone.`)) {
    localStorage.removeItem("deck-" + currentDeckName);
    alert("🗑️ Deck deleted. Reloading...");
    location.reload();
  }
}
function makePersistentCopy() {
  if (!allFlashcards.length) {
    alert("⚠️ No deck loaded yet.");
    return;
  }

  const newName = currentDeckName.replace(/\.csv$/, " (Local)");
  localStorage.setItem("deck-" + newName, JSON.stringify(allFlashcards));
  currentDeckName = newName;

  alert(`✅ Persistent copy saved as "${newName}"`);
}

