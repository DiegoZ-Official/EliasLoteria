import { db } from "./firebase.js";
import { ref, set, get, onValue } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

const createBtn = document.getElementById("createRoom");
const joinBtn = document.getElementById("joinRoom");
const roomInput = document.getElementById("roomCode");
const setupDiv = document.getElementById("setup");
const gameBoard = document.getElementById("gameBoard");
const roomDisplay = document.getElementById("roomDisplay");
const cardsContainer = document.getElementById("cards");

let currentRoom = null;
let cards = ["🍎", "🍌", "🍒", "🍇", "🍉", "🍓", "🍍", "🥝"];

function randomCode() {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
}

// Create a new game room
createBtn.onclick = async () => {
  const code = randomCode();
  await set(ref(db, "gameRooms/" + code), {
    createdAt: Date.now(),
    moves: [],
  });
  currentRoom = code;
  startGame(code);
};

// Join an existing room
joinBtn.onclick = async () => {
  const code = roomInput.value.trim().toUpperCase();
  if (!code) return alert("Enter a room code!");
  const snapshot = await get(ref(db, "gameRooms/" + code));
  if (snapshot.exists()) {
    currentRoom = code;
    startGame(code);
  } else {
    alert("Room not found.");
  }
};

// Start the game UI and sync moves
function startGame(code) {
  setupDiv.classList.add("hidden");
  gameBoard.classList.remove("hidden");
  roomDisplay.innerText = "Room Code: " + code;

  cardsContainer.innerHTML = "";
  cards.forEach((emoji, i) => {
    const div = document.createElement("div");
    div.classList.add("card");
    div.textContent = emoji;
    div.onclick = () => sendMove(i);
    cardsContainer.appendChild(div);
  });

  const movesRef = ref(db, "gameRooms/" + code + "/moves");
  onValue(movesRef, snapshot => {
    const moves = snapshot.val() || [];
    console.log("Moves:", moves);
  });
}

// Send move to Firebase
function sendMove(cardIndex) {
  if (!currentRoom) return;
  const moveRef = ref(db, "gameRooms/" + currentRoom + "/moves");
  get(moveRef).then(snapshot => {
    const moves = snapshot.val() || [];
    moves.push({ cardIndex, time: Date.now() });
    set(moveRef, moves);
  });
}
