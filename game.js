import { db } from "./firebase.js";
import { ref, set, get, onValue, update, remove } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

const createBtn = document.getElementById("createRoom");
const joinBtn = document.getElementById("joinRoom");
const startBtn = document.getElementById("startGame");
const newGameBtn = document.getElementById("newGame");
const roomInput = document.getElementById("roomCode");
const nameInput = document.getElementById("nameInput");
const nameError = document.getElementById("nameError");
const codeError = document.getElementById("codeError");
const setupDiv = document.getElementById("setup");
const gameBoard = document.getElementById("gameBoard");
const roomDisplay = document.getElementById("roomDisplay");
const cardsContainer = document.getElementById("cards");
const playerCountDisplay = document.getElementById("playerCount");
const timerDisplay = document.getElementById("timerDisplay");
const winnerBanner = document.getElementById("winnerBanner");
const helperText = document.getElementById("helperText");
const hostControls = document.getElementById("hostControls");
const playerTags = document.getElementById("playerTags");
const playerStars = document.getElementById("playerStars");
const exitBtn = document.getElementById("exitRoom");
const wordListBtn = document.getElementById("wordListBtn");
const wordScreen = document.getElementById("wordScreen");
const wordListEl = document.getElementById("wordList");
const newWordInput = document.getElementById("newWordInput");
const addWordBtn = document.getElementById("addWordBtn");
const backToSetupBtn = document.getElementById("backToSetup");

const CENTER_WORD = "Queef";
const BASE_WORDS = [
  "Sprinkle Duty",
  "Thats Corny",
  "Mhmmm",
  "Is This Tuff?",
  "Goku!",
  '"The N Word"',
  "Oh We Know",
  "Hey Man",
  "Type Shit",
  "Fantum Pain",
  "Imagine If...",
  "Joseph",
  "Cmon Pussy",
  "How Sway",
  "Sabrina Carpinder",
  "I'm F*cking Sorry",
  "Erm Erm Erm",
  "Okay Buddy",
  "Or Sum Shit Like That",
  "Mexican Town Bakery",
  "Hell'a Funny",
  "BOY FRIEND!",
  "Adopted",
  "R U Mad At Me"
];

const GRID_SIZE = 5;
const TOTAL_CELLS = GRID_SIZE * GRID_SIZE;
const CENTER_INDEX = Math.floor(TOTAL_CELLS / 2);
const CUSTOM_WORDS_KEY = "eliasCustomWords";

const playerId = (() => {
  const stored = localStorage.getItem("eliasPlayerId");
  if (stored) return stored;
  const generated = crypto.randomUUID();
  localStorage.setItem("eliasPlayerId", generated);
  return generated;
})();
let playerName = localStorage.getItem("eliasPlayerName") || "";
if (playerName) nameInput.value = playerName;

let currentRoom = null;
let currentRoomData = null;
let isHost = false;
let detachRoomListener = null;
let timerInterval = null;
let lastWinnerId = null;
let currentWinnerStarsShown = false;
let customWords = loadCustomWords();

function randomCode() {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
}

