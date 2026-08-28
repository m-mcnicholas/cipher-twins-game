import { Room } from "./network.js";
import { ICONS, ICON_GROUPS, renderIcon } from "./icons.js";
import { applyBoardOperation, canHostAdvance, validateIncomingMessage } from "./protocol.js";

const $ = (id) => document.getElementById(id);
let WORDS = [];
let LEVEL_SCHEDULE = [];
let WORD_BY_ID = new Map();
let WORD_IDS = new Set();
let manifestReady = false;
let manifestPromise;
const pendingMessages = [];
const screens = Object.fromEntries(["lobby", "connecting", "game", "reveal", "complete", "error"].map((name) => [name, $(`screen-${name}`)]));

function showScreen(name, { focus = true } = {}) {
  for (const [key, element] of Object.entries(screens)) element?.toggleAttribute("data-active", key === name);
  if (focus) requestAnimationFrame(() => screens[name]?.focus({ preventScroll: true }));
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

const room = new Room();
const state = {
  role: null, // "A" | "B" — network role (host vs joiner)
  puzzleRoleForA: null, // "a" | "b" — which puzzle-side role network-role A got this session; the host randomizes this once so hosting doesn't always hand out the easier-to-encode hint set
  levelIndex: -1, schedule: null, wordId: null, word: null, roleData: null,
  board: [], boardRevision: 0, processedOperations: new Set(),
  myGuess: [], myGuessStr: null, submitted: false, partnerGuess: null, partnerSubmitted: false,
  attempts: Object.create(null), usedWordIds: new Set(), loadToken: 0, resolutionToken: 0,
};

// Network role (A = host, B = joiner) is fixed at connection time, but which
// *puzzle* role (odd positions + category/length hints, vs. even positions +
// syllables/firstSound hints) each network role plays is randomized once per
// session by the host and shared via `puzzleRoleForA`.
function myPuzzleRole() {
  const aRole = state.puzzleRoleForA ?? "a";
  return state.role === "A" ? aRole : aRole === "a" ? "b" : "a";
}

const levelPayload = () => ({ levelIndex: state.levelIndex, wordId: state.wordId });
const maxBoardIcons = () => state.schedule?.maxBoardIcons ?? 100;
const messageContext = () => ({
  localRole: state.role, levelCount: LEVEL_SCHEDULE.length, levelIndex: state.levelIndex,
  wordId: state.wordId, wordLength: state.word?.length ?? 0, wordIds: WORD_IDS,
  allowedIconIds: new Set(state.schedule?.palette ?? []), maxBoardIcons: maxBoardIcons(),
});

async function ensureManifest() {
  manifestPromise ??= import("./words/manifest.js").then((module) => {
    WORDS = module.WORDS;
    LEVEL_SCHEDULE = module.LEVEL_SCHEDULE;
    WORD_BY_ID = new Map(WORDS.map((word) => [word.id, word]));
    WORD_IDS = new Set(WORD_BY_ID.keys());
    manifestReady = true;
  });
  return manifestPromise;
}

// ---- lobby -------------------------------------------------------

$("host-room-btn").addEventListener("click", async () => {
  $("host-room-btn").disabled = true;
  try {
    const code = await room.host();
    $("host-code-value").textContent = code;
    $("host-code-display").hidden = false;
  } catch (error) {
    $("host-status").textContent = `Could not create a room: ${error.message}`;
    $("host-room-btn").disabled = false;
  }
});

$("join-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const code = new FormData(event.target).get("code");
  if (!code) return;
  const submitButton = event.target.querySelector("button[type=submit]");
  submitButton.disabled = true;
  $("join-status").textContent = "Connecting…";
  $("connecting-message").textContent = `Joining room ${code.toUpperCase()}…`;
  showScreen("connecting");
  try {
    await room.join(code);
  } catch (error) {
    showScreen("lobby");
    $("join-status").textContent = `Couldn't connect: ${error.message}`;
    submitButton.disabled = false;
  }
});

