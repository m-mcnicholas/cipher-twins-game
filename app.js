// Cipher Twins — cooperative-language client.
//
// The lobby wires a PeerJS `Room` into a `GameHost` (host / Player A) or a
// `GameClient` (joiner / Player B). All shared state lives in the host's
// versioned revision (see core/revision.js); this file only renders that
// revision and turns UI events into validated operations. Private letters and
// the plaintext guess never leave this device — only a salted fingerprint of a
// guess is sent.

import { Room } from "./network.js";
import { GameHost, GameClient } from "./core/session.js";
import {
  createInitialRevision, snapshot, fromSnapshot,
  TUTORIAL_OBJECTIVES, tutorialObjectivesMet,
} from "./core/revision.js";
import { PUZZLE_COUNT } from "./core/palette.js";
import {
  deriveSalt, commitmentFor, guessIsCorrect, normalizeGuess,
  COMMITMENT_STATUS, COMMITMENT_MESSAGES,
} from "./core/commitments.js";
import { ICONS, ICON_GROUPS, renderIcon, renderSigilGlyph } from "./icons.js";
import { identityFor } from "./core/sigil-identity.js";
import { ACTIVE_WORDS, TIER_LENGTHS } from "./words/bank.js";

const $ = (id) => document.getElementById(id);
const SCREENS = ["lobby", "connecting", "game", "reveal", "complete", "error"];
const screens = Object.fromEntries(SCREENS.map((name) => [name, $(`screen-${name}`)]));
const wordMeta = (wordId) => ACTIVE_WORDS.find((w) => w.id === wordId) || null;

const state = {
  role: null,          // "A" | "B"
  room: null,
  host: null,          // GameHost when role === "A"
  client: null,        // GameClient when role === "B"
  composer: { tokens: [], replyTo: null },
  myGuess: [],
  myLetters: new Map(), // position -> letter, for the current round
  lettersForWord: null,
  filter: "all",
  lastRenderedWordId: null,
  lastAnnouncedMessageId: null,
  lastPhaseKey: null,
  knownPaletteIds: null,   // Set of icon ids seen last round, for "new icon" cues
  justUnlockedIds: [],
  tutorialDoneSeen: null,  // { key, set } — which checklist steps we've already announced
  recovering: null,
  demo: false,
};

function showScreen(name) {
  for (const [key, el] of Object.entries(screens)) el?.toggleAttribute("data-active", key === name);
  requestAnimationFrame(() => screens[name]?.focus({ preventScroll: true }));
}

function announce(text) {
  const region = $("sr-live");
  region.textContent = "";
  requestAnimationFrame(() => { region.textContent = text; });
}

const rev = () => state.host?.revision ?? state.client?.revision ?? null;
const partnerRole = () => (state.role === "A" ? "B" : "A");

function act(type, payload = {}) {
  if (state.demo) return; // the scripted demo drives both sides itself
  if (state.host) state.host.dispatchLocal({ type, payload });
  else state.client?.send(type, payload);
}

function newClientId() {
  const rand = crypto.randomUUID?.().slice(0, 16)
    ?? [...crypto.getRandomValues(new Uint8Array(8))].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${state.role}-${rand}`;
}

// ---- host word selection ------------------------------------------------

function makeHostWordSource(alreadyUsed = []) {
  const used = new Set(alreadyUsed);
  const parByIndex = {};
  let lastCategory = null;

  const stash = (key, meta) => { parByIndex[key] = { parTokens: meta.parTokens, parMessages: meta.parMessages }; };

  const nextWord = ({ tutorial, index, runNumber }) => {
    if (tutorial) {
      const w = ACTIVE_WORDS.find((a) => a.tutorial && a.slot === index) ?? ACTIVE_WORDS.find((a) => a.tutorial);
      lastCategory = w.category;
      stash(`t${index}`, w);
      return { wordId: w.id, wordLength: w.length, category: w.category };
    }
    const tier = index;
    let pool = ACTIVE_WORDS.filter((a) => a.tier === tier && !used.has(a.id));
    if (!pool.length) pool = ACTIVE_WORDS.filter((a) => a.tier === tier);
    if (runNumber > 1) {
      const harder = pool.filter((a) => a.familiarity <= 3);
      if (harder.length >= 2) pool = harder;
    }
    let choices = pool.filter((a) => a.category !== lastCategory);
    if (!choices.length) choices = pool;
    const pick = choices[crypto.getRandomValues(new Uint32Array(1))[0] % choices.length];
    used.add(pick.id);
    lastCategory = pick.category;
    stash(tier, pick);
    return { wordId: pick.id, wordLength: pick.length, category: pick.category };
  };

  const pars = (puzzleIndex) => parByIndex[puzzleIndex] ?? { parTokens: Infinity, parMessages: Infinity };
  return { nextWord, pars };
}

// ---- lobby ------------------------------------------------------------

$("host-room-btn").addEventListener("click", async () => {
  $("host-room-btn").disabled = true;
  state.room = new Room();
  wireRoom();
  try {
    const code = await state.room.host();
    $("host-code-value").textContent = code;
    $("host-code-display").hidden = false;
  } catch (error) {
    $("host-status").textContent = `Could not create a room: ${error.message}`;
    $("host-room-btn").disabled = false;
  }
});

$("host-copy-code").addEventListener("click", () => {
  navigator.clipboard?.writeText($("host-code-value").textContent).then(
    () => { $("host-status").textContent = "Room code copied."; },
    () => { $("host-status").textContent = "Copy failed — select the code by hand."; },
  );
});
$("host-share-link").addEventListener("click", () => {
  const url = `${location.origin}${location.pathname}#join=${$("host-code-value").textContent}`;
  navigator.clipboard?.writeText(url).then(
    () => { $("host-status").textContent = "Invite link copied."; },
    () => { $("host-status").textContent = "Copy failed — share the code instead."; },
  );
});
$("host-cancel").addEventListener("click", () => location.reload());

$("join-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const code = new FormData(event.target).get("code");
  if (!code) return;
  const submit = event.target.querySelector("button[type=submit]");
  submit.disabled = true;
  $("connecting-message").textContent = `Joining room ${String(code).toUpperCase()}…`;
  showScreen("connecting");
  state.room = new Room();
  wireRoom();
  try {
    await state.room.join(code);
  } catch (error) {
    showScreen("lobby");
    $("join-status").textContent = `Couldn't connect: ${error.message}`;
    submit.disabled = false;
  }
});

