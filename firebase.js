// Firebase setup
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getDatabase, ref, set, get, onValue } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyAMb_rJ6n9aHSnAt8hMofOMmesCu7tLQfM",
  authDomain: "elias-loteria.firebaseapp.com",
  databaseURL: "https://elias-loteria-default-rtdb.firebaseio.com",
  projectId: "elias-loteria",
  storageBucket: "elias-loteria.firebasestorage.app",
  messagingSenderId: "356204278464",
  appId: "1:356204278464:web:b391afff8e65ef74973325",
  measurementId: "G-9SH5DV0HW2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