room.addEventListener("connected", async ({ detail }) => {
  state.role = detail.role;
  $("role-indicator").textContent = `You are Player ${detail.role} · Room ${detail.code}`;
  $("connecting-message").textContent = "Connected! Loading the first puzzle…";
  showScreen("connecting");
  try {
    await ensureManifest();
    pendingMessages.splice(0).forEach(handleMessage);
    if (state.role === "A") {
      state.puzzleRoleForA = Math.random() < 0.5 ? "a" : "b";
      hostAdvanceTo(0);
    }
  } catch (error) {
    console.error("Could not load the puzzle manifest:", error);
    showLoadError("The puzzle index could not be loaded. Check your connection and reload the page.");
  }
});
room.addEventListener("message", ({ detail }) => {
  if (!manifestReady) pendingMessages.push(detail);
  else handleMessage(detail);
});
room.addEventListener("peer-left", () => {
  $("connection-banner").hidden = false;
  $("connection-banner").textContent = "Your partner disconnected. Reload to start a new room.";
});
room.addEventListener("error", ({ detail }) => {
  console.error("Room error:", detail.err);
  if (room.role === "A" && !room.conn?.open && screens.lobby.hasAttribute("data-active")) {
    $("host-status").textContent = `That connection attempt failed (${detail.err?.message ?? "network error"}). Still waiting — have your partner try again.`;
  }
});

function handleMessage(rawMessage) {
  const message = validateIncomingMessage(rawMessage, messageContext());
  if (!message) {
    console.warn("Ignored an invalid or out-of-context peer message.");
    return;
  }
  const { type, payload } = message;
  if (type === "level:advance") {
    if (payload.puzzleRoleForA === "a" || payload.puzzleRoleForA === "b") state.puzzleRoleForA = payload.puzzleRoleForA;
    if (payload.index === LEVEL_SCHEDULE.length) showScreen("complete");
    else if (payload.index === state.levelIndex + 1 || (payload.index === state.levelIndex && payload.wordId === state.wordId)) applyLevel(payload.index, payload.wordId);
  } else if (type === "request:advance") hostAdvanceTo(payload.index);
  else if (type === "board:op") hostApplyBoardOperation(payload.operation, "B");
  else if (type === "board:state" && payload.revision > state.boardRevision) {
    state.board = payload.icons;
    state.boardRevision = payload.revision;
    renderBoard();
  } else if (type === "guess:submit") {
    state.partnerGuess = payload.guess;
    state.partnerSubmitted = true;
    checkResolution();
  } else if (type === "guess:retract") {
    state.partnerGuess = null;
    state.partnerSubmitted = false;
    updateAnswerControls();
  } else if (type === "request:retry") hostRetry();
  else if (type === "level:retry") resetGuessesKeepBoard();
}

function hostAdvanceTo(index) {
  if (state.role !== "A" || !canHostAdvance(state.levelIndex, index, LEVEL_SCHEDULE.length)) return;
  if (index >= LEVEL_SCHEDULE.length) {
    state.levelIndex = index;
    state.wordId = null;
    state.loadToken += 1;
    room.send("level:advance", { index, wordId: null, puzzleRoleForA: state.puzzleRoleForA });
    showScreen("complete");
    return;
  }
  const targetLength = LEVEL_SCHEDULE[index].length;
  let candidates = WORDS.filter((word) => word.length === targetLength && !state.usedWordIds.has(word.id));
  if (!candidates.length) candidates = WORDS.filter((word) => word.length === targetLength);
  const chosen = candidates[crypto.getRandomValues(new Uint32Array(1))[0] % candidates.length];
  state.usedWordIds.add(chosen.id);
  beginLevel(index, chosen.id);
  room.send("level:advance", { index, wordId: chosen.id, puzzleRoleForA: state.puzzleRoleForA });
  loadLevelData(index, chosen.id, state.loadToken);
}

function beginLevel(index, wordId) {
  const word = WORD_BY_ID.get(wordId);
  const schedule = LEVEL_SCHEDULE[index];
  if (!word || !schedule || word.length !== schedule.length) return false;
  state.loadToken += 1;
  state.resolutionToken += 1;
  Object.assign(state, {
    levelIndex: index, schedule, wordId, word, roleData: null, board: [], boardRevision: 0,
    myGuess: Array(word.length).fill(null), myGuessStr: null, submitted: false,
    partnerGuess: null, partnerSubmitted: false,
  });
  state.processedOperations.clear();
  state.attempts[wordId] ??= 0;
  resetClearConfirm();
  $("connecting-message").textContent = `Loading level ${index + 1}…`;
  showScreen("connecting");
  return true;
}

function applyLevel(index, wordId) {
  if (index === state.levelIndex && wordId === state.wordId && state.roleData) return;
  if (!beginLevel(index, wordId)) return showLoadError("The selected puzzle is invalid.");
  loadLevelData(index, wordId, state.loadToken);
}