// Deep-link: #join=CODE prefills and focuses the join field.
if (location.hash.startsWith("#join=")) {
  const code = location.hash.slice(6).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
  if (code) { $("join-code-input").value = code; $("join-code-input").focus(); }
}

const params = new URLSearchParams(location.search);
const EPHEMERAL_MODE = Boolean(params.get("local") || params.get("demo"));
const hostNewId = () => `m-${(crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)).slice(0, 20)}`;

// ---- best-effort recovery persistence ------------------------------

const PERSIST_KEY = "cipherTwins:v1";

function persist() {
  if (EPHEMERAL_MODE || !state.room?.code || !state.role) return;
  if (rev()?.phase === "complete") { clearPersisted(); return; }
  try {
    const record = { code: state.room.code, role: state.role, version: rev()?.version ?? 0 };
    if (state.host) record.snapshot = snapshot(state.host.revision);
    sessionStorage.setItem(PERSIST_KEY, JSON.stringify(record));
  } catch { /* private mode / quota — recovery is best-effort */ }
}

function clearPersisted() {
  try { sessionStorage.removeItem(PERSIST_KEY); } catch { /* ignore */ }
}

function readPersisted() {
  try {
    const raw = sessionStorage.getItem(PERSIST_KEY);
    if (!raw) return null;
    const record = JSON.parse(raw);
    if (!record?.code || (record.role !== "A" && record.role !== "B")) return null;
    if (record.role === "A" && !record.snapshot) return null;
    return record;
  } catch { return null; }
}

// ---- same-machine mode: ?local=<CODE>&as=host|join ------------------

if (params.get("local")) {
  const code = params.get("local").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12) || "LOCALTEST";
  const as = params.get("as") === "join" ? "B" : "A";
  showScreen("connecting");
  $("connecting-message").textContent = `Local room ${code} — waiting for the other tab…`;
  import("./core/local-bridge.js").then(async ({ LocalBridgeRoom }) => {
    state.room = new LocalBridgeRoom(code, as);
    wireRoom();
    try {
      await state.room.connect();
    } catch (error) {
      $("load-error-message").textContent = error.message;
      showScreen("error");
    }
  });
} else if (params.get("demo")) {
  import("./core/bot-demo.js").then(({ startBotDemo }) => startBotDemo({ state, render, announce, showScreen }));
} else {
  const saved = readPersisted();
  if (saved) {
    $("resume-panel").hidden = false;
    $("resume-text").textContent = `You have a game in progress in room ${saved.code} as Player ${saved.role}.`;
    $("resume-btn").addEventListener("click", () => reconnect(saved));
    $("resume-discard").addEventListener("click", () => { clearPersisted(); $("resume-panel").hidden = true; });
  }
}

// ---- connection wiring --------------------------------------------

function wireRoom() {
  const room = state.room;
  room.addEventListener("connected", ({ detail }) => onConnected(detail));
  room.addEventListener("peer-rejoined", () => onPeerRejoined());
  room.addEventListener("peer-left", () => onPeerLeft());
  room.addEventListener("error", ({ detail }) => console.error("Room error:", detail?.err));
}

function buildHost(code, revision) {
  const knownWordIds = revision
    ? [revision.wordId, ...revision.archivedTranscripts.map((t) => t.wordId)].filter(Boolean)
    : [];
  const { nextWord, pars } = makeHostWordSource(knownWordIds);
  state.host = new GameHost(state.room, {
    revision: revision ?? createInitialRevision({
      roomCode: code,
      ownershipSeed: crypto.getRandomValues(new Uint8Array(1))[0],
    }),
    nextWord, pars, newId: hostNewId,
  });
  state.host.addEventListener("revision", () => { persist(); onRevision(); });
}

function buildClient(code, lastVersion = 0) {
  state.client = new GameClient(state.room, { role: "B" });
  state.client.addEventListener("revision", () => { persist(); onRevision(); });
  state.client.addEventListener("recommit-required", () => {
    announce("After reconnecting, please enter and commit your guess again.");
    render();
  });
  state.client.hello(`sess-${code}-B`, lastVersion);
}

function onConnected({ role, code }) {
  state.role = role;
  $("role-indicator").textContent = `You are Player ${role}`;
  $("role-indicator").dataset.role = role;
  hideRecovery();
  const recovering = state.recovering;
  state.recovering = null;

  if (role === "A") {
    buildHost(code, recovering ? fromSnapshot(recovering.snapshot) : null);
    if (recovering) {
      state.host.recoverPeer();
      announce("Reconnected. Your game is restored.");
    } else {
      state.host.dispatchLocal({ type: "level:advance", payload: { fromPhase: "lobby", fromIndex: null } });
    }
  } else {
    buildClient(code, recovering?.version ?? 0);
  }
  persist();
}

function onPeerRejoined() {
  clearTimeout(recoveryTimer);
  hideRecovery();
  $("connection-banner").hidden = false;
  $("connection-banner").textContent = "Your partner reconnected.";
  setTimeout(() => { $("connection-banner").hidden = true; }, 4000);
  announce("Your partner reconnected.");
  if (state.host) state.host.recoverPeer();
}

let recoveryTimer = null;
let joinerRetries = 0;

function onPeerLeft() {
  $("connection-banner").hidden = false;
  announce("Your partner disconnected.");
  clearTimeout(recoveryTimer);

  if (state.host) {
    $("connection-banner").textContent = `Your partner dropped out. Waiting for them to rejoin room ${state.room.code}…`;
    recoveryTimer = setTimeout(() => {
      showRecovery(`Your partner hasn't rejoined room ${state.room.code}. You can keep waiting, or start over.`);
    }, 30000);
  } else {
    $("connection-banner").textContent = "Lost the connection to the host — trying to reconnect…";
    joinerRetries = 0;
    state.recovering = readPersisted();
    retryJoin();
  }
}

async function retryJoin() {
  const code = state.room?.code;
  if (!code) return;
  joinerRetries += 1;
  const stale = state.room;
  try {
    state.room = new Room();
    wireRoom();
    await state.room.join(code);
    stale?.close?.();
  } catch (error) {
    if (joinerRetries < 4) {
      recoveryTimer = setTimeout(retryJoin, 3000);
    } else {
      showRecovery("We can't reach the host. They may have closed the game or lost their connection.");
    }
  }
}

