const WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbyNnQJe42-Bg4hYZMW7QyLoe6f8lWiGQP8qjbdcUF1PWl3TABpL4ZhE_R2o-HT34gKAfg/exec";

const GAME_ID = "kilpailu1";

const PUZZLE = {
  groups: [
    { name: "ELÄIMET", words: ["kissa", "koira", "lehmä", "hevonen"] },
    { name: "VÄRIT", words: ["punainen", "sininen", "vihreä", "keltainen"] },
    { name: "SÄÄ", words: ["sade", "lumi", "tuuli", "pouta"] },
    { name: "KOULU", words: ["kynä", "vihko", "reppu", "kumi"] },
  ],
};

let allWords = [];
let selected = new Set();
let solvedGroups = new Set();
let hintsLeft = 2;
let hintsUsed = 0;

let gameStarted = false;
let startTime = 0;
let timerInterval = null;

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

/* -------------------- Game Setup -------------------- */

function buildBoard() {
  allWords = shuffle(PUZZLE.groups.flatMap((g) => g.words));
}

function resetGame() {
  selected.clear();
  solvedGroups.clear();
  hintsLeft = 2;
  hintsUsed = 0;

  buildBoard();
  render();
}

function startGame() {
  const name = document.getElementById("playerName").value.trim();

  if (!name) {
    setStatus("Syötä nimesi ennen pelin aloittamista.");
    return;
  }

  gameStarted = true;
  startTime = Date.now();

  if (timerInterval) clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    const seconds = Math.floor((Date.now() - startTime) / 1000);
    document.getElementById("time").textContent = seconds;
  }, 1000);

  resetGame();
  setStatus("Peli käynnissä. Onnea!");
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

/* -------------------- End Game -------------------- */

function endGame() {
  clearInterval(timerInterval);

  const timeUsed = Math.floor((Date.now() - startTime) / 1000);
  const score = timeUsed + hintsUsed * 20;

  setStatus(
    `Valmis! Aika: ${timeUsed}s | Vihjeet: ${hintsUsed} | Pisteet: ${score}`,
  );

  saveResult(score, timeUsed);
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