async function loadLevelData(index, wordId, token) {
  try {
    const module = myPuzzleRole() === "a" ? await import("./words/role-a.js") : await import("./words/role-b.js");
    if (token !== state.loadToken || index !== state.levelIndex || wordId !== state.wordId) return;
    const roleData = module.default[wordId];
    if (!validateRoleData(roleData, state.word)) throw new Error("Puzzle data did not match its manifest entry.");
    state.roleData = roleData;
    renderLevel();
  } catch (error) {
    if (token !== state.loadToken) return;
    console.error("Could not load puzzle data:", error);
    showLoadError("This puzzle could not be loaded. Check your connection and try again.");
  }
}

function validateRoleData(data, word) {
  if (!data || typeof data !== "object" || !data.hints || typeof data.hints !== "object") return false;
  if (!Array.isArray(data.positions) || !Array.isArray(data.letters) || data.positions.length !== data.letters.length) return false;
  return data.positions.every((position, index) => Number.isInteger(position) && position >= 1 && position <= word.length && /^[A-Z]$/.test(data.letters[index]));
}

function showLoadError(message) {
  $("load-error-message").textContent = message;
  showScreen("error");
}

$("load-retry").addEventListener("click", () => {
  if (!state.word || state.levelIndex < 0) {
    location.reload();
    return;
  }
  state.loadToken += 1;
  $("connecting-message").textContent = `Retrying level ${state.levelIndex + 1}…`;
  showScreen("connecting");
  loadLevelData(state.levelIndex, state.wordId, state.loadToken);
});

function renderLevel() {
  $("level-number").textContent = String(state.levelIndex + 1);
  renderHints(); renderWordTrack(); renderPalette(); renderBoard(); renderAnswerBar(); renderLetterPicker(); renderAttempts();
  $("answer-status").textContent = "";
  showScreen("game");
}

function renderHints() {
  const labels = { category: "Category", length: "Length", syllables: "Syllables", firstSound: "First sound" };
  const container = $("player-hints");
  container.replaceChildren();
  for (const [key, value] of Object.entries(state.roleData.hints)) {
    if (typeof value !== "string" && typeof value !== "number") continue;
    const chip = document.createElement("span");
    chip.className = "hint-chip";
    const strong = document.createElement("strong");
    strong.textContent = `${labels[key] ?? key}:`;
    chip.append(strong, ` ${value}`);
    container.append(chip);
  }
}

function renderWordTrack() {
  const held = new Map(state.roleData.positions.map((position, index) => [position, state.roleData.letters[index]]));
  const track = $("word-track");
  track.replaceChildren();
  for (let position = 1; position <= state.word.length; position += 1) {
    const mine = held.has(position);
    const cell = document.createElement("div");
    cell.className = `track-cell ${mine ? "track-cell-mine" : "track-cell-partner"}`;
    if (!mine) cell.setAttribute("aria-hidden", "true");
    const glyph = document.createElement("div");
    glyph.className = mine ? "track-letter" : "track-blank";
    glyph.textContent = held.get(position) ?? "?";
    const label = document.createElement("span");
    label.className = "track-pos";
    label.textContent = String(position);
    cell.append(glyph, label);
    track.append(cell);
  }
}

function iconElement(iconId) {
  const span = document.createElement("span");
  span.className = "icon-render";
  span.innerHTML = renderIcon(iconId);
  return span;
}

function renderPalette() {
  const allowed = new Set(state.schedule.palette);
  const section = $("palette-section");
  section.replaceChildren();
  for (const groupName of ICON_GROUPS) {
    const ids = Object.keys(ICONS).filter((id) => ICONS[id].group === groupName && allowed.has(id));
    if (!ids.length) continue;
    const group = document.createElement("div");
    group.className = "palette-group";
    const heading = document.createElement("h3");
    heading.textContent = groupName;
    const row = document.createElement("div");
    row.className = "palette-row";
    for (const id of ids) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "palette-icon";
      button.title = ICONS[id].label;
      button.addEventListener("click", () => submitBoardOperation("add", { iconId: id }));
      const label = document.createElement("span");
      label.className = "icon-label";
      label.textContent = ICONS[id].label;
      button.append(iconElement(id), label);
      row.append(button);
    }
    group.append(heading, row);
    section.append(group);
  }
  updatePaletteDisabledState();
}

function updatePaletteDisabledState() {
  const full = state.board.length >= maxBoardIcons();
  $("palette-section").querySelectorAll(".palette-icon").forEach((button) => { button.disabled = full; });
  $("board-undo").disabled = !state.board.some((entry) => entry.by === state.role);
  $("board-clear").disabled = state.board.length === 0;
  $("board-slots").textContent = state.schedule?.maxBoardIcons != null ? `${state.board.length} / ${maxBoardIcons()} icons` : `${state.board.length} icons`;
}