function reconnect(saved) {
  state.recovering = saved;
  $("resume-panel").hidden = true;
  hideRecovery();
  showScreen("connecting");
  $("connecting-message").textContent = `Reconnecting to room ${saved.code}…`;
  state.room = new Room();
  wireRoom();
  const attempt = saved.role === "A" ? state.room.host(saved.code) : state.room.join(saved.code);
  attempt.catch((error) => {
    showRecovery(`Couldn't rejoin room ${saved.code}: ${error.message}`);
  });
}

function showRecovery(text) {
  clearTimeout(recoveryTimer);
  $("recovery-text").textContent = text;
  $("recovery-panel").hidden = false;
  requestAnimationFrame(() => $("recovery-retry").focus());
}
function hideRecovery() {
  clearTimeout(recoveryTimer);
  $("recovery-panel").hidden = true;
}

$("recovery-retry").addEventListener("click", () => {
  hideRecovery();
  const saved = readPersisted();
  if (saved) reconnect(saved);
  else if (state.host) {
    $("connection-banner").textContent = `Still hosting room ${state.room.code} — waiting for your partner.`;
  } else location.reload();
});
$("recovery-lobby").addEventListener("click", () => { clearPersisted(); location.href = location.pathname; });
$("recovery-new").addEventListener("click", () => { clearPersisted(); location.href = location.pathname; });

function onRevision() {
  const r = rev();
  if (!r) return;
  maybeLoadLetters(r).then(render).catch((error) => {
    console.error(error);
    $("load-error-message").textContent = "Your half of this word could not be loaded. Check your connection and try again.";
    showScreen("error");
  });
}

$("load-retry").addEventListener("click", () => {
  state.lettersForWord = null;
  onRevision();
});

// ---- per-round private letters --------------------------------------

async function maybeLoadLetters(r) {
  if (!r.wordId || (r.phase !== "puzzle" && r.phase !== "tutorial")) return;
  if (state.lettersForWord === r.wordId) return;
  const parity = r.ownership[state.role];
  const module = parity === "odd"
    ? await import("./words/bank-odd.js")
    : await import("./words/bank-even.js");
  const slice = module.default[r.wordId];
  if (!slice) throw new Error(`No ${parity} slice for ${r.wordId}`);
  state.myLetters = new Map(slice.positions.map((pos, i) => [pos, slice.letters[i]]));
  state.lettersForWord = r.wordId;
  state.myGuess = freshGuess(r);
  state.composer = { tokens: [], replyTo: null };
}

// A blank guess with the player's own (already visible) letters pre-filled and
// locked. They only ever need to type their partner's half.
function freshGuess(r) {
  const guess = Array(r.wordLength).fill(null);
  for (const [pos, letter] of state.myLetters) {
    if (pos >= 1 && pos <= r.wordLength) guess[pos - 1] = letter;
  }
  return guess;
}

const guessPositionLocked = (index) => state.myLetters.has(index + 1);

// ---- top-level render ----------------------------------------------

const TUTORIAL_TEXT = [
  "Round one. Work through the checklist together: send a card, reply to your partner, "
  + "and land on the same private guess. You can leave once every step is ticked and you both say you're ready.",
  "Round two. Turn a useful card into a saved sigil: one of you proposes it, the other approves it, "
  + "then drop it into a new card. Finish the checklist and you're through.",
];

const OBJECTIVE_LABELS = {
  sentCard: "Send a card",
  repliedToPartner: "Reply to your partner's card",
  matchedGuess: "Both commit the same private guess",
  proposedSigil: "Turn one of your cards into a sigil",
  approvedSigil: "Approve your partner's sigil",
  reusedSigil: "Drop a saved sigil into a new card",
};

function render() {
  const r = rev();
  if (!r) return;

  if (r.phase === "complete") { renderComplete(r); showScreen("complete"); return; }
  if (r.phase === "reveal") { renderReveal(r); showScreen("reveal"); return; }
  if (r.phase !== "puzzle" && r.phase !== "tutorial") { showScreen("connecting"); return; }

  const phaseKey = `${r.phase}:${r.phase === "tutorial" ? r.tutorialIndex : r.puzzleIndex}`;
  const roundChanged = phaseKey !== state.lastPhaseKey;
  if (roundChanged) state.justUnlockedIds = newlyUnlocked(r);

  renderTopbar(r);
  renderTutorialBanner(r);
  renderRoundFacts(r);
  renderWordTrack(r);
  renderPartnerPresence(r);
  renderConversation(r);
  renderArchive(r);
  renderComposer(r);
  renderPaletteDrawer(r);
  renderLexicon(r);
  renderAnswer(r);
  showScreen("game");

  if (roundChanged) {
    state.lastPhaseKey = phaseKey;
    const place = r.phase === "tutorial"
      ? `Tutorial ${r.tutorialIndex + 1} of 2.`
      : `Puzzle ${r.puzzleIndex + 1} of ${PUZZLE_COUNT}.`;
    const unlocked = state.justUnlockedIds.length
      ? ` New icons unlocked: ${state.justUnlockedIds.map((id) => ICONS[id]?.label ?? id).join(", ")}.`
      : "";
    announce(place + unlocked);
  }
}

// Icon ids in the current palette that were not in the palette we last saw.
// Returns [] the first time (nothing to celebrate) and after a keep-lexicon
// rematch (which starts on the full palette).
function newlyUnlocked(r) {
  const current = r.unlockedPalette ?? [];
  const known = state.knownPaletteIds;
  state.knownPaletteIds = new Set(current);
  if (!known) return [];
  return current.filter((id) => !known.has(id));
}

// ---- partner presence ----------------------------------------------
// The reducer already models { composing, guessReady } per role and the host
// relays it out-of-band (core/session.js). We just debounce our own signal and
// show the partner's.

let presenceTimer = null;
let lastPresenceSig = "";

function pushPresence() {
  const r = rev();
  if (!r || state.demo) return;
  const composing = state.composer.tokens.length > 0 || state.composer.replyTo != null;
  const committed = r.commitments?.[state.role] != null;
  const guessReady = committed
    || (state.myGuess.length === r.wordLength && state.myGuess.length > 0 && state.myGuess.every(Boolean));
  const sig = `${composing}|${guessReady}`;
  if (sig === lastPresenceSig) return;
  lastPresenceSig = sig;
  act("presence:update", { composing, guessReady });
}

function schedulePresence() {
  if (state.demo) return;
  clearTimeout(presenceTimer);
  presenceTimer = setTimeout(pushPresence, 200);
}

