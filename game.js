const WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbwhoeuTPctryeDdoJnVLfTAdVVwzgNNGYe0wRV4SwrruprUagDcwNHwxj-G_uWSvwyO9w/exec";

const GAME_ID = "kilpailu1";

/* =========================
   KONFIGURAATIO (const)
========================= */
const DEFAULT_ROUNDS = 3;
const HINT_PENALTY = 20;
const HINTS_PER_ROUND = 2;

/* =========================
   SANALISTA / PUZZLE POOL
========================= */

const PUZZLE_POOL = [
  {
    groups: [
      { name: "ELÄIMET", words: ["kissa", "koira", "lehmä", "hevonen"] },
      { name: "VÄRIT", words: ["punainen", "sininen", "vihreä", "keltainen"] },
      { name: "SÄÄ", words: ["sade", "lumi", "tuuli", "pouta"] },
      { name: "KOULU", words: ["kynä", "vihko", "reppu", "kumi"] },
    ],
  },
];
let PUZZLE = { groups: [] };

let allWords = [];
let selected = new Set();
let solvedGroups = new Set();
let hintsLeft = HINTS_PER_ROUND;
let hintsUsed = 0;

let gameStarted = false;
let startTime = 0;
let timerInterval = null;

let totalRounds = 3; // Opettaja määrittää
let currentRound = 1;

let roundScore = 0;
let totalScore = 0;

let shuffledPuzzles = [];

/* -------------------- Utility -------------------- */

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function setStatus(text) {
  document.getElementById("status").textContent = text;
}
/* =========================
   GAME FLOW (Turnaus)
========================= */
function startGame() {
  const name = document.getElementById("playerName").value.trim();
  if (!name) {
    setStatus("Syötä nimesi ennen pelin aloittamista.");
    return;
  }

  gameStarted = true;

  totalRounds =
    Number(document.getElementById("roundCount").value) || DEFAULT_ROUNDS;

  currentRound = 1;
  totalScore = 0;

  // 🔹 ESTÄÄ TOISTON
  shuffledPuzzles = shuffle([...PUZZLE_POOL]);

  if (totalRounds > shuffledPuzzles.length) {
    totalRounds = shuffledPuzzles.length;
  }

  startRound();
}

function startRound() {
  loadRandomPuzzle();

  selected.clear();
  solvedGroups.clear();
  hintsLeft = HINTS_PER_ROUND;
  hintsUsed = 0;
  startTime = Date.now();

  buildBoard();
  render();

  setStatus(`Erä ${currentRound} / ${totalRounds}`);
}
function loadRandomPuzzle() {
  const puzzle = shuffledPuzzles[currentRound - 1];

  if (!puzzle) {
    setStatus("Ei tarpeeksi sanasettejä.");
    return;
  }

  PUZZLE.groups = puzzle.groups;
}

function showBreakScreen() {
  document.getElementById("grid").innerHTML = `<div class="break-screen">
      <h2>Erä valmis</h2>
      <p>Kokonaispisteet: ${totalScore}</p>
      <button onclick="startRound()">Seuraava erä</button>
    </div>`;
}

function endGame() {
  const timeUsed = Math.floor((Date.now() - startTime) / 1000);
  const score = timeUsed + hintsUsed * 20;

  roundScore = score;
  totalScore += roundScore;

  setStatus(
    `Erä ${currentRound} valmis!
     Eräpisteet: ${roundScore}
     Kokonaispisteet: ${totalScore}`,
  );

  if (currentRound >= totalRounds) {
    endTournament();
  } else {
    currentRound++;
    showBreakScreen();
  }
}
function endTournament() {
  tournamentActive = false;

  setStatus(
    `Turnaus päättyi!
     Kokonaispisteet: ${totalScore}`,
  );

  saveResult(totalScore, totalScore);
}

/* -------------------- Game Setup -------------------- */

function buildBoard() {
  allWords = shuffle(PUZZLE.groups.flatMap((g) => g.words));
}

function resetGame() {
  selected.clear();
  solvedGroups.clear();
  hintsLeft = HINTS_PER_ROUND;
  hintsUsed = 0;

  buildBoard();
  render();
}

/* -------------------- Rendering -------------------- */

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
      if (!gameStarted) {
        setStatus("Kirjaudu ensin peliin.");
        return;
      }

      if (selected.has(word)) selected.delete(word);
      else if (selected.size < 4) selected.add(word);

      render();
    };

    grid.appendChild(tile);
  });
}

/* -------------------- Game Logic -------------------- */

function checkSelection() {
  if (!gameStarted) {
    setStatus("Kirjaudu ensin peliin.");
    return;
  }

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
      endGame();
    }
  } else {
    selected.clear();
    setStatus("Väärä ryhmä.");
  }

  render();
}

function giveHint() {
  if (!gameStarted) {
    setStatus("Kirjaudu ensin peliin.");
    return;
  }

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

  setStatus("Kaksi sanaa paljastettu.");
  render();
}

/* -------------------- Save Result (No CORS) -------------------- */

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
  img.onload = () => loadLeaderboard();
  img.src = url + "&_=" + Date.now();
}

/* -------------------- Leaderboard (JSONP) -------------------- */

function loadLeaderboard() {
  const cbName = "cb_" + Date.now() + "_" + Math.floor(Math.random() * 1e6);

  window[cbName] = function (data) {
    try {
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
    } finally {
      delete window[cbName];
      script.remove();
    }
  };

  const script = document.createElement("script");
  script.src = WEBAPP_URL + "?callback=" + cbName + "&_=" + Date.now();
  document.body.appendChild(script);
}

/* -------------------- Initial Load -------------------- */

loadLeaderboard();
