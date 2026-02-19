/* =========================
   KONFIGURAATIO
========================= */

const WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbyO_GR0rAvKD-T2sNEQs83EEgKoCZBIsF4STWe49tInoqzGVuheOvKlVsRLNVziqweL0w/exec";

const GAME_ID = "kilpailu1";

const DEFAULT_ROUNDS = 3;
const HINT_PENALTY = 20;
const HINTS_PER_ROUND = 2;

/* =========================
   SANASETIT
========================= */

let PUZZLE_POOL = [];
let PUZZLE = { groups: [] };

/* =========================
   PELITILA
========================= */

let allWords = [];
let selected = new Set();
let solvedGroups = new Set();

let hintsLeft = HINTS_PER_ROUND;
let hintsUsed = 0;

let gameStarted = false;
let tournamentActive = false;

let totalRounds = DEFAULT_ROUNDS;
let currentRound = 1;
let totalScore = 0;

let startTime = 0;

let shuffledPuzzles = [];

/* =========================
   UTIL
========================= */

function shuffle(a) {
  return a.sort(() => Math.random() - 0.5);
}

function setStatus(text) {
  document.getElementById("status").textContent = text;
}

/* =========================
   TURNauksen KÄYNNISTYS
========================= */

function startGame() {
  totalRounds = Number(document.getElementById("roundCount").value);
  console.log("Erien määrä:", totalRounds);

  const name = document.getElementById("playerName").value.trim();
  if (!name) {
    setStatus("Syötä nimesi ennen pelin aloittamista.");
    return;
  }

  totalRounds =
    Number(document.getElementById("roundCount").value) || DEFAULT_ROUNDS;

  gameStarted = true;
  tournamentActive = true;
  currentRound = 1;
  totalScore = 0;

  loadPuzzlesFromSheet(() => {
    if (!PUZZLE_POOL.length) {
      setStatus("Sanasettejä ei löytynyt.");
      return;
    }

    shuffledPuzzles = shuffle([...PUZZLE_POOL]);

    if (totalRounds > shuffledPuzzles.length) {
      totalRounds = shuffledPuzzles.length;
    }

    startRound();
  });
}

function loadPuzzlesFromSheet(callback) {
  const cbName = "puzzle_cb_" + Date.now();
  const script = document.createElement("script");

  window[cbName] = function (data) {
    PUZZLE_POOL = data;
    delete window[cbName];
    script.remove();
    if (callback) callback();
  };

  script.src =
    WEBAPP_URL + "?action=puzzles&callback=" + cbName + "&_=" + Date.now();

  document.body.appendChild(script);
}

/* =========================
   ERÄN ALOITUS
========================= */

function startRound() {
  const puzzle = shuffledPuzzles[currentRound - 1];

  if (!puzzle) {
    setStatus("Ei tarpeeksi sanasettejä.");
    return;
  }

  PUZZLE.groups = puzzle.groups;

  selected.clear();
  solvedGroups.clear();
  hintsLeft = HINTS_PER_ROUND;
  hintsUsed = 0;

  startTime = Date.now();

  buildBoard();
  render();

  setStatus(`Erä ${currentRound} / ${totalRounds}`);
}

/* =========================
   LAUDAN RAKENNUS
========================= */

function buildBoard() {
  allWords = shuffle(PUZZLE.groups.flatMap((g) => g.words));
}

/* =========================
   RENDER
========================= */
function render() {
  document.getElementById("hints").textContent = hintsLeft;

  // 1️⃣ Ratkaistut rivit
  const solvedArea = document.getElementById("solvedArea");
  solvedArea.innerHTML = "";

  solvedGroups.forEach((groupIndex) => {
    const row = document.createElement("div");
    row.className = "solved-row";
    row.textContent =
      PUZZLE.groups[groupIndex].name +
      " – " +
      PUZZLE.groups[groupIndex].words.join(", ");
    solvedArea.appendChild(row);
  });

  // 2️⃣ Ruudukko
  const grid = document.getElementById("grid");
  grid.innerHTML = "";

  allWords.forEach((word) => {
    const groupIndex = PUZZLE.groups.findIndex((g) => g.words.includes(word));

    // Älä näytä ratkaistuja sanoja uudestaan
    if (solvedGroups.has(groupIndex)) return;

    const tile = document.createElement("div");
    tile.className = "tile";

    if (selected.has(word)) {
      tile.classList.add("selected");
    }

    tile.textContent = word;

    tile.onclick = () => {
      if (!gameStarted) return;

      if (selected.has(word)) {
        selected.delete(word);
      } else if (selected.size < 4) {
        selected.add(word);
      }

      render();
    };

    grid.appendChild(tile);
  });
}