function renderPartnerPresence(r) {
  const el = $("partner-presence");
  if (!el) return;
  const them = r.presence?.[partnerRole()] ?? {};
  const text = them.composing ? `Player ${partnerRole()} is building a card…`
    : them.guessReady ? `Player ${partnerRole()} is ready to guess.`
    : "";
  el.textContent = text;
  el.hidden = !text;
}

function renderTopbar(r) {
  const isTut = r.phase === "tutorial";
  $("round-label").textContent = isTut ? "Tutorial" : "Puzzle";
  $("round-label").classList.toggle("round-label-tutorial", isTut);
  $("round-number").textContent = isTut ? `${r.tutorialIndex + 1} / 2` : `${r.puzzleIndex + 1} / 7`;
  const total = Object.values(r.stars).reduce((a, b) => a + b, 0);
  $("stars-indicator").textContent = total ? `★ ${total}` : "";
}

function renderTutorialBanner(r) {
  const banner = $("tutorial-banner");
  if (r.phase !== "tutorial") { banner.hidden = true; return; }
  banner.hidden = false;
  $("tutorial-text").textContent = TUTORIAL_TEXT[r.tutorialIndex] ?? "";

  const done = r.tutorialObjectives ?? {};
  const required = TUTORIAL_OBJECTIVES[r.tutorialIndex] ?? [];
  const allDone = tutorialObjectivesMet(r.tutorialIndex, done);
  const listEl = $("tutorial-checklist");
  listEl.replaceChildren();
  for (const key of required) {
    const li = document.createElement("li");
    li.className = done[key] ? "checklist-item checklist-done" : "checklist-item";
    li.textContent = `${done[key] ? "✓" : "○"} ${OBJECTIVE_LABELS[key] ?? key}`;
    listEl.append(li);
  }

  // Announce a step the moment it flips to done.
  const doneKeys = required.filter((k) => done[k]);
  const prevKey = `${r.phase}:${r.tutorialIndex}`;
  if (state.tutorialDoneSeen?.key === prevKey) {
    for (const k of doneKeys) {
      if (!state.tutorialDoneSeen.set.has(k)) announce(`Step done: ${OBJECTIVE_LABELS[k] ?? k}.`);
    }
  }
  state.tutorialDoneSeen = { key: prevKey, set: new Set(doneKeys) };

  const myReady = r.tutorialReadyVotes?.[state.role];
  const theirReady = r.tutorialReadyVotes?.[partnerRole()];
  const mine = r.tutorialSkipVotes?.[state.role];
  const theirs = r.tutorialSkipVotes?.[partnerRole()];
  $("tutorial-skip-note").textContent =
    myReady && theirReady && !allDone ? "You're both ready — finish the checklist above to continue."
    : myReady && !theirReady ? "Waiting for your partner to also say they're ready…"
    : !myReady && theirReady ? "Your partner is ready — say you're ready once the steps are done."
    : mine && !theirs ? "Waiting for your partner to also agree to skip…"
    : !mine && theirs ? "Your partner wants to skip the tutorials."
    : "";

  const nextBtn = $("tutorial-next");
  nextBtn.disabled = !allDone;
  nextBtn.textContent = !allDone ? "Finish the steps to continue"
    : myReady ? "Waiting for partner…"
    : "We're ready — continue";
}

$("tutorial-next").addEventListener("click", () => {
  const r = rev();
  act("tutorial:readyVote", { vote: !r.tutorialReadyVotes?.[state.role] });
});
$("tutorial-skip").addEventListener("click", () => {
  const r = rev();
  const mine = r.tutorialSkipVotes?.[state.role];
  act("tutorial:skipVote", { vote: !mine });
});

function renderRoundFacts(r) {
  $("fact-category").textContent = r.category ? `Category: ${r.category}` : "";
  $("fact-length").textContent = `Length: ${r.wordLength}`;
  const parity = r.ownership[state.role];
  $("fact-parity").textContent = `You hold the ${parity}-numbered letters`;
}

function renderWordTrack(r) {
  const track = $("word-track");
  track.replaceChildren();
  for (let position = 1; position <= r.wordLength; position += 1) {
    const mine = state.myLetters.has(position);
    const cell = document.createElement("div");
    cell.className = `track-cell ${mine ? "track-cell-mine" : "track-cell-partner"}`;
    const glyph = document.createElement("div");
    glyph.className = mine ? "track-letter" : "track-blank";
    glyph.textContent = mine ? state.myLetters.get(position) : "?";
    const label = document.createElement("span");
    label.className = "track-pos";
    label.textContent = String(position);
    cell.append(glyph, label);
    cell.setAttribute("role", "listitem");
    cell.setAttribute("aria-label", mine
      ? `Position ${position}, your letter ${state.myLetters.get(position)}`
      : `Position ${position}, partner letter hidden`);
    track.append(cell);
  }
  track.setAttribute("role", "list");
}

// ---- conversation --------------------------------------------------

function tokenChip(token, r) {
  const chip = document.createElement("span");
  chip.className = `token-chip token-${token.kind}`;
  if (token.kind === "icon") {
    const icon = ICONS[token.id];
    chip.innerHTML = renderIcon(token.id);
    chip.setAttribute("aria-label", icon?.label ?? token.id);
    chip.title = icon?.label ?? token.id;
  } else {
    const sigil = r.sigils.confirmed.find((s) => s.id === token.id);
    const meaning = sigil ? sigil.tokens.map((t) => ICONS[t.id]?.label ?? t.id).join(" · ") : "";
    if (sigil) {
      const id = identityFor(sigil.tokens);
      chip.style.setProperty("--sigil-hue", String(id.hue));
      const badge = document.createElement("span");
      badge.className = "sigil-badge";
      badge.innerHTML = renderSigilGlyph(id.glyphIndex);
      chip.append(badge, document.createTextNode(sigil.alias));
    } else {
      chip.textContent = token.id;
    }
    chip.setAttribute("aria-label", `${sigil?.alias ?? token.id}${meaning ? `, meaning ${meaning}` : ""}`);
    if (sigil) chip.title = `${sigil.alias}: ${meaning}`;
  }
  return chip;
}