function operationId() {
  const randomPart = crypto.randomUUID?.() ?? [...crypto.getRandomValues(new Uint8Array(16))].map((value) => value.toString(16).padStart(2, "0")).join("");
  return `${state.role}-${randomPart}`;
}

// `extra` carries operation-kind-specific fields: { iconId } for "add",
// { targetId } for "remove". "undo" and "clear" need nothing further.
function submitBoardOperation(kind, extra = {}) {
  if (!state.roleData || (kind === "add" && state.board.length >= maxBoardIcons())) return;
  const operation = { id: operationId(), kind, ...extra };
  if (state.role === "A") hostApplyBoardOperation(operation, "A");
  else room.send("board:op", { ...levelPayload(), operation });
}

function hostApplyBoardOperation(operation, by) {
  if (state.role !== "A" || state.processedOperations.has(operation.id)) return;
  state.processedOperations.add(operation.id);
  const nextBoard = applyBoardOperation(state.board, operation, by, maxBoardIcons());
  if (nextBoard === state.board) return;
  state.board = nextBoard;
  state.boardRevision += 1;
  renderBoard();
  room.send("board:state", { ...levelPayload(), revision: state.boardRevision, icons: state.board });
}

function renderBoard() {
  const board = $("message-board");
  board.replaceChildren();
  if (!state.board.length) {
    const empty = document.createElement("p");
    empty.className = "board-empty";
    empty.textContent = "No icons placed yet — start describing your letters.";
    board.append(empty);
  } else {
    for (const entry of state.board) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.entryId = entry.id;
      button.addEventListener("click", () => submitBoardOperation("remove", { targetId: entry.id }));
      if (entry.iconId === "meta:next") {
        // A "meta:next" placement renders as a divider rather than an icon
        // tile, visually breaking the board into per-letter groups.
        button.className = "board-divider";
        button.title = "Next letter — click to remove";
        button.setAttribute("aria-label", "Next-letter divider, click to remove");
      } else {
        button.className = `board-icon board-icon-${entry.by}`;
        button.title = `${ICONS[entry.iconId].label} — click to remove`;
        button.append(iconElement(entry.iconId));
      }
      board.append(button);
    }
  }
  updatePaletteDisabledState();
}

// "Undo" only ever removes *your own* most recent icon, never a partner's —
// a shared "pop the last placed icon" could erase what the other just
// placed. Any single icon can also be removed directly by clicking it,
// regardless of who placed it — see renderBoard.
$("board-undo").addEventListener("click", () => submitBoardOperation("undo"));

const CLEAR_CONFIRM_THRESHOLD = 5;
let clearConfirmTimer = null;

function resetClearConfirm() {
  clearTimeout(clearConfirmTimer);
  clearConfirmTimer = null;
  const button = $("board-clear");
  button.classList.remove("confirming");
  button.textContent = "Clear";
}

$("board-clear").addEventListener("click", () => {
  if (state.board.length === 0) return;
  const button = $("board-clear");
  if (state.board.length > CLEAR_CONFIRM_THRESHOLD && !button.classList.contains("confirming")) {
    button.classList.add("confirming");
    button.textContent = "Clear all?";
    clearConfirmTimer = setTimeout(resetClearConfirm, 3000);
    return;
  }
  resetClearConfirm();
  submitBoardOperation("clear");
});

// ---- answer entry -------------------------------------------------------

function renderLetterPicker() {
  const picker = $("letter-picker");
  picker.replaceChildren();
  for (const letter of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "letter-tile";
    button.textContent = letter;
    button.dataset.letter = letter;
    button.addEventListener("click", () => fillNextLetter(letter));
    picker.append(button);
  }
}

function renderAnswerBar() {
  const bar = $("answer-bar");
  bar.replaceChildren();
  for (const letter of state.myGuess) {
    const slot = document.createElement("span");
    slot.className = `answer-slot${letter ? " filled" : ""}`;
    slot.textContent = letter ?? "";
    bar.append(slot);
  }
  updateAnswerControls();
}

