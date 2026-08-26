import { Room } from "./network.js";
import { renderGlyph } from "./glyphs.js";
import { ICONS, ICON_GROUPS, renderIcon } from "./icons.js";
import { LEVELS } from "./levels/manifest.js";

const $ = (id) => document.getElementById(id);

const screens = {
  lobby: $("screen-lobby"),
  connecting: $("screen-connecting"),
  game: $("screen-game"),
  reveal: $("screen-reveal"),
  complete: $("screen-complete"),
};

function showScreen(name) {
  for (const [key, el] of Object.entries(screens)) {
    el.toggleAttribute("data-active", key === name);
  }
}

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---- app state -------------------------------------------------------

const room = new Room();
const state = {
  role: null, // "A" | "B"
  levelIndex: 0,
  level: null, // current manifest entry
  roleData: null, // this player's private slice for the current level
  board: [], // [{id, by}]
  myGuess: [],
  myGuessStr: null,
  submitted: false,
  partnerGuess: null,
  partnerSubmitted: false,
  attempts: Object.create(null),
};

// ---- lobby -------------------------------------------------------

$("host-room-btn").addEventListener("click", async () => {
  $("host-room-btn").disabled = true;
  try {
    const code = await room.host();
    $("host-code-value").textContent = code;
    $("host-code-display").hidden = false;
  } catch (err) {
    $("host-status").textContent = "Could not create a room: " + err.message;
    $("host-room-btn").disabled = false;
  }
});

$("join-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const code = new FormData(event.target).get("code");
  if (!code) return;
  const submitBtn = event.target.querySelector("button[type=submit]");
  submitBtn.disabled = true;
  $("join-status").textContent = "Connecting…";
  showScreen("connecting");
  $("connecting-message").textContent = `Joining room ${code.toUpperCase()}…`;
  try {
    await room.join(code);
  } catch (err) {
    showScreen("lobby");
    $("join-status").textContent = "Couldn't connect: " + err.message;
    submitBtn.disabled = false;
  }
});

room.addEventListener("connected", ({ detail }) => {
  state.role = detail.role;
  $("role-indicator").textContent = `You are Player ${detail.role} · Room ${detail.code}`;
  loadLevel(0);
});

room.addEventListener("message", ({ detail }) => handleMessage(detail));

room.addEventListener("peer-left", () => {
  const banner = $("connection-banner");
  banner.hidden = false;
  banner.textContent = "Your partner disconnected. Reload to start a new room.";
});

room.addEventListener("error", ({ detail }) => {
  console.error("Room error:", detail.err);
  if (room.role === "A" && !room.conn?.open && screens.lobby.hasAttribute("data-active")) {
    $("host-status").textContent =
      "That connection attempt failed (" + (detail.err?.message ?? "network error") + "). Still waiting — have your partner try again.";
  }
});

function handleMessage(message) {
  switch (message.type) {
    case "board:update":
      state.board = message.payload.icons;
      renderBoard();
      break;
    case "guess:submit":
      if (message.payload.levelIndex !== state.levelIndex) return;
      state.partnerGuess = message.payload.guess;
      state.partnerSubmitted = true;
      checkResolution();
      break;
    case "level:advance":
      loadLevel(message.payload.index);
      break;
    case "level:retry":
      if (message.payload.levelIndex !== state.levelIndex) return;
      resetGuessesKeepBoard();
      break;
  }
}

// ---- level loading -------------------------------------------------------

async function loadLevel(index) {
  if (index >= LEVELS.length) {
    showScreen("complete");
    return;
  }
  state.levelIndex = index;
  state.level = LEVELS[index];
  state.board = [];
  state.myGuess = Array(state.level.length).fill(null);
  state.myGuessStr = null;
  state.submitted = false;
  state.partnerGuess = null;
  state.partnerSubmitted = false;

  const roleFile = state.role === "A" ? "a" : "b";
  const mod = await import(`./levels/${state.level.id}.${roleFile}.js`);
  state.roleData = mod.default;

  state.attempts[state.level.id] ??= 0;

  $("level-number").textContent = String(index + 1);
  renderHints();
  renderWordTrack();
  renderPalette();
  renderBoard();
  renderAnswerBar();
  renderLetterPicker();
  renderAttempts();
  $("answer-status").textContent = "";
  showScreen("game");
}

