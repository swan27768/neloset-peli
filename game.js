const WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbyurfZtIZBHsZw3hBmmwEHoxItINPs42spQgDPj0Povq4lwYjP1FQihv4sX2xKDbq8pcQ/exec";
const GAME_ID = "kilpailu1";

let gameStarted = false;
let timerInterval = null;

const PUZZLE = {
  groups: [
    { name: "ELÄIMET", words: ["kissa", "koira", "lehmä", "hevonen"] },
    { name: "VÄRIT", words: ["punainen", "sininen", "vihreä", "keltainen"] },
    { name: "SÄÄ", words: ["sade", "lumi", "tuuli", "pouta"] },
    { name: "KOULU", words: ["kynä", "vihko", "reppu", "kumi"] },
  ],
};

function startGame() {
  const name = document.getElementById("playerName").value.trim();
  if (!name) {
    setStatus("Syötä nimesi ennen pelin aloittamista.");
    return;
  }

  gameStarted = true;
  startTime = Date.now();

  // käynnistä ajastin
  timerInterval = setInterval(() => {
    const seconds = Math.floor((Date.now() - startTime) / 1000);
    document.getElementById("time").textContent = seconds;
  }, 1000);

  setStatus("Peli käynnissä. Onnea!");
  resetGame();
}

let allWords = [];
let selected = new Set();
let solvedGroups = new Set();
let hintsLeft = 2;
let startTime = 0;
let hintsUsed = 0;

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildBoard() {
  allWords = shuffle(PUZZLE.groups.flatMap((g) => g.words));
}

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
      if (selected.has(word)) selected.delete(word);
      else if (selected.size < 4) selected.add(word);

      render();
    };

    grid.appendChild(tile);
  });
}

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
    setStatus("Väärä ryhmä.");
    selected.clear();
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

function endGame() {
  clearInterval(timerInterval);

  const timeUsed = Math.floor((Date.now() - startTime) / 1000);
  const score = timeUsed + hintsUsed * 20;

  setStatus(
    `Valmis! Aika: ${timeUsed}s | Vihjeet: ${hintsUsed} | Pisteet: ${score}`,
  );

  saveResult(score, timeUsed);
}

function saveResult(score, timeUsed) {
  const name = document.getElementById("playerName").value.trim();
  if (!name) {
    setStatus("Syötä nimi ennen tuloksen tallennusta.");
    return;
  }

  // Jos saveResultia kutsutaan ilman parametreja, laske ne tässä
  if (typeof timeUsed !== "number" || Number.isNaN(timeUsed)) {
    timeUsed = Math.floor((Date.now() - startTime) / 1000);
  }
  if (typeof score !== "number" || Number.isNaN(score)) {
    score = timeUsed + hintsUsed * 20;
  }

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

  // Beacon-tyylinen lähetys (CORS ei blokkaa)
  const img = new Image();
  img.onload = () => {
    setStatus("Tulos lähetetty!");
    loadLeaderboard();
  };
  img.onerror = () => {
    // Tallennus voi silti mennä perille vaikka onerror laukeaa,
    // mutta ilmoitetaan varmuuden vuoksi.
    setStatus("Tulos lähetetty (tarkista leaderboard).");
    loadLeaderboard();
  };
  img.src = url + "&_=" + Date.now(); // cache-buster
}

function loadLeaderboard() {
  const cbName = "cb_" + Date.now() + "_" + Math.floor(Math.random() * 1e6);

  window[cbName] = function (data) {
    try {
      let html = "<table><tr><th>Sija</th><th>Nimi</th><th>Pisteet</th></tr>";
      data.forEach((r, i) => {
        html += `<tr><td>${i + 1}</td><td>${r.name}</td><td>${r.score}</td></tr>`;
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
  script.onerror = () => {
    setStatus("Leaderboard ei latautunut (verkko tai URL).");
    delete window[cbName];
    script.remove();
  };
  document.body.appendChild(script);
}

function setStatus(text) {
  document.getElementById("status").textContent = text;
}

function resetGame() {
  startTime = Date.now();
  hintsLeft = 2;
  hintsUsed = 0;
  selected.clear();
  solvedGroups.clear();
  buildBoard();
  setStatus("");
  render();
}

resetGame();
loadLeaderboard();