function shuffle(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function generateBoard() {
  const shuffled = shuffle(getWordPool());
  const board = [];
  for (let i = 0; i < TOTAL_CELLS; i++) {
    if (i === CENTER_INDEX) {
      board.push(CENTER_WORD);
    } else {
      board.push(shuffled.pop() || CENTER_WORD);
    }
  }
  return board;
}

function ensureName() {
  const name = nameInput.value.trim();
  if (!name) {
    showError(nameInput, nameError, "Name is required to create or join.");
    nameInput.focus();
    return null;
  }
  hideError(nameInput, nameError);
  playerName = name;
  localStorage.setItem("eliasPlayerName", name);
  return name;
}

createBtn.onclick = async () => {
  clearErrors();
  const name = ensureName();
  if (!name) return;
  const code = randomCode();
  const playerData = buildPlayerPayload(name);
  await set(ref(db, "gameRooms/" + code), {
    createdAt: Date.now(),
    status: "waiting",
    hostId: playerId,
    startTime: null,
    winner: null,
    players: {
      [playerId]: playerData
    }
  });
  isHost = true;
  currentRoom = code;
  hideSetup();
  enterRoom(code);
};

joinBtn.onclick = async () => {
  clearErrors();
  const name = nameInput.value.trim();
  const code = roomInput.value.trim().toUpperCase();
  let hasError = false;

  if (!name) {
    showError(nameInput, nameError, "Name is required to join.");
    hasError = true;
  } else {
    playerName = name;
    localStorage.setItem("eliasPlayerName", name);
  }

  if (!code) {
    showError(roomInput, codeError, "Room code is required to join.");
    hasError = true;
  }

  if (hasError) {
    (!name ? nameInput : roomInput).focus();
    return;
  }

  const snapshot = await get(ref(db, "gameRooms/" + code));
  if (!snapshot.exists()) {
    showError(roomInput, codeError, "Room not found.");
    roomInput.focus();
    return;
  }

  const roomData = snapshot.val();
  const existingPlayer = roomData.players?.[playerId];
  if (existingPlayer) {
    await update(ref(db, `gameRooms/${code}/players/${playerId}`), {
      name
    });
  } else {
    await set(ref(db, `gameRooms/${code}/players/${playerId}`), buildPlayerPayload(name));
  }

  isHost = roomData.hostId === playerId;
  currentRoom = code;
  hideSetup();
  enterRoom(code);
};

startBtn.onclick = async () => {
  if (!currentRoom || !isHost) return;
  await update(ref(db, "gameRooms/" + currentRoom), {
    status: "active",
    startTime: Date.now()
  });
};

newGameBtn.onclick = () => {
  if (!currentRoom || !isHost) return;
  if (!currentRoomData?.players) return;
  const nextPlayers = {};
  Object.entries(currentRoomData.players).forEach(([id, info]) => {
    nextPlayers[id] = {
      ...info,
      board: generateBoard(),
      marks: Array(TOTAL_CELLS).fill(false)
    };
  });
  update(ref(db, "gameRooms/" + currentRoom), {
    status: "waiting",
    winner: null,
    startTime: null,
    players: nextPlayers
  })
    .then(() => {
      stopTimer();
      helperText.innerText = "Waiting to start. Host can start the timer.";
    })
    .catch(err => {
      console.error("Failed to start new game", err);
      alert("Could not start a new game. Please try again.");
    });
};

wordListBtn.onclick = () => {
  renderWordList();
  showWordScreen();
};

backToSetupBtn.onclick = () => {
  hideWordScreen();
};

addWordBtn.onclick = () => {
  const word = newWordInput.value.trim();
  if (!word) return;
  if (word.toLowerCase() === CENTER_WORD.toLowerCase()) {
    alert("Center word is fixed and cannot be added.");
    return;
  }
  const pool = getWordPool().map(w => w.toLowerCase());
  if (pool.includes(word.toLowerCase())) {
    alert("That word already exists.");
    return;
  }
  customWords.push(word);
  saveCustomWords();
  newWordInput.value = "";
  renderWordList();
};

exitBtn.onclick = async () => {
  await leaveRoom();
};

function enterRoom(code) {
  hideSetup();
  gameBoard.classList.remove("hidden");
  roomDisplay.innerText = "Room Code: " + code;

  if (detachRoomListener) detachRoomListener();
  detachRoomListener = onValue(ref(db, "gameRooms/" + code), snapshot => {
    const data = snapshot.val();
    currentRoomData = data;
    if (!data) {
      helperText.innerText = "Room closed or missing.";
      return;
    }
    renderRoom(data);
  });
}

function renderRoom(data) {
  const players = data.players || {};
  const me = players[playerId];
  const playerCount = Object.keys(players).length;
  playerCountDisplay.innerText = "Players: " + playerCount;
  const isWaiting = data.status === "waiting";
  helperText.setAttribute("data-waiting", isWaiting ? "true" : "false");
  helperText.innerText =
    data.status === "waiting"
      ? "Waiting for host to start the game"
      : data.status === "active"
      ? "Tap squares to mark your board."
      : "Game finished. Host can start a new game.";

  hostControls.classList.toggle("hidden", !isHost);
  startBtn.classList.toggle("hidden", data.status !== "waiting");
  startBtn.disabled = data.status !== "waiting";
  newGameBtn.classList.toggle("hidden", data.status !== "finished");

  renderPlayerTags(players);
  if (data.winner) {
    winnerBanner.classList.remove("hidden");
    const winnerName = data.winner.name || "Someone";
    winnerBanner.innerText = winnerName + " called Lotería!";
    if (lastWinnerId !== data.winner.playerId || !currentWinnerStarsShown) {
      showConfetti();
      currentWinnerStarsShown = true;
    }
    lastWinnerId = data.winner.playerId;
  } else {
    winnerBanner.classList.add("hidden");
    lastWinnerId = null;
    currentWinnerStarsShown = false;
    clearConfetti();
  }

  if (data.status === "finished") {
    stopTimer();
    if (data.startTime && data.winner?.time) {
      const finalElapsed = Math.max(0, data.winner.time - data.startTime);
      timerDisplay.innerText = `Timer: ${formatElapsed(finalElapsed)} (stopped)`;
    }
  } else if (data.startTime) {
    startTimer(data.startTime);
  } else {
    stopTimer();
    timerDisplay.innerText = "Waiting to start";
  }

  renderBoard(me);
}

function renderBoard(playerData) {
  hideWordScreen();
  cardsContainer.innerHTML = "";
  if (!playerData) {
    helperText.innerText = "You are not registered in this room.";
    return;
  }

  const board = normalizeBoard(playerData.board);
  const marks = playerData.marks || Array(TOTAL_CELLS).fill(false);

  board.forEach((emoji, i) => {
    const div = document.createElement("div");
    let cls = "card";
    if (i === CENTER_INDEX) cls += " center";
    if (marks[i]) cls += " marked";
    div.className = cls;
    div.textContent = emoji;
    div.onclick = () => handleCardClick(i);
    cardsContainer.appendChild(div);
  });
  requestAnimationFrame(() => fitCardText(cardsContainer.querySelectorAll(".card")));
}

function clearErrors() {
  hideError(nameInput, nameError);
  hideError(roomInput, codeError);
}

function showError(input, errorEl, message) {
  if (!input || !errorEl) return;
  input.classList.add("invalid");
  errorEl.textContent = message;
  toggleGroupError(input, true);
}

function hideError(input, errorEl) {
  if (!input || !errorEl) return;
  input.classList.remove("invalid");
  errorEl.textContent = "";
  toggleGroupError(input, false);
}

function toggleGroupError(input, active) {
  const group = input.closest(".inputGroup");
  if (!group) return;
  group.classList.toggle("hasError", active);
}

nameInput.addEventListener("input", () => hideError(nameInput, nameError));
roomInput.addEventListener("input", () => hideError(roomInput, codeError));

function hideSetup() {
  setupDiv.classList.add("hidden");
  setupDiv.style.display = "none";
  setupDiv.setAttribute("aria-hidden", "true");
}

function showSetup() {
  setupDiv.classList.remove("hidden");
  setupDiv.style.display = "";
  setupDiv.setAttribute("aria-hidden", "false");
}

function showWordScreen() {
  if (wordScreen) wordScreen.classList.remove("hidden");
  setupDiv.classList.add("hidden");
  if (!currentRoom) gameBoard.classList.add("hidden");
}

function hideWordScreen() {
  if (wordScreen) wordScreen.classList.add("hidden");
  if (!currentRoom) {
    showSetup();
  } else {
    gameBoard.classList.remove("hidden");
  }
}

function formatElapsed(ms) {
  const minutes = Math.floor(ms / 60000)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor((ms % 60000) / 1000)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function normalizeBoard(board) {
  let result = Array.isArray(board) && board.length === TOTAL_CELLS ? [...board] : generateBoard();
  result[CENTER_INDEX] = CENTER_WORD;
  return result;
}

function getWordPool() {
  return [...BASE_WORDS, ...customWords];
}

function renderPlayerTags(players) {
  playerTags.innerHTML = "";
  if (playerStars) playerStars.innerHTML = "";
  let anyWins = false;
  const sorted = Object.entries(players).sort(([, a], [, b]) => (a.joinedAt || 0) - (b.joinedAt || 0));
  sorted.forEach(([id, info]) => {
    const tag = document.createElement("div");
    tag.className = "playerTag" + (id === playerId ? " me" : "");
    const topRow = document.createElement("div");
    topRow.className = "tagTop";
    const nameSpan = document.createElement("span");
    nameSpan.textContent = info.name || "Player";
    const countSpan = document.createElement("span");
    const markCount = (info.marks || []).filter(Boolean).length;
    countSpan.className = "pillCount";
    countSpan.textContent = markCount;
    topRow.appendChild(nameSpan);
    topRow.appendChild(countSpan);

    tag.appendChild(topRow);
    playerTags.appendChild(tag);

    if (playerStars) {
      const winsRow = document.createElement("div");
      winsRow.className = "winsRow";
      const wins = info.wins || 0;
      if (wins > 0) {
        anyWins = true;
        winsRow.textContent = "★".repeat(Math.min(wins, 20));
        playerStars.appendChild(winsRow);
      }
    }
  });

  if (playerStars) {
    playerStars.style.display = anyWins ? "flex" : "none";
  }
}

function renderWordList() {
  if (!wordListEl) return;
  wordListEl.innerHTML = "";
  const allWords = getWordPool();
  allWords.forEach(word => {
    const row = document.createElement("div");
    row.className = "wordRow";
    const text = document.createElement("span");
    text.className = "wordText";
    text.textContent = word;
    const removeBtn = document.createElement("button");
    removeBtn.className = "removeBtn";
    const isBase = BASE_WORDS.includes(word);
    removeBtn.textContent = isBase ? "Base" : "Remove";
    removeBtn.disabled = isBase;
    if (!isBase) {
      removeBtn.onclick = () => {
        customWords = customWords.filter(w => w !== word);
        saveCustomWords();
        renderWordList();
      };
    }
    row.appendChild(text);
    row.appendChild(removeBtn);
    wordListEl.appendChild(row);
  });
}

function handleCardClick(index) {
  if (!currentRoomData || currentRoomData.status !== "active") return;
  if (currentRoomData.winner) return;

  const me = currentRoomData.players?.[playerId];
  if (!me) return;
  const marks = [...(me.marks || Array(TOTAL_CELLS).fill(false))];
  if (marks[index]) return;

  marks[index] = true;
  update(ref(db, `gameRooms/${currentRoom}/players/${playerId}`), { marks }).then(() => {
    if (hasBingo(marks)) {
      declareWin();
    }
  });
}

function hasBingo(marks) {
  const lines = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    lines.push([...Array(GRID_SIZE)].map((_, c) => r * GRID_SIZE + c));
  }
  for (let c = 0; c < GRID_SIZE; c++) {
    lines.push([...Array(GRID_SIZE)].map((_, r) => r * GRID_SIZE + c));
  }
  lines.push([...Array(GRID_SIZE)].map((_, i) => i * GRID_SIZE + i));
  lines.push([...Array(GRID_SIZE)].map((_, i) => (i + 1) * GRID_SIZE - i - 1));

  return lines.some(line => line.every(idx => marks[idx]));
}

async function declareWin() {
  if (!currentRoom || currentRoomData?.winner) return;
  const winnerInfo = {
    playerId,
    name: playerName || "Unknown",
    time: Date.now()
  };
  await update(ref(db, "gameRooms/" + currentRoom), {
    winner: winnerInfo,
    status: "finished"
  });
  incrementWins(playerId);
}

function startTimer(startTime) {
  stopTimer();
  const updateDisplay = () => {
    const elapsed = Math.max(0, Date.now() - startTime);
    timerDisplay.innerText = `Timer: ${formatElapsed(elapsed)}`;
  };
  updateDisplay();
  timerInterval = setInterval(updateDisplay, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function buildPlayerPayload(name) {
  return {
    name,
    board: generateBoard(),
    marks: Array(TOTAL_CELLS).fill(false),
    wins: 0,
    joinedAt: Date.now()
  };
}

function fitCardText(cardNodes) {
  const nodes = Array.from(cardNodes || []);
  nodes.forEach(node => {
    let size = 38;
    const minSize = 26;
    node.style.fontSize = `${size}px`;
    const maxWidth = node.clientWidth - 8;
    const maxHeight = node.clientHeight - 8;
    while (size > minSize && (node.scrollWidth > maxWidth || node.scrollHeight > maxHeight)) {
      size -= 1;
      node.style.fontSize = `${size}px`;
    }
  });
}

async function leaveRoom() {
  stopTimer();
  if (detachRoomListener) {
    detachRoomListener();
    detachRoomListener = null;
  }
  if (currentRoom) {
    try {
      await remove(ref(db, `gameRooms/${currentRoom}/players/${playerId}`));
    } catch (e) {
      console.error("Failed to remove player from room", e);
    }
  }
  currentRoom = null;
  currentRoomData = null;
  isHost = false;
  gameBoard.classList.add("hidden");
  showSetup();
  cardsContainer.innerHTML = "";
  playerTags.innerHTML = "";
  roomDisplay.innerText = "";
  helperText.innerText = "";
  winnerBanner.classList.add("hidden");
  newGameBtn.classList.add("hidden");
  startBtn.classList.remove("hidden");
  timerDisplay.innerText = "Waiting to start";
}

function showConfetti() {
  clearConfetti();
  const layer = document.createElement("div");
  layer.className = "confetti-layer";
  const pieces = 32;
  for (let i = 0; i < pieces; i++) {
    const p = document.createElement("div");
    p.className = "confetti";
    const duration = 5 + Math.random() * 3; // 5-8s
    p.style.left = Math.random() * 100 + "%";
    p.style.animationDuration = duration + "s";
    // small positive delay keeps the start at the top while staggering the pieces
    p.style.animationDelay = Math.random() * 0.6 + "s";
    p.style.setProperty("--spinDir", Math.random() > 0.5 ? 1 : -1);
    layer.appendChild(p);
  }
  document.body.appendChild(layer);
}

function clearConfetti() {
  document.querySelectorAll(".confetti-layer").forEach(el => el.remove());
}

async function incrementWins(winnerId) {
  if (!currentRoom) return;
  const winsRef = ref(db, `gameRooms/${currentRoom}/players/${winnerId}/wins`);
  try {
    const snapshot = await get(winsRef);
    const current = snapshot.exists() ? snapshot.val() : 0;
    await set(winsRef, current + 1);
  } catch (e) {
    console.error("Failed to increment wins", e);
  }
}

function loadCustomWords() {
  try {
    const raw = localStorage.getItem(CUSTOM_WORDS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) {
      return parsed.filter(w => typeof w === "string" && w.trim()).map(w => w.trim());
    }
    return [];
  } catch {
    return [];
  }
}

function saveCustomWords() {
  localStorage.setItem(CUSTOM_WORDS_KEY, JSON.stringify(customWords));
}