function renderHints() {
  const labels = {
    category: "Category",
    length: "Length",
    rhymesWith: "Rhymes with",
    syllables: "Syllables",
  };
  const chips = Object.entries(state.roleData.hints)
    .map(([key, value]) => `<span class="hint-chip"><strong>${labels[key] ?? key}:</strong> ${value}</span>`)
    .join("");
  $("player-hints").innerHTML = chips;
}

function renderWordTrack() {
  const font = state.role === "A" ? "A" : "B";
  const held = new Map(state.roleData.positions.map((pos, i) => [pos, state.roleData.glyphs[i]]));
  let html = "";
  for (let pos = 1; pos <= state.level.length; pos++) {
    if (held.has(pos)) {
      html += `<div class="track-cell track-cell-mine"><div class="track-glyph">${renderGlyph(font, held.get(pos))}</div><span class="track-pos">${pos}</span></div>`;
    } else {
      html += `<div class="track-cell track-cell-partner" aria-hidden="true"><div class="track-blank">?</div><span class="track-pos">${pos}</span></div>`;
    }
  }
  $("word-track").innerHTML = html;
}

function renderPalette() {
  const allowed = new Set(state.level.iconPalette);
  const groups = ICON_GROUPS.map((group) => {
    const ids = Object.keys(ICONS).filter((id) => ICONS[id].group === group && allowed.has(id));
    if (ids.length === 0) return "";
    const buttons = ids
      .map(
        (id) => `<button type="button" class="palette-icon" data-icon-id="${id}" title="${ICONS[id].label}">
          <span class="icon-render">${renderIcon(id)}</span>
          <span class="icon-label">${ICONS[id].label}</span>
        </button>`
      )
      .join("");
    return `<div class="palette-group"><h3>${group}</h3><div class="palette-row">${buttons}</div></div>`;
  }).join("");
  $("palette-section").innerHTML = groups;
  $("palette-section").querySelectorAll(".palette-icon").forEach((btn) => {
    btn.addEventListener("click", () => appendIcon(btn.dataset.iconId));
  });
  updatePaletteDisabledState();
}

function updatePaletteDisabledState() {
  const max = state.level.maxBoardIcons;
  const full = max != null && state.board.length >= max;
  $("palette-section").querySelectorAll(".palette-icon").forEach((btn) => {
    btn.disabled = full;
  });
  $("board-slots").textContent = max != null ? `${state.board.length} / ${max} icons` : `${state.board.length} icons`;
}

function appendIcon(id) {
  const max = state.level.maxBoardIcons;
  if (max != null && state.board.length >= max) return;
  state.board.push({ id, by: state.role });
  renderBoard();
  room.send("board:update", { icons: state.board });
}

function renderBoard() {
  const board = $("message-board");
  if (state.board.length === 0) {
    board.innerHTML = `<p class="board-empty">No icons placed yet — start describing your glyphs.</p>`;
  } else {
    board.innerHTML = state.board
      .map(
        (entry) => `<div class="board-icon board-icon-${entry.by}" role="listitem" title="${ICONS[entry.id].label}">
          <span class="icon-render">${renderIcon(entry.id)}</span>
        </div>`
      )
      .join("");
  }
  updatePaletteDisabledState();
}

$("board-undo").addEventListener("click", () => {
  if (state.board.length === 0) return;
  state.board.pop();
  renderBoard();
  room.send("board:update", { icons: state.board });
});

$("board-clear").addEventListener("click", () => {
  if (state.board.length === 0) return;
  state.board = [];
  renderBoard();
  room.send("board:update", { icons: state.board });
});

// ---- answer entry -------------------------------------------------------

function renderLetterPicker() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  $("letter-picker").innerHTML = letters
    .map((letter) => `<button type="button" class="letter-tile" data-letter="${letter}">${letter}</button>`)
    .join("");
  $("letter-picker").querySelectorAll(".letter-tile").forEach((btn) => {
    btn.addEventListener("click", () => fillNextLetter(btn.dataset.letter));
  });
}