function renderConversation(r) {
  if (!r) return;
  const list = $("conversation-list");
  const wasNearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 40;
  list.replaceChildren();
  const visible = r.messages.filter((m) => {
    if (state.filter === "mine") return m.author === state.role;
    if (state.filter === "partner") return m.author !== state.role;
    return true;
  });
  if (!visible.length) {
    const empty = document.createElement("li");
    empty.className = "conversation-empty";
    empty.textContent = r.messages.length ? "No messages match this filter." : "No messages yet — compose the first card below.";
    list.append(empty);
  }
  for (const message of visible) {
    const item = document.createElement("li");
    item.className = `message-card message-${message.author === state.role ? "mine" : "theirs"}`;
    item.dataset.author = message.author;

    const meta = document.createElement("div");
    meta.className = "message-meta";
    const badge = document.createElement("span");
    badge.className = "author-badge";
    badge.dataset.role = message.author;
    badge.textContent = `Player ${message.author}`;
    const seq = document.createElement("span");
    seq.className = "message-seq";
    seq.textContent = `#${message.seq + 1}`;
    meta.append(badge, seq);
    if (message.replyTo != null) {
      const replySeq = r.messages.find((m) => m.id === message.replyTo)?.seq;
      const reply = document.createElement("span");
      reply.className = "message-reply-ref";
      reply.textContent = replySeq == null ? "↳ reply" : `↳ replying to #${replySeq + 1}`;
      meta.append(reply);
    }
    item.append(meta);

    const tokens = document.createElement("div");
    tokens.className = "message-tokens";
    for (const token of message.tokens) tokens.append(tokenChip(token, r));
    item.append(tokens);

    const replyLabel = message.replyTo != null
      ? `, replying to message ${(r.messages.find((m) => m.id === message.replyTo)?.seq ?? 0) + 1}`
      : "";
    item.setAttribute("aria-label", `Message ${message.seq + 1} from Player ${message.author}`
      + `${message.author === state.role ? " (you)" : ""}${replyLabel}: `
      + message.tokens.map((t) => t.kind === "icon" ? (ICONS[t.id]?.label ?? t.id) : (r.sigils.confirmed.find((s) => s.id === t.id)?.alias ?? t.id)).join(", "));

    const actions = document.createElement("div");
    actions.className = "message-actions";
    const replyBtn = document.createElement("button");
    replyBtn.type = "button";
    replyBtn.className = "micro-button micro-reply";
    replyBtn.textContent = "↳ Reply";
    replyBtn.addEventListener("click", () => { state.composer.replyTo = message.id; render(); });
    actions.append(replyBtn);
    if (message.author === state.role) {
      if (message.tokens.length >= 2 && !r.sigils.confirmed.some((s) => sameTokens(s.tokens, message.tokens)) && !r.sigils.pending.some((s) => sameTokens(s.tokens, message.tokens))) {
        const sigilBtn = document.createElement("button");
        sigilBtn.type = "button";
        sigilBtn.className = "micro-button";
        sigilBtn.textContent = "Save as sigil";
        sigilBtn.addEventListener("click", () => act("sigil:propose", { clientId: newClientId(), sourceMessageId: message.id }));
        actions.append(sigilBtn);
      }
      const retractBtn = document.createElement("button");
      retractBtn.type = "button";
      retractBtn.className = "micro-button micro-danger";
      retractBtn.textContent = "Retract";
      retractBtn.addEventListener("click", () => act("message:retract", { messageId: message.id }));
      actions.append(retractBtn);
    }
    item.append(actions);
    list.append(item);
  }

  const newest = r.messages.at(-1);
  if (!r.messages.length) $("new-message-pill").hidden = true;
  if (newest && newest.id !== state.lastAnnouncedMessageId) {
    state.lastAnnouncedMessageId = newest.id;
    if (newest.author !== state.role) announce(`Player ${newest.author} sent message ${newest.seq + 1}.`);
    if (wasNearBottom) {
      list.scrollTop = list.scrollHeight;
      $("new-message-pill").hidden = true;
    } else {
      $("new-message-pill").hidden = false;
    }
  }
}

$("new-message-pill").addEventListener("click", () => {
  const list = $("conversation-list");
  list.scrollTop = list.scrollHeight;
  $("new-message-pill").hidden = true;
});
$("conversation-list").addEventListener("scroll", () => {
  const list = $("conversation-list");
  if (!$("new-message-pill").hidden && list.scrollHeight - list.scrollTop - list.clientHeight < 40) {
    $("new-message-pill").hidden = true;
  }
});

function sameTokens(a, b) {
  return a.length === b.length && a.every((t, i) => t.kind === b[i].kind && t.id === b[i].id);
}

function renderArchive(r) {
  const details = $("archive-details");
  if (!r.archivedTranscripts.length) { details.hidden = true; return; }
  details.hidden = false;
  const body = $("archive-body");
  body.replaceChildren();
  for (const transcript of r.archivedTranscripts) {
    const block = document.createElement("div");
    block.className = "archive-block";
    const head = document.createElement("h3");
    head.textContent = transcript.scope === "tutorial"
      ? `Tutorial ${transcript.index + 1}`
      : `Puzzle ${transcript.index + 1}`;
    block.append(head);
    for (const message of transcript.messages) {
      const line = document.createElement("p");
      line.className = "archive-line";
      line.textContent = `Player ${message.author} #${message.seq + 1}: `
        + message.tokens.map((t) => t.kind === "icon" ? (ICONS[t.id]?.label ?? t.id) : t.id).join(", ");
      block.append(line);
    }
    body.append(block);
  }
}

for (const btn of document.querySelectorAll(".filter-btn")) {
  btn.addEventListener("click", () => {
    state.filter = btn.dataset.filter;
    for (const other of document.querySelectorAll(".filter-btn")) {
      other.setAttribute("aria-pressed", String(other === btn));
    }
    renderConversation(rev());
  });
}

// ---- composer ----------------------------------------------------

function renderComposer(r) {
  const tray = $("composer-tray");
  tray.replaceChildren();
  state.composer.tokens.forEach((token, index) => {
    const chip = tokenChip(token, r);
    chip.classList.add("tray-chip");
    const left = document.createElement("button");
    left.type = "button"; left.className = "tray-move"; left.textContent = "‹"; left.title = "Move left";
    left.disabled = index === 0;
    left.addEventListener("click", () => { swap(index, index - 1); });
    const right = document.createElement("button");
    right.type = "button"; right.className = "tray-move"; right.textContent = "›"; right.title = "Move right";
    right.disabled = index === state.composer.tokens.length - 1;
    right.addEventListener("click", () => { swap(index, index + 1); });
    const remove = document.createElement("button");
    remove.type = "button"; remove.className = "tray-remove"; remove.textContent = "✕"; remove.title = "Remove";
    remove.addEventListener("click", () => { state.composer.tokens.splice(index, 1); renderComposer(r); updateSend(); });
    const wrap = document.createElement("span");
    wrap.className = "tray-item";
    wrap.append(left, chip, right, remove);
    tray.append(wrap);
  });
  if (!state.composer.tokens.length) {
    const hint = document.createElement("span");
    hint.className = "tray-hint";
    hint.textContent = "Add icons or sigils, then send.";
    tray.append(hint);
  }

  const replyChip = $("reply-chip");
  if (state.composer.replyTo != null) {
    const seq = r.messages.find((m) => m.id === state.composer.replyTo)?.seq;
    replyChip.hidden = false;
    replyChip.textContent = seq == null ? "↳ Replying to a message" : `↳ Replying to #${seq + 1}`;
    const clear = document.createElement("button");
    clear.type = "button"; clear.className = "micro-button"; clear.textContent = "✕";
    clear.addEventListener("click", () => { state.composer.replyTo = null; render(); });
    replyChip.append(" ", clear);
  } else {
    replyChip.hidden = true;
    replyChip.textContent = "";
  }
  updateSend();
  schedulePresence();
}

