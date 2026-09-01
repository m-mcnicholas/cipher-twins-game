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
import { createInitialRevision } from "./core/revision.js";
import {
  deriveSalt, commitmentFor, guessIsCorrect, normalizeGuess,
  COMMITMENT_STATUS, COMMITMENT_MESSAGES,
} from "./core/commitments.js";
import { ICONS, ICON_GROUPS, renderIcon } from "./icons.js";
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
  if (state.host) state.host.dispatchLocal({ type, payload });
  else state.client?.send(type, payload);
}

function newClientId() {
  const rand = crypto.randomUUID?.().slice(0, 16)
    ?? [...crypto.getRandomValues(new Uint8Array(8))].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${state.role}-${rand}`;
}

// ---- host word selection ------------------------------------------------

function makeHostWordSource() {
  const used = new Set();
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

// Same-machine mode: `?local=<CODE>&as=host|join` pairs two tabs through a
// BroadcastChannel with no PeerJS broker (local playtests and e2e tests).
const params = new URLSearchParams(location.search);
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
}

function wireRoom() {
  const room = state.room;
  room.addEventListener("connected", ({ detail }) => onConnected(detail));
  room.addEventListener("peer-left", () => {
    $("connection-banner").hidden = false;
    $("connection-banner").textContent = "Your partner disconnected. Your progress is saved on this screen — reload to start a fresh room.";
    announce("Your partner disconnected.");
  });
  room.addEventListener("error", ({ detail }) => {
    console.error("Room error:", detail?.err);
  });
}

function onConnected({ role, code }) {
  state.role = role;
  $("role-indicator").textContent = `You are Player ${role}`;
  $("role-indicator").dataset.role = role;
  if (role === "A") {
    const { nextWord, pars } = makeHostWordSource();
    state.host = new GameHost(state.room, {
      initial: { roomCode: code },
      revision: createInitialRevision({ roomCode: code, ownershipSeed: crypto.getRandomValues(new Uint8Array(1))[0] }),
      nextWord, pars,
      newId: () => `m-${(crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)).slice(0, 20)}`,
    });
    state.host.addEventListener("revision", onRevision);
    state.host.dispatchLocal({ type: "level:advance", payload: { fromPhase: "lobby", fromIndex: null } });
  } else {
    state.client = new GameClient(state.room, { role: "B" });
    state.client.addEventListener("revision", onRevision);
    state.client.addEventListener("recommit-required", () => {
      announce("After reconnecting, please enter and commit your guess again.");
      render();
    });
    state.client.hello(`sess-${code}-${role}`);
  }
}

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
  state.myGuess = Array(r.wordLength).fill(null);
  state.composer = { tokens: [], replyTo: null };
}

// ---- top-level render ----------------------------------------------

const TUTORIAL_TEXT = [
  "Round one. Build a message by adding icons below, then send it as one card. "
  + "Try replying to your partner's card, and when you both think you know the word, "
  + "enter it privately and commit — you'll see whether your fingerprints matched.",
  "Round two. This time, when one of your cards turns out to be useful, use “Save as sigil”. "
  + "Your partner approves it and it becomes a numbered token you can both drop into any later message.",
];

function render() {
  const r = rev();
  if (!r) return;

  if (r.phase === "complete") { renderComplete(r); showScreen("complete"); return; }
  if (r.phase === "reveal") { renderReveal(r); showScreen("reveal"); return; }
  if (r.phase !== "puzzle" && r.phase !== "tutorial") { showScreen("connecting"); return; }

  renderTopbar(r);
  renderTutorialBanner(r);
  renderRoundFacts(r);
  renderWordTrack(r);
  renderConversation(r);
  renderArchive(r);
  renderComposer(r);
  renderPaletteDrawer(r);
  renderLexicon(r);
  renderAnswer(r);
  showScreen("game");

  const phaseKey = `${r.phase}:${r.phase === "tutorial" ? r.tutorialIndex : r.puzzleIndex}`;
  if (phaseKey !== state.lastPhaseKey) {
    state.lastPhaseKey = phaseKey;
    announce(r.phase === "tutorial" ? `Tutorial ${r.tutorialIndex + 1} of 2.` : `Puzzle ${r.puzzleIndex + 1} of 7.`);
  }
}

function renderTopbar(r) {
  const isTut = r.phase === "tutorial";
  $("round-label").textContent = isTut ? "Tutorial" : "Puzzle";
  $("round-number").textContent = isTut ? `${r.tutorialIndex + 1} / 2` : `${r.puzzleIndex + 1} / 7`;
  const total = Object.values(r.stars).reduce((a, b) => a + b, 0);
  $("stars-indicator").textContent = total ? `★ ${total}` : "";
}

function renderTutorialBanner(r) {
  const banner = $("tutorial-banner");
  if (r.phase !== "tutorial") { banner.hidden = true; return; }
  banner.hidden = false;
  $("tutorial-text").textContent = TUTORIAL_TEXT[r.tutorialIndex] ?? "";
  const mine = r.tutorialSkipVotes?.[state.role];
  const theirs = r.tutorialSkipVotes?.[partnerRole()];
  $("tutorial-skip-note").textContent = mine && !theirs ? "Waiting for your partner to also agree to skip…"
    : !mine && theirs ? "Your partner wants to skip the tutorials."
      : "";
}

$("tutorial-next").addEventListener("click", () => {
  const r = rev();
  act("level:advance", { fromPhase: "tutorial", fromIndex: r.tutorialIndex });
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
    chip.textContent = sigil?.alias ?? token.id;
    chip.setAttribute("aria-label", `${sigil?.alias ?? token.id}${sigil ? `, ${sigil.tokens.map((t) => ICONS[t.id]?.label ?? t.id).join(" then ")}` : ""}`);
    if (sigil) chip.title = sigil.tokens.map((t) => ICONS[t.id]?.label ?? t.id).join(" · ");
  }
  return chip;
}

function renderConversation(r) {
  if (!r) return;
  const list = $("conversation-list");
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

    item.setAttribute("aria-label", `Message ${message.seq + 1} from Player ${message.author}: `
      + message.tokens.map((t) => t.kind === "icon" ? (ICONS[t.id]?.label ?? t.id) : (r.sigils.confirmed.find((s) => s.id === t.id)?.alias ?? t.id)).join(", "));

    const actions = document.createElement("div");
    actions.className = "message-actions";
    const replyBtn = document.createElement("button");
    replyBtn.type = "button";
    replyBtn.className = "micro-button";
    replyBtn.textContent = "Reply";
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
  if (newest && newest.id !== state.lastAnnouncedMessageId) {
    state.lastAnnouncedMessageId = newest.id;
    if (newest.author !== state.role) announce(`Player ${newest.author} sent message ${newest.seq + 1}.`);
    list.scrollTop = list.scrollHeight;
  }
}

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
    replyChip.textContent = seq == null ? "Replying to a message" : `Replying to #${seq + 1}`;
    const clear = document.createElement("button");
    clear.type = "button"; clear.className = "micro-button"; clear.textContent = "✕";
    clear.addEventListener("click", () => { state.composer.replyTo = null; render(); });
    replyChip.append(" ", clear);
  } else {
    replyChip.hidden = true;
    replyChip.textContent = "";
  }
  updateSend();
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

