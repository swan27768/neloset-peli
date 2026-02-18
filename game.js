const WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbwu4TRfSyaetBUPAXkn0w9lrtbV4xSM8_nT8DEqESscMxBJv6L2YvEWbJ7QDyv4k1fOew/exec";
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
  const timeUsed = Math.floor((Date.now() - startTime) / 1000);

  const score = timeUsed + hintsUsed * 20;

  setStatus("Valmis! Aika: " + timeUsed + " s | Pisteet: " + score);

  saveResult(score, timeUsed);
}

function saveResult(score, timeUsed) {
  const name = document.getElementById("playerName").value.trim();

  if (!name) {
    setStatus("Syötä nimi ennen tuloksen tallennusta.");
    return;
  }

  const url =
    WEBAPP_URL +
    "?name=" +
    encodeURIComponent(name) +
    "&tries=0" +
    "&gameId=" +
    GAME_ID +
    "&timeSeconds=" +
    timeUsed +
    "&score=" +
    score;

  fetch(url).then(() => loadLeaderboard());
}

function loadLeaderboard() {
  console.log("Fetching from:", WEBAPP_URL);
  fetch(WEBAPP_URL)
    .then((res) => res.json())
    .then((data) => {
      let html = "<table><tr><th>Sija</th><th>Nimi</th><th>Pisteet</th></tr>";
      data.forEach((r, i) => {
        html += `<tr><td>${i + 1}</td><td>${r.name}</td><td>${r.score}</td></tr>`;
      });
      html += "</table>";
      document.getElementById("resultsArea").innerHTML = html;
    });
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