/* =========================
   TARKISTUS
========================= */

function checkSelection() {
  if (!gameStarted) return;

  if (selected.size !== 4) {
    setStatus("Valitse neljä sanaa.");
    return;
  }

  const words = [...selected];

  const groupIndex = PUZZLE.groups.findIndex((g) =>
    words.every((w) => g.words.includes(w)),
  );

  if (groupIndex !== -1) {
    solvedGroups.add(groupIndex);
    selected.clear();
    setStatus("Oikein!");

    if (solvedGroups.size === PUZZLE.groups.length) {
      endRound();
    }
  } else {
    selected.clear();
    setStatus("Väärä ryhmä.");
  }

  render();
}

/* =========================
   ERÄN LOPPU
========================= */

function endRound() {
  const timeUsed = Math.floor((Date.now() - startTime) / 1000);
  const score = timeUsed + hintsUsed * HINT_PENALTY;

  totalScore += score;

  if (currentRound >= totalRounds) {
    endTournament();
  } else {
    currentRound++;
    startRound();
  }
}

/* =========================
   TURNAUKSEN LOPPU
========================= */

function endTournament() {
  tournamentActive = false;
  gameStarted = false;

  setStatus(`Turnaus päättyi! Kokonaispisteet: ${totalScore}`);

  saveResult(totalScore, totalScore);
}

/* =========================
   VIHJE
========================= */

function giveHint() {
  if (!gameStarted) return;

  if (hintsLeft <= 0) {
    setStatus("Ei vihjeitä jäljellä.");
    return;
  }

  const remaining = PUZZLE.groups
    .map((_, i) => i)
    .filter((i) => !solvedGroups.has(i));

  if (!remaining.length) return;

  const randomGroup = remaining[Math.floor(Math.random() * remaining.length)];

  const words = PUZZLE.groups[randomGroup].words;

  selected.clear();
  selected.add(words[0]);
  selected.add(words[1]);

  hintsLeft--;
  hintsUsed++;

  render();
}

/* =========================
   TULOKSEN TALLENNUS
========================= */

function saveResult(score, timeUsed) {
  const name = document.getElementById("playerName").value.trim();
  if (!name) return;

  const url =
    WEBAPP_URL +
    "?name=" +
    encodeURIComponent(name) +
    "&tries=0" +
    "&gameId=" +
    encodeURIComponent(GAME_ID) +
    "&timeSeconds=" +
    encodeURIComponent(timeUsed) +
    "&score=" +
    encodeURIComponent(score);

  const img = new Image();
  img.onload = () => {
    // odota hetki että Sheet ehtii päivittyä
    setTimeout(loadLeaderboard, 500);
  };
  img.src = url + "&_=" + Date.now();
}

/* =========================
   LEADERBOARD
========================= */

function loadLeaderboard() {
  const cbName = "cb_" + Date.now();
  const script = document.createElement("script");

  window[cbName] = function (data) {
    let html = "<table><tr><th>Sija</th><th>Nimi</th><th>Pisteet</th></tr>";

    data.forEach((r, i) => {
      html += `
        <tr>
          <td>${i + 1}</td>
          <td>${r.name}</td>
          <td>${r.score}</td>
        </tr>`;
    });

    html += "</table>";

    document.getElementById("resultsArea").innerHTML = html;

    delete window[cbName];
    script.remove();
  };

  script.src = WEBAPP_URL + "?callback=" + cbName + "&_=" + Date.now();
  document.body.appendChild(script);
}

/* =========================
   RESET
========================= */

function resetGame() {
  gameStarted = false;
  tournamentActive = false;
  currentRound = 1;
  totalScore = 0;

  selected.clear();
  solvedGroups.clear();

  hintsLeft = HINTS_PER_ROUND;
  hintsUsed = 0;

  setStatus("Peli nollattu.");
  document.getElementById("grid").innerHTML = "";
}

/* =========================
   INIT
========================= */

loadLeaderboard();