for (const [id, drawer] of [["composer-palette-toggle", "palette-drawer"], ["composer-lexicon-toggle", "lexicon-drawer"]]) {
  $(id).addEventListener("click", () => {
    const el = $(drawer);
    el.hidden = !el.hidden;
    $(id).setAttribute("aria-expanded", String(!el.hidden));
  });
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
      button.className = "palette-icon";
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
    const label = document.createElement("span");
    label.className = "sigil-alias";
    label.textContent = sigil.alias;
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
  if (state.myGuess.length !== r.wordLength) state.myGuess = Array(r.wordLength).fill(null);
  const bar = $("answer-bar");
  bar.replaceChildren();
  state.myGuess.forEach((letter, index) => {
    const slot = document.createElement("span");
    slot.className = `answer-slot${letter ? " filled" : ""}`;
    slot.textContent = letter ?? "";
    slot.setAttribute("aria-label", `Guess position ${index + 1}${letter ? `, ${letter}` : ", empty"}`);
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
  if (/^[a-zA-Z]$/.test(event.key)) { fillLetter(event.key.toUpperCase()); }
  else if (event.key === "Backspace") { event.preventDefault(); backspaceGuess(); }
  else if (event.key === "Escape" && state.composer.replyTo != null) { state.composer.replyTo = null; render(); }
});

function backspaceGuess() {
  const r = rev();
  if (r.commitments?.[state.role] != null) return;
  const index = state.myGuess.findLastIndex(Boolean);
  if (index >= 0) state.myGuess[index] = null;
  renderAnswer(r);
}

$("answer-backspace").addEventListener("click", backspaceGuess);
$("answer-clear").addEventListener("click", () => {
  const r = rev();
  if (r.commitments?.[state.role] != null) return;
  state.myGuess = Array(r.wordLength).fill(null);
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

function renderReveal(r) {
  const outcome = r.lastOutcome ?? {};
  const solved = outcome.status === COMMITMENT_STATUS.SOLVED;
  $("reveal-stars").textContent = solved ? starString(r.stars[r.puzzleIndex] ?? 1) : "";
  if (solved) {
    $("reveal-kicker").textContent = "Solved";
    $("reveal-word").textContent = `Puzzle ${r.puzzleIndex + 1} down`;
    const stars = r.stars[r.puzzleIndex] ?? 1;
    $("reveal-detail").textContent = `${stars} star${stars === 1 ? "" : "s"} · ${outcome.attempt} attempt${outcome.attempt === 1 ? "" : "s"}.`;
    $("reveal-next").hidden = false;
    $("reveal-retry").hidden = true;
    announce(`Solved. ${stars} stars.`);
  } else {
    $("reveal-kicker").textContent = outcome.status === COMMITMENT_STATUS.AGREED_WRONG ? "Agreed — but not the answer" : "Not aligned yet";
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
  state.myGuess = Array(rev().wordLength).fill(null);
  act("level:retry", {});
});

function renderComplete(r) {
  const total = Object.values(r.stars).reduce((a, b) => a + b, 0);
  $("complete-stars").textContent = "★".repeat(Math.min(total, 21));
  $("complete-score").textContent = `${total} / 21 stars`;
  announce(`All puzzles complete. ${total} of 21 stars.`);
}

$("rematch-keep").addEventListener("click", () => act("session:rematch", { keepLexicon: true }));
$("rematch-fresh").addEventListener("click", () => act("session:rematch", { keepLexicon: false }));

void TIER_LENGTHS;