function renderAnswerBar() {
  $("answer-bar").innerHTML = state.myGuess
    .map((letter) => `<span class="answer-slot ${letter ? "filled" : ""}">${letter ?? ""}</span>`)
    .join("");
  updateAnswerControls();
}

function updateAnswerControls() {
  const complete = state.myGuess.every((l) => l !== null);
  const locked = state.submitted;
  $("answer-submit").disabled = !complete || locked;
  $("answer-backspace").disabled = locked;
  $("answer-clear").disabled = locked;
  $("letter-picker").querySelectorAll(".letter-tile").forEach((btn) => (btn.disabled = locked));
  $("answer-status").textContent = locked
    ? state.partnerSubmitted
      ? "Comparing guesses…"
      : "Waiting for your partner to submit…"
    : "";
}

function fillNextLetter(letter) {
  if (state.submitted) return;
  const i = state.myGuess.indexOf(null);
  if (i === -1) return;
  state.myGuess[i] = letter;
  renderAnswerBar();
}

$("answer-backspace").addEventListener("click", () => {
  if (state.submitted) return;
  for (let i = state.myGuess.length - 1; i >= 0; i--) {
    if (state.myGuess[i] !== null) {
      state.myGuess[i] = null;
      break;
    }
  }
  renderAnswerBar();
});

$("answer-clear").addEventListener("click", () => {
  if (state.submitted) return;
  state.myGuess.fill(null);
  renderAnswerBar();
});

function renderAttempts() {
  const n = state.attempts[state.level.id];
  $("attempts-indicator").textContent = n > 0 ? `Attempt ${n + 1}` : "";
}

$("answer-submit").addEventListener("click", () => {
  if (state.myGuess.some((l) => l === null) || state.submitted) return;
  state.myGuessStr = state.myGuess.join("");
  state.submitted = true;
  state.attempts[state.level.id] += 1;
  updateAnswerControls();
  room.send("guess:submit", { guess: state.myGuessStr, levelIndex: state.levelIndex });
  checkResolution();
});

async function checkResolution() {
  if (!state.submitted || !state.partnerSubmitted) return;
  const agree = state.myGuessStr === state.partnerGuess;
  let correct = false;
  if (agree) {
    const hash = await sha256Hex(state.myGuessStr);
    correct = hash === state.level.answerHash;
  }
  showReveal({ agree, correct });
}

// ---- reveal -------------------------------------------------------

function showReveal({ agree, correct }) {
  const kicker = $("reveal-kicker");
  const word = $("reveal-word");
  const detail = $("reveal-detail");
  const nextBtn = $("reveal-next");
  const retryBtn = $("reveal-retry");

  if (agree && correct) {
    kicker.textContent = "Solved";
    word.textContent = state.myGuessStr;
    detail.textContent = `You both agreed — and you were right. That took ${state.attempts[state.level.id]} attempt${state.attempts[state.level.id] === 1 ? "" : "s"}.`;
    nextBtn.hidden = false;
    retryBtn.hidden = true;
  } else if (agree && !correct) {
    kicker.textContent = "Close, but not quite";
    word.textContent = state.myGuessStr;
    detail.textContent = "You two agreed on a word, but it isn't the one hidden here. Keep comparing glyphs and try again.";
    nextBtn.hidden = true;
    retryBtn.hidden = false;
  } else {
    kicker.textContent = "You don't agree yet";
    word.textContent = `${state.myGuessStr} / ${state.partnerGuess}`;
    detail.textContent = "Your guesses don't match each other. Compare where they differ and describe those glyphs more.";
    nextBtn.hidden = true;
    retryBtn.hidden = false;
  }
  showScreen("reveal");
}

$("reveal-next").addEventListener("click", () => {
  const next = state.levelIndex + 1;
  room.send("level:advance", { index: next });
  loadLevel(next);
});

$("reveal-retry").addEventListener("click", () => {
  room.send("level:retry", { levelIndex: state.levelIndex });
  resetGuessesKeepBoard();
});

function resetGuessesKeepBoard() {
  state.myGuess.fill(null);
  state.myGuessStr = null;
  state.submitted = false;
  state.partnerGuess = null;
  state.partnerSubmitted = false;
  renderAnswerBar();
  renderAttempts();
  showScreen("game");
}