function swap(i, j) {
  const t = state.composer.tokens;
  [t[i], t[j]] = [t[j], t[i]];
  renderComposer(rev());
}

function updateSend() {
  $("composer-send").disabled = state.composer.tokens.length === 0;
}

$("composer-clear").addEventListener("click", () => {
  state.composer = { tokens: [], replyTo: null };
  render();
});
$("composer-send").addEventListener("click", () => {
  if (!state.composer.tokens.length) return;
  act("message:send", {
    clientId: newClientId(),
    tokens: state.composer.tokens.map((t) => ({ ...t })),
    replyTo: state.composer.replyTo,
  });
  state.composer = { tokens: [], replyTo: null };
  render();
});

const DRAWERS = [["composer-palette-toggle", "palette-drawer"], ["composer-lexicon-toggle", "lexicon-drawer"]];
for (const [id, drawer] of DRAWERS) {
  $(id).addEventListener("click", () => {
    const el = $(drawer);
    const opening = el.hidden;
    // Only one drawer open at a time on narrow screens.
    for (const [otherId, otherDrawer] of DRAWERS) {
      if (otherDrawer === drawer) continue;
      $(otherDrawer).hidden = true;
      $(otherId).setAttribute("aria-expanded", "false");
    }
    el.hidden = !opening;
    $(id).setAttribute("aria-expanded", String(opening));
    if (opening) requestAnimationFrame(() => el.querySelector("button, [tabindex]")?.focus());
  });
}

function closeDrawers(returnFocusToId) {
  let closedAny = false;
  for (const [id, drawer] of DRAWERS) {
    if (!$(drawer).hidden) { $(drawer).hidden = true; $(id).setAttribute("aria-expanded", "false"); closedAny = true; }
  }
  if (closedAny && returnFocusToId) $(returnFocusToId)?.focus();
  return closedAny;
}

function renderPaletteDrawer(r) {
  const drawer = $("palette-drawer");
  drawer.replaceChildren();
  const allowed = new Set(r.unlockedPalette);
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
      button.className = state.justUnlockedIds.includes(id) ? "palette-icon just-unlocked" : "palette-icon";
      button.title = ICONS[id].label;
      button.setAttribute("aria-label", `Add ${ICONS[id].label}`);
      button.innerHTML = `${renderIcon(id)}<span class="icon-label">${ICONS[id].label}</span>`;
      button.addEventListener("click", () => {
        state.composer.tokens.push({ kind: "icon", id });
        renderComposer(r);
      });
      row.append(button);
    }
    group.append(heading, row);
    drawer.append(group);
  }
}

function renderLexicon(r) {
  const confirmed = $("lexicon-confirmed");
  confirmed.replaceChildren();
  const chead = document.createElement("h3");
  chead.textContent = `Saved sigils (${r.sigils.confirmed.length})`;
  confirmed.append(chead);
  if (!r.sigils.confirmed.length) {
    const p = document.createElement("p");
    p.className = "lexicon-empty";
    p.textContent = "None yet. Send a useful two-icon-or-more message, then choose “Save as sigil”.";
    confirmed.append(p);
  }
  for (const sigil of r.sigils.confirmed) {
    const wrap = document.createElement("div");
    wrap.className = "sigil-row";
    const ident = identityFor(sigil.tokens);
    wrap.style.setProperty("--sigil-hue", String(ident.hue));
    const label = document.createElement("span");
    label.className = "sigil-alias";
    const badge = document.createElement("span");
    badge.className = "sigil-badge";
    badge.innerHTML = renderSigilGlyph(ident.glyphIndex);
    label.append(badge, document.createTextNode(sigil.alias));
    const uses = r.sigilUses?.[sigil.id] ?? 0;
    if (uses > 0) {
      const tally = document.createElement("span");
      tally.className = "sigil-uses";
      tally.textContent = `used ${uses}×`;
      label.append(" ", tally);
    }
    const preview = document.createElement("span");
    preview.className = "sigil-preview";
    for (const token of sigil.tokens) preview.append(tokenChip(token, r));
    const insert = document.createElement("button");
    insert.type = "button";
    insert.className = "micro-button";
    insert.textContent = "Insert";
    insert.addEventListener("click", () => {
      state.composer.tokens.push({ kind: "sigil", id: sigil.id });
      renderComposer(r);
    });
    wrap.append(label, preview, insert);
    confirmed.append(wrap);
  }

  const pending = $("lexicon-pending");
  pending.replaceChildren();
  if (r.sigils.pending.length) {
    const phead = document.createElement("h3");
    phead.textContent = "Awaiting approval";
    pending.append(phead);
  }
  for (const sigil of r.sigils.pending) {
    const wrap = document.createElement("div");
    wrap.className = "sigil-row sigil-pending";
    const label = document.createElement("span");
    label.className = "sigil-alias";
    label.textContent = sigil.alias;
    const preview = document.createElement("span");
    preview.className = "sigil-preview";
    for (const token of sigil.tokens) preview.append(tokenChip(token, r));
    wrap.append(label, preview);
    if (sigil.proposedBy === state.role) {
      const note = document.createElement("span");
      note.className = "sigil-note";
      note.textContent = "Waiting for your partner…";
      const cancel = document.createElement("button");
      cancel.type = "button"; cancel.className = "micro-button micro-danger"; cancel.textContent = "Cancel";
      cancel.addEventListener("click", () => act("sigil:reject", { sigilId: sigil.id }));
      wrap.append(note, cancel);
    } else {
      const yes = document.createElement("button");
      yes.type = "button"; yes.className = "micro-button"; yes.textContent = "Approve";
      yes.addEventListener("click", () => act("sigil:confirm", { sigilId: sigil.id }));
      const no = document.createElement("button");
      no.type = "button"; no.className = "micro-button micro-danger"; no.textContent = "Reject";
      no.addEventListener("click", () => act("sigil:reject", { sigilId: sigil.id }));
      wrap.append(yes, no);
      announce(`Player ${sigil.proposedBy} wants to save ${sigil.alias}.`);
    }
    pending.append(wrap);
  }
}

