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
   TURNauksen KÄYNNISTYS
========================= */

function startGame() {
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

  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const seconds = Math.floor((Date.now() - startTime) / 1000);
    document.getElementById("time").textContent = seconds;
  }, 1000);
}

/* =========================
   BREAK SCREEN
========================= */

function showBreakScreen() {
  document.getElementById("grid").innerHTML = `
    <div class="break-screen">
      <h2>Erä ${currentRound - 1} valmis</h2>
      <p>Kokonaispisteet: ${totalScore}</p>
      <button onclick="startRound()">Seuraava erä</button>
    </div>
  `;
}

/* =========================
   ERÄN LOPPU
========================= */

function endRound() {
  clearInterval(timerInterval);

  const timeUsed = Math.floor((Date.now() - startTime) / 1000);
  const score = timeUsed + hintsUsed * HINT_PENALTY;

  totalScore += score;

  if (currentRound >= totalRounds) {
    endTournament();
  } else {
    currentRound++;
    showBreakScreen();
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
   TULOKSEN TALLENNUS (NO CORS)
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
  img.onload = () => loadLeaderboard();
  img.src = url + "&_=" + Date.now();
}

/* =========================
   LEADERBOARD (JSONP)
========================= */

function loadLeaderboard() {
  const cbName = "cb_" + Date.now();

  const script = document.createElement("script");

  window[cbName] = function (data) {
    try {
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
    } finally {
      delete window[cbName];
      script.remove();
    }
  };

  script.src = WEBAPP_URL + "?callback=" + cbName + "&_=" + Date.now();

  document.body.appendChild(script);
}

/* =========================
   INIT
========================= */

loadLeaderboard();
