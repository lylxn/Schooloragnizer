import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, doc, setDoc, getDoc, updateDoc,
  onSnapshot, collection, addDoc, serverTimestamp,
  query, orderBy, deleteField
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── FIREBASE INIT ──────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyC2J_vti_IBA9fvQRChZD8kx5ty2S6kbqs",
  authDomain: "school-organizer-e9525.firebaseapp.com",
  projectId: "school-organizer-e9525",
  storageBucket: "school-organizer-e9525.firebasestorage.app",
  messagingSenderId: "1074118170336",
  appId: "1:1074118170336:web:3353c6b102103412396285",
  measurementId: "G-JB19ZGBY3X"
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// ── STATE ──────────────────────────────────────────
let myName          = localStorage.getItem("rooms_name") || "";
let currentRoomCode = null;
let unsubRoom       = null;
let unsubMessages   = null;
let firstLoad       = true;

if (myName) showNameSet();

// ── NAME ──────────────────────────────────────────
window.setName = () => {
  const val = document.getElementById("name-input").value.trim();
  if (!val) return showToast("enter a name first");
  myName = val;
  localStorage.setItem("rooms_name", myName);
  showNameSet();
};

window.changeName = () => {
  document.getElementById("name-display").style.display = "none";
  const inp = document.getElementById("name-input");
  inp.style.display = "";
  inp.value = myName;
  document.querySelector("#name-section .btn-primary").style.display = "";
};

function showNameSet() {
  document.getElementById("name-show").textContent = myName;
  document.getElementById("name-display").style.display = "";
  document.getElementById("name-input").style.display = "none";
  document.querySelector("#name-section .btn-primary").style.display = "none";
}

// ── CODE GEN ──────────────────────────────────────
function genCode() {
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => c[Math.floor(Math.random() * c.length)]).join("");
}

// ── CREATE ROOM ───────────────────────────────────
window.createRoom = async () => {
  if (!myName) return showToast("set your name first");
  const name = document.getElementById("room-name-input").value.trim() || "Untitled Room";
  const code = genCode();
  try {
    await setDoc(doc(db, "rooms", code), {
      name, code,
      createdAt: serverTimestamp(),
      members: { [myName]: true }
    });
    showToast(`room created — ${code}`);
    enterRoom(code, name);
  } catch (e) {
    showToast("error creating room");
    console.error(e);
  }
};

// ── JOIN ROOM ─────────────────────────────────────
window.joinRoom = async () => {
  if (!myName) return showToast("set your name first");
  const code = document.getElementById("join-code-input").value.trim().toUpperCase();
  if (code.length < 4) return showToast("enter a valid code");
  const snap = await getDoc(doc(db, "rooms", code));
  if (!snap.exists()) return showToast("room not found");
  await updateDoc(doc(db, "rooms", code), { [`members.${myName}`]: true });
  await addDoc(collection(db, "rooms", code, "messages"), {
    text: `${myName} joined`,
    sender: "__system__",
    timestamp: serverTimestamp()
  });
  enterRoom(code, snap.data().name);
};

// ── ENTER ROOM ────────────────────────────────────
function enterRoom(code, name) {
  currentRoomCode = code;
  firstLoad = true;

  document.getElementById("lobby-view").style.display = "none";
  document.getElementById("room-view").style.display = "flex";
  document.getElementById("room-title").textContent = name;
  document.getElementById("room-code-show").textContent = code;

  // live members
  unsubRoom = onSnapshot(doc(db, "rooms", code), snap => {
    if (!snap.exists()) { leaveRoom(); return; }
    renderMembers(Object.keys(snap.data().members || {}));
  });

  // live messages
  const q = query(collection(db, "rooms", code, "messages"), orderBy("timestamp", "asc"));
  unsubMessages = onSnapshot(q, snap => {
    const container = document.getElementById("chat-messages");
    if (firstLoad) { container.innerHTML = ""; firstLoad = false; }
    snap.docChanges().forEach(ch => {
      if (ch.type === "added") {
        const d = ch.doc.data();
        if (container.querySelector(".empty")) container.innerHTML = "";
        appendMsg(d.sender, d.text, container);
      }
    });
    container.scrollTop = container.scrollHeight;
  });
}

// ── MEMBERS ───────────────────────────────────────
function renderMembers(members) {
  document.getElementById("member-count").textContent = members.length;
  const list = document.getElementById("members-list");
  list.innerHTML = "";
  members.forEach(m => {
    const chip = document.createElement("div");
    chip.className = "member-chip" + (m === myName ? " you" : "");
    chip.innerHTML = `<span class="dot"></span>${m}${m === myName ? " (you)" : ""}`;
    list.appendChild(chip);
  });
}

// ── APPEND MESSAGE ────────────────────────────────
function appendMsg(sender, text, container) {
  const isSystem = sender === "__system__";
  const isMe     = sender === myName;

  const msg = document.createElement("div");
  msg.className = "msg" + (isSystem ? " system" : isMe ? " mine" : "");

  if (!isSystem) {
    const ts = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const meta = document.createElement("div");
    meta.className = "msg-meta";
    meta.innerHTML = `<span class="sender">${sender}</span><span>${ts}</span>`;
    msg.appendChild(meta);
  }

  const bubble = document.createElement("div");
  bubble.className = "msg-bubble";
  bubble.textContent = text;
  msg.appendChild(bubble);
  container.appendChild(msg);
}

// ── SEND MESSAGE ──────────────────────────────────
window.sendMessage = async () => {
  const inp  = document.getElementById("chat-input");
  const text = inp.value.trim();
  if (!text || !currentRoomCode) return;
  inp.value = "";
  await addDoc(collection(db, "rooms", currentRoomCode, "messages"), {
    text,
    sender: myName,
    timestamp: serverTimestamp()
  });
};

// ── COPY CODE ─────────────────────────────────────
window.copyCode = () => {
  navigator.clipboard.writeText(currentRoomCode);
  const btn = document.getElementById("copy-btn");
  btn.textContent = "copied!";
  btn.classList.add("copied");
  setTimeout(() => { btn.textContent = "copy code"; btn.classList.remove("copied"); }, 2000);
};

// ── LEAVE ROOM ────────────────────────────────────
window.leaveRoom = async () => {
  if (unsubRoom)     unsubRoom();
  if (unsubMessages) unsubMessages();

  if (currentRoomCode) {
    try {
      await updateDoc(doc(db, "rooms", currentRoomCode), {
        [`members.${myName}`]: deleteField()
      });
      await addDoc(collection(db, "rooms", currentRoomCode, "messages"), {
        text: `${myName} left`,
        sender: "__system__",
        timestamp: serverTimestamp()
      });
    } catch (e) {}
  }

  currentRoomCode = null;
  document.getElementById("room-view").style.display   = "none";
  document.getElementById("lobby-view").style.display  = "flex";
  document.getElementById("chat-messages").innerHTML   = `<p class="empty">say something 👋</p>`;
  document.getElementById("members-list").innerHTML    = `<p class="empty">no one here yet...</p>`;
  document.getElementById("join-code-input").value     = "";
  document.getElementById("room-name-input").value     = "";
};

// ── TOAST ─────────────────────────────────────────
window.showToast = msg => {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2500);
};