// ---- private guess ----------------------------------------------

function renderAnswer(r) {
  if (state.myGuess.length !== r.wordLength) state.myGuess = freshGuess(r);
  const bar = $("answer-bar");
  bar.replaceChildren();
  const committed = r.commitments?.[state.role] != null;
  const nextEmpty = state.myGuess.indexOf(null);
  state.myGuess.forEach((letter, index) => {
    const slot = document.createElement("span");
    const locked = guessPositionLocked(index);
    const isCurrent = !committed && index === nextEmpty;
    slot.className = `answer-slot${letter ? " filled" : ""}${locked ? " locked" : ""}${isCurrent ? " current" : ""}`;
    slot.textContent = letter ?? "";
    slot.setAttribute("aria-label", locked
      ? `Position ${index + 1}, your letter ${letter}, already known`
      : `Guess position ${index + 1}${letter ? `, ${letter}` : ", empty"}`);
    bar.append(slot);
  });

  const picker = $("letter-picker");
  if (!picker.childElementCount) {
    for (const letter of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "letter-tile";
      button.textContent = letter;
      button.addEventListener("click", () => fillLetter(letter));
      picker.append(button);
    }
  }

  const iCommitted = r.commitments?.[state.role] != null;
  const partnerCommitted = r.commitments?.[partnerRole()] != null;
  const full = state.myGuess.every(Boolean);
  $("answer-commit").disabled = !full || iCommitted;
  $("answer-commit").hidden = iCommitted;
  $("answer-retract").hidden = !(iCommitted && !partnerCommitted);
  for (const tile of picker.children) tile.disabled = iCommitted;
  $("answer-backspace").disabled = iCommitted;
  $("answer-clear").disabled = iCommitted;

  let status = "";
  if (iCommitted && !partnerCommitted) status = "Your fingerprint is in. Waiting for your partner… (you can still take it back)";
  else if (iCommitted && partnerCommitted) status = "Comparing…";
  else if (r.lastOutcome?.tutorial) status = COMMITMENT_MESSAGES[r.lastOutcome.status];
  $("answer-status").textContent = status;
  schedulePresence();
}

function fillLetter(letter) {
  const r = rev();
  if (r.commitments?.[state.role] != null) return;
  const index = state.myGuess.indexOf(null);
  if (index >= 0) state.myGuess[index] = letter;
  renderAnswer(r);
}

document.addEventListener("keydown", (event) => {
  if (!screens.game.hasAttribute("data-active")) return;
  const target = event.target;
  if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
  if (event.key === "Escape") {
    if (closeDrawers(document.activeElement?.closest(".drawer") ? "composer-palette-toggle" : null)) return;
    if (state.composer.replyTo != null) { state.composer.replyTo = null; render(); }
    return;
  }
  if (target && (target.tagName === "BUTTON" || target.closest(".drawer") || target.closest(".conversation-list"))) return;
  if (/^[a-zA-Z]$/.test(event.key)) { fillLetter(event.key.toUpperCase()); }
  else if (event.key === "Backspace") { event.preventDefault(); backspaceGuess(); }
});

function backspaceGuess() {
  const r = rev();
  if (r.commitments?.[state.role] != null) return;
  // Only clear a letter the player typed themselves; their own half stays locked.
  for (let index = state.myGuess.length - 1; index >= 0; index -= 1) {
    if (state.myGuess[index] && !guessPositionLocked(index)) { state.myGuess[index] = null; break; }
  }
  renderAnswer(r);
}

$("answer-bar").addEventListener("click", () => $("answer-bar").focus());

$("answer-backspace").addEventListener("click", backspaceGuess);
$("answer-clear").addEventListener("click", () => {
  const r = rev();
  if (r.commitments?.[state.role] != null) return;
  state.myGuess = freshGuess(r);
  renderAnswer(r);
});

$("answer-commit").addEventListener("click", async () => {
  const r = rev();
  const guess = normalizeGuess(state.myGuess.join(""));
  if (guess.length !== r.wordLength) return;
  const roundKey = r.phase === "tutorial" ? `t${r.tutorialIndex}` : r.puzzleIndex;
  const salt = deriveSalt({ roomCode: r.roomCode, runNumber: r.runNumber, puzzleIndex: roundKey, wordId: r.wordId });
  const commitment = await commitmentFor(guess, salt);
  if (state.host) {
    const meta = wordMeta(r.wordId);
    state.host.localGuessCorrect = meta ? await guessIsCorrect(guess, meta.answerHash) : false;
  }
  act("guess:commit", { commitment });
});
$("answer-retract").addEventListener("click", () => act("guess:retractCommit", {}));

// ---- reveal / complete ----------------------------------------

function starString(count) { return "★★★".slice(0, count) + "☆☆☆".slice(0, 3 - count); }

// A short plain-language reason for the star count, from the scoring breakdown.
function starReason(stars, outcome) {
  const b = outcome.breakdown ?? {};
  if (stars === 3) {
    return b.leanedOnLanguage
      ? "first-try match, and you leaned on your own language."
      : "first-try match with no shared words yet — clean.";
  }
  if (stars === 2) {
    if (outcome.attempt > 1) return "you got there in two — the first guesses didn't line up.";
    if (b.noLanguageYet) return "first-try match, but it took a lot of icons.";
    return "first-try match — save and reuse a sigil for the third star.";
  }
  return "solved — it took a few tries.";
}

// A ratio of "used / par", or just the used count when the par is unknown.
function vsPar(used, par) {
  return Number.isFinite(par) ? `${used} / ${par}` : String(used);
}

