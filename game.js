/* =========================
   KONFIGURAATIO
========================= */

const WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbzYsp-fhv4lzHAZrKZ4QpIfhxinawoO6NdbkyMoSs1qlYQ8SMNUrOk76omfGkmaDxvu/exec";

const GAME_ID = "kilpailu1";

const HINT_PENALTY = 20;
const HINTS_PER_ROUND = 2;

const LEADERBOARD_REFRESH_MS = 3000; // 3 sekuntia
let leaderboardInterval = null;

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
  const name = document.getElementById("playerName").value.trim();
  if (!name) {
    setStatus("Syötä nimesi ennen pelin aloittamista.");
    return;
  }

  gameStarted = true;
  currentRound = 1;
  totalScore = 0;

  loadPuzzlesFromSheet(() => {
    if (!PUZZLE_POOL.length) {
      setStatus("Sanasettejä ei löytynyt.");
      return;
    }

    shuffledPuzzles = shuffle([...PUZZLE_POOL]);
    startRound();
  });
}

function loadPuzzlesFromSheet(callback) {
  const cbName = "puzzle_cb_" + Date.now();
  const script = document.createElement("script");

  window[cbName] = function (data) {
    delete window[cbName];
    script.remove();

    // 🔴 Tarkistus 1: pitää olla array
    if (!Array.isArray(data)) {
      console.error("Virheellinen puzzles-data:", data);
      setStatus("Sanasettien lataus epäonnistui.");
      return;
    }

    const valid = data.every((p) => p && Array.isArray(p.groups));

    if (!valid) {
      console.error("Sanasettien rakenne virheellinen:", data);
      setStatus("Sanasettien rakenne virheellinen.");
      return;
    }

    PUZZLE_POOL = data;

    if (callback) callback();
  };

  script.onerror = function () {
    delete window[cbName];
    script.remove();
    console.error("Puzzle JSONP lataus epäonnistui.");
    setStatus("Sanasettien lataus epäonnistui.");
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

  if (!puzzle || !Array.isArray(puzzle.groups)) {
    setStatus("Sanasetti virheellinen.");
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

  setStatus(`Erä ${currentRound} / ${shuffledPuzzles.length}`);
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

  if (currentRound >= shuffledPuzzles.length) {
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
    // Anna Apps Scriptin kirjoittaa Sheettiin
    setTimeout(() => {
      loadLeaderboard();
    }, 800);
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
    try {
      let html = "<table><tr><th>Sija</th><th>Nimi</th><th>Aika</th></tr>";

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
    } finally {
      delete window[cbName];
      script.remove();
    }
  };

  script.src = WEBAPP_URL + "?callback=" + cbName + "&_=" + Date.now();
  document.body.appendChild(script);
}
/* =========================
   RESET
========================= */

function resetGame() {
  gameStarted = false;
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
setInterval(loadLeaderboard, 5000);