function updateAnswerControls() {
  const complete = state.myGuess.length > 0 && state.myGuess.every(Boolean);
  $("answer-submit").disabled = !complete || state.submitted;
  $("answer-backspace").disabled = state.submitted;
  $("answer-clear").disabled = state.submitted;
  $("letter-picker").querySelectorAll(".letter-tile").forEach((button) => { button.disabled = state.submitted; });
  $("answer-unsubmit").hidden = !(state.submitted && !state.partnerSubmitted);
  $("answer-status").textContent = state.submitted
    ? (state.partnerSubmitted ? "Comparing guesses…" : "Waiting for your partner to submit… (you can still unsubmit)")
    : "";
}

function fillNextLetter(letter) {
  if (state.submitted) return;
  const index = state.myGuess.indexOf(null);
  if (index >= 0) state.myGuess[index] = letter;
  renderAnswerBar();
}

$("answer-backspace").addEventListener("click", () => {
  if (state.submitted) return;
  const index = state.myGuess.findLastIndex(Boolean);
  if (index >= 0) state.myGuess[index] = null;
  renderAnswerBar();
});
$("answer-clear").addEventListener("click", () => {
  if (!state.submitted) state.myGuess.fill(null);
  renderAnswerBar();
});

function renderAttempts() {
  const count = state.attempts[state.wordId] ?? 0;
  $("attempts-indicator").textContent = count > 0 ? `Attempt ${count + 1}` : "";
}

$("answer-submit").addEventListener("click", () => {
  if (state.myGuess.some((letter) => letter === null) || state.submitted) return;
  state.myGuessStr = state.myGuess.join("");
  state.submitted = true;
  state.attempts[state.wordId] += 1;
  updateAnswerControls();
  room.send("guess:submit", { ...levelPayload(), guess: state.myGuessStr });
  checkResolution();
});

// Only enabled before the partner has submitted — nothing about a guess has
// been revealed yet at that point, so there's no reason a fat-fingered
// submit should have to wait out a whole reveal-and-retry cycle to fix.
$("answer-unsubmit").addEventListener("click", () => {
  if (!state.submitted || state.partnerSubmitted) return;
  state.submitted = false;
  state.myGuessStr = null;
  state.attempts[state.wordId] -= 1;
  room.send("guess:retract", levelPayload());
  updateAnswerControls();
  renderAttempts();
});

async function checkResolution() {
  if (!state.submitted || !state.partnerSubmitted) return;
  const token = ++state.resolutionToken;
  const agree = state.myGuessStr === state.partnerGuess;
  const correct = agree && (await sha256Hex(state.myGuessStr)) === state.word.answerHash;
  if (token === state.resolutionToken) showReveal({ agree, correct });
}

function showReveal({ agree, correct }) {
  if (agree && correct) {
    $("reveal-kicker").textContent = "Solved";
    $("reveal-word").textContent = state.myGuessStr;
    const attempts = state.attempts[state.wordId];
    $("reveal-detail").textContent = `You both agreed — and you were right. That took ${attempts} attempt${attempts === 1 ? "" : "s"}.`;
    $("reveal-next").hidden = false;
    $("reveal-next").disabled = false;
    $("reveal-next").dataset.targetIndex = String(state.levelIndex + 1);
    $("reveal-retry").hidden = true;
  } else {
    $("reveal-kicker").textContent = agree ? "Close, but not quite" : "You don't agree yet";
    $("reveal-word").textContent = agree ? state.myGuessStr : `${state.myGuessStr} / ${state.partnerGuess}`;
    $("reveal-detail").textContent = agree
      ? "You two agreed on a word, but it isn't the one hidden here. Keep comparing letters and try again."
      : "Your guesses don't match each other. Compare where they differ and describe those letters more.";
    $("reveal-next").hidden = true;
    $("reveal-retry").hidden = false;
  }
  showScreen("reveal");
}

$("reveal-next").addEventListener("click", (event) => {
  const targetIndex = Number(event.currentTarget.dataset.targetIndex);
  event.currentTarget.disabled = true;
  if (state.role === "A") hostAdvanceTo(targetIndex);
  else room.send("request:advance", { index: targetIndex });
});
$("reveal-retry").addEventListener("click", () => {
  if (state.role === "A") hostRetry();
  else room.send("request:retry", levelPayload());
});

function hostRetry() {
  if (state.role !== "A" || !state.word) return;
  room.send("level:retry", levelPayload());
  resetGuessesKeepBoard();
}

function resetGuessesKeepBoard() {
  state.resolutionToken += 1;
  state.myGuess.fill(null);
  state.myGuessStr = null;
  state.submitted = false;
  state.partnerGuess = null;
  state.partnerSubmitted = false;
  renderAnswerBar();
  renderAttempts();
  showScreen("game");
}