// Fills the reveal scorecard <dl> so a star result is legible: what the pair
// spent against par, and which attempt solved it. Pars/totals come straight
// from the reducer's ledger via lastOutcome (WP-0).
function fillScorecard(outcome) {
  const dl = $("reveal-scorecard");
  dl.replaceChildren();
  const haveNumbers = Number.isFinite(outcome.tokens) && Number.isFinite(outcome.messages);
  if (!haveNumbers) { dl.hidden = true; return; }
  const rows = [
    ["Tokens sent", vsPar(outcome.tokens, outcome.parTokens)],
    ["Cards sent", vsPar(outcome.messages, outcome.parMessages)],
    ["Solved on", `attempt ${outcome.attempt}`],
  ];
  const reuses = outcome.breakdown?.sigilReuses ?? 0;
  if (reuses > 0) rows.push(["Sigils reused", `${reuses}×`]);
  for (const [term, value] of rows) {
    const dt = document.createElement("dt");
    dt.textContent = term;
    const dd = document.createElement("dd");
    dd.textContent = value;
    dl.append(dt, dd);
  }
  dl.hidden = false;
}

// On a solve, both players hold the full word: state.myGuess is the exact
// string they just committed. Render it as the two colour-coded halves joining.
function renderRevealWord(r) {
  const host = $("reveal-word");
  host.replaceChildren();
  const word = state.myGuess;
  const usable = Array.isArray(word) && word.length === r.wordLength && word.every(Boolean);
  if (!usable) {
    host.classList.remove("reveal-word-joined");
    host.textContent = `Puzzle ${r.puzzleIndex + 1} down`;
    return;
  }
  host.classList.add("reveal-word-joined");
  word.forEach((letter, index) => {
    const span = document.createElement("span");
    span.className = `reveal-half ${guessPositionLocked(index) ? "reveal-half-mine" : "reveal-half-partner"}`;
    span.style.setProperty("--i", String(index));
    span.textContent = letter;
    host.append(span);
  });
  host.setAttribute("aria-label", `The word was ${word.join("")}`);
}

function renderReveal(r) {
  const outcome = r.lastOutcome ?? {};
  const solved = outcome.status === COMMITMENT_STATUS.SOLVED;
  $("reveal-stars").textContent = solved ? starString(r.stars[r.puzzleIndex] ?? 1) : "";
  if (solved) {
    const stars = r.stars[r.puzzleIndex] ?? 1;
    $("reveal-kicker").textContent = "Solved";
    renderRevealWord(r);
    $("reveal-detail").textContent =
      `Puzzle ${r.puzzleIndex + 1} down · ${stars} star${stars === 1 ? "" : "s"} — ${starReason(stars, outcome)}`;
    fillScorecard(outcome);
    $("reveal-next").hidden = false;
    $("reveal-retry").hidden = true;
    const scoreSpoken = Number.isFinite(outcome.tokens)
      ? ` ${outcome.tokens} tokens${Number.isFinite(outcome.parTokens) ? ` against a par of ${outcome.parTokens}` : ""}, ${outcome.messages} cards.`
      : "";
    announce(`Solved. ${stars} stars.${scoreSpoken}`);
  } else {
    $("reveal-scorecard").hidden = true;
    $("reveal-kicker").textContent = outcome.status === COMMITMENT_STATUS.AGREED_WRONG ? "Agreed — but not the answer" : "Not aligned yet";
    $("reveal-word").classList.remove("reveal-word-joined");
    $("reveal-word").textContent = "";
    $("reveal-detail").textContent = COMMITMENT_MESSAGES[outcome.status] ?? "Try again.";
    $("reveal-next").hidden = true;
    $("reveal-retry").hidden = false;
    announce(COMMITMENT_MESSAGES[outcome.status] ?? "Try again.");
  }
}

$("reveal-next").addEventListener("click", () => {
  const r = rev();
  act("level:advance", { fromPhase: "reveal", fromIndex: r.puzzleIndex });
});
$("reveal-retry").addEventListener("click", () => {
  state.myGuess = freshGuess(rev());
  act("level:retry", {});
});

function renderComplete(r) {
  const total = Object.values(r.stars).reduce((a, b) => a + b, 0);
  const max = PUZZLE_COUNT * 3;
  $("complete-stars").textContent = "★".repeat(Math.min(total, max));
  $("complete-score").textContent = `${total} / ${max} stars`;
  renderLexiconRecap(r);
  announce(`All puzzles complete. ${total} of ${max} stars.`);
}

// The end-screen celebration of the shared language: what the pair coined and
// how much they leaned on it. Makes "keep our language" a real choice.
function renderLexiconRecap(r) {
  const box = $("lexicon-recap");
  if (!box) return;
  box.replaceChildren();
  const sigils = r.sigils?.confirmed ?? [];
  if (!sigils.length) {
    box.hidden = true;
    return;
  }
  const uses = r.sigilUses ?? {};
  const totalReuse = sigils.reduce((sum, s) => sum + (uses[s.id] ?? 0), 0);
  const top = sigils.reduce((best, s) => ((uses[s.id] ?? 0) > (uses[best?.id] ?? -1) ? s : best), null);

  const head = document.createElement("h3");
  head.textContent = `Your language — ${sigils.length} sigil${sigils.length === 1 ? "" : "s"}, used ${totalReuse}×`;
  box.append(head);

  const list = document.createElement("ul");
  list.className = "lexicon-recap-list";
  for (const sigil of sigils) {
    const ident = identityFor(sigil.tokens);
    const li = document.createElement("li");
    li.style.setProperty("--sigil-hue", String(ident.hue));
    const badge = document.createElement("span");
    badge.className = "sigil-badge";
    badge.innerHTML = renderSigilGlyph(ident.glyphIndex);
    const name = document.createElement("span");
    name.className = "sigil-alias";
    name.textContent = sigil.alias;
    const meaning = document.createElement("span");
    meaning.className = "lexicon-recap-meaning";
    meaning.textContent = sigil.tokens.map((t) => ICONS[t.id]?.label ?? t.id).join(" · ");
    const count = document.createElement("span");
    count.className = "sigil-uses";
    count.textContent = `${uses[sigil.id] ?? 0}×`;
    li.append(badge, name, meaning, count);
    list.append(li);
  }
  box.append(list);

  if (top && (uses[top.id] ?? 0) > 0) {
    const fav = document.createElement("p");
    fav.className = "lexicon-recap-fav";
    fav.textContent = `Most used: ${top.alias} (${uses[top.id]}×) — ${top.tokens.map((t) => ICONS[t.id]?.label ?? t.id).join(" · ")}`;
    box.append(fav);
  }
  box.hidden = false;
}

$("rematch-keep").addEventListener("click", () => act("session:rematch", { keepLexicon: true }));
$("rematch-fresh").addEventListener("click", () => act("session:rematch", { keepLexicon: false }));

void TIER_LENGTHS;
