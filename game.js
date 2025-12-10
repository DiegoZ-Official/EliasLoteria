import { db } from "./firebase.js";
import { ref, set, get, onValue, update } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

const createBtn = document.getElementById("createRoom");
const joinBtn = document.getElementById("joinRoom");
const startBtn = document.getElementById("startGame");
const roomInput = document.getElementById("roomCode");
const nameInput = document.getElementById("nameInput");
const setupDiv = document.getElementById("setup");
const gameBoard = document.getElementById("gameBoard");
const roomDisplay = document.getElementById("roomDisplay");
const cardsContainer = document.getElementById("cards");
const playerCountDisplay = document.getElementById("playerCount");
const timerDisplay = document.getElementById("timerDisplay");
const winnerBanner = document.getElementById("winnerBanner");
const helperText = document.getElementById("helperText");
const hostControls = document.getElementById("hostControls");

const deck = [
  "🍎",
  "🍌",
  "🍒",
  "🍇",
  "🍉",
  "🍓",
  "🍍",
  "🥝",
  "🍑",
  "🥭",
  "🍐",
  "🍋",
  "🍈",
  "🥥",
  "🍊",
  "🫐",
  "🍏",
  "🥑",
  "🌽",
  "🥕",
  "🍆",
  "🥔",
  "🧅",
  "🥦",
  "🥒"
];

const GRID_SIZE = 5;
const TOTAL_CELLS = GRID_SIZE * GRID_SIZE;

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
  return shuffle(deck).slice(0, TOTAL_CELLS);
}

function ensureName() {
  const name = nameInput.value.trim();
  if (!name) {
    alert("Please enter your name first.");
    nameInput.focus();
    return null;
  }
  playerName = name;
  localStorage.setItem("eliasPlayerName", name);
  return name;
}

createBtn.onclick = async () => {
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
  enterRoom(code);
};

joinBtn.onclick = async () => {
  const name = ensureName();
  if (!name) return;
  const code = roomInput.value.trim().toUpperCase();
  if (!code) {
    alert("Enter a room code!");
    return;
  }
  const snapshot = await get(ref(db, "gameRooms/" + code));
  if (!snapshot.exists()) {
    alert("Room not found.");
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
  enterRoom(code);
};

startBtn.onclick = async () => {
  if (!currentRoom || !isHost) return;
  await update(ref(db, "gameRooms/" + currentRoom), {
    status: "active",
    startTime: Date.now()
  });
};

function enterRoom(code) {
  setupDiv.classList.add("hidden");
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
  helperText.innerText =
    data.status === "waiting"
      ? "Waiting to start. Host can start the timer."
      : data.status === "active"
      ? "Tap squares to mark your board."
      : "Game finished.";

  hostControls.classList.toggle("hidden", !isHost || data.status !== "waiting");
  startBtn.disabled = data.status !== "waiting";

  if (data.winner) {
    winnerBanner.classList.remove("hidden");
    const winnerName = data.winner.name || "Someone";
    winnerBanner.innerText = winnerName + " called Lotería!";
  } else {
    winnerBanner.classList.add("hidden");
  }

  if (data.startTime) {
    startTimer(data.startTime);
  } else {
    stopTimer();
    timerDisplay.innerText = "Waiting to start";
  }

  renderBoard(me);
}

function renderBoard(playerData) {
  cardsContainer.innerHTML = "";
  if (!playerData) {
    helperText.innerText = "You are not registered in this room.";
    return;
  }

  const board = playerData.board || Array.from({ length: TOTAL_CELLS }, (_, i) => "Card " + (i + 1));
  const marks = playerData.marks || Array(TOTAL_CELLS).fill(false);

  board.forEach((emoji, i) => {
    const div = document.createElement("div");
    div.className = "card" + (marks[i] ? " marked" : "");
    div.textContent = emoji;
    div.onclick = () => handleCardClick(i);
    cardsContainer.appendChild(div);
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
}

function startTimer(startTime) {
  stopTimer();
  const updateDisplay = () => {
    const elapsed = Math.max(0, Date.now() - startTime);
    const minutes = Math.floor(elapsed / 60000)
      .toString()
      .padStart(2, "0");
    const seconds = Math.floor((elapsed % 60000) / 1000)
      .toString()
      .padStart(2, "0");
    timerDisplay.innerText = `Timer: ${minutes}:${seconds}`;
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
    joinedAt: Date.now()
  };
}
