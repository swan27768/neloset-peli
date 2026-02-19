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

// 🔥 TÄMÄ EI SAA OLLA CONST
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
let timerInterval = null;

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
  console.log("▶ startGame called");

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

  console.log("Haetaan sanalistat...");

  loadPuzzlesFromSheet(() => {
    console.log("Sanalistat ladattu:", PUZZLE_POOL);

    if (!PUZZLE_POOL.length) {
      setStatus("Sanasettejä ei löytynyt.");
      return;
    }

    shuffledPuzzles = shuffle([...PUZZLE_POOL]);

    if (totalRounds > shuffledPuzzles.length) {
      totalRounds = shuffledPuzzles.length;
    }

    console.log("Aloitetaan erä 1");
    startRound();
  });
}

function loadPuzzlesFromSheet(callback) {
  const cbName = "puzzle_cb_" + Date.now();
  const script = document.createElement("script");

  window[cbName] = function (data) {
    console.log("JSONP callback saatu:", data);

    PUZZLE_POOL = data; // nyt sallittu

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
  console.log("▶ startRound", currentRound);

  const puzzle = shuffledPuzzles[currentRound - 1];

  if (!puzzle) {
    console.log("Ei puzzlea löytynyt");
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
  console.log("Rakennetaan lauta");

  allWords = shuffle(PUZZLE.groups.flatMap((g) => g.words));
}

/* =========================
   RENDER
========================= */

function render() {
  console.log("Render");

  document.getElementById("hints").textContent = hintsLeft;

  const grid = document.getElementById("grid");
  grid.innerHTML = "";

  allWords.forEach((word) => {
    const groupIndex = PUZZLE.groups.findIndex((g) => g.words.includes(word));

    if (solvedGroups.has(groupIndex)) return;

    const tile = document.createElement("div");
    tile.className = "tile";

    if (selected.has(word)) tile.classList.add("selected");

    tile.textContent = word;

    tile.onclick = () => {
      if (!gameStarted) return;

      if (selected.has(word)) selected.delete(word);
      else if (selected.size < 4) selected.add(word);

      render();
    };

    grid.appendChild(tile);
  });
}

/* =========================
   TARKISTUS
========================= */

function checkSelection() {
  console.log("Tarkistetaan valinta");

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
  console.log("Erä päättyi");

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
  console.log("Turnaus päättyi");

  tournamentActive = false;
  gameStarted = false;

  setStatus(`Turnaus päättyi! Kokonaispisteet: ${totalScore}`);

  saveResult(totalScore, totalScore);
}

/* =========================
   TULOSTEN HAKU
========================= */

function loadLeaderboard() {
  console.log("Haetaan leaderboard");

  const cbName = "cb_" + Date.now();
  const script = document.createElement("script");

  window[cbName] = function (data) {
    console.log("Leaderboard data:", data);

    let html = "<table><tr><th>Sija</th><th>Nimi</th><th>Pisteet</th></tr>";

    data.forEach((r, i) => {
      html += `<tr>
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

/* INIT */
loadLeaderboard();
