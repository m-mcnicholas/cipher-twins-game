// A short scripted solo demo, reached from the lobby with `?demo=1`.
//
// It wires a GameHost and a GameClient together through an in-process
// LoopbackChannel and drives BOTH sides on a timeline, so a lone visitor can
// watch the whole loop — composing, sending, replying, saving a sigil, and
// committing a private guess — without a partner. The scored game stays strictly
// two-player: nothing here touches the PeerJS path or the recovery store.

import { createLoopbackPair } from "./transport.js";
import { GameHost, GameClient } from "./session.js";
import { createInitialRevision } from "./revision.js";
import { deriveSalt, commitmentFor, guessIsCorrect } from "./commitments.js";
import { ACTIVE_WORDS } from "../words/bank.js";

const DEMO_WORD = ACTIVE_WORDS.find((w) => w.tutorial && w.slot === 0); // FISH
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function startBotDemo({ state, render, announce, showScreen }) {
  const { channel } = createLoopbackPair({ code: "DEMO", mode: "manual" });
  const flush = () => channel.flush();

  const host = new GameHost(channel.host, {
    revision: createInitialRevision({ roomCode: "DEMO", ownershipSeed: 0 }),
    nextWord: ({ tutorial, index }) => (tutorial && index === 0
      ? { wordId: DEMO_WORD.id, wordLength: DEMO_WORD.length, category: DEMO_WORD.category }
      : { wordId: DEMO_WORD.id, wordLength: DEMO_WORD.length, category: DEMO_WORD.category }),
    pars: () => ({ parTokens: Infinity, parMessages: Infinity }),
    newId: () => `m-demo-${Math.random().toString(36).slice(2, 10)}`,
  });
  const client = new GameClient(channel.joiner, { role: "B" });

  state.role = "B";
  state.host = host;
  state.client = client;
  state.demo = true;
  client.addEventListener("revision", () => render());
  host.addEventListener("revision", () => render());

  const caption = buildCaptionBar(showScreen);
  const say = (text) => { caption.textContent = text; announce(text); };

  const lastHostMessageId = () => host.revision.messages.filter((m) => m.author === "A").at(-1)?.id;

  const steps = [
    async () => {
      host.dispatchLocal({ type: "level:advance", payload: { fromPhase: "lobby", fromIndex: null } });
      flush(); render();
      say(`Demo: two players each hold half of the word ${DEMO_WORD.id === "w001" ? "FISH" : "the answer"}. No talking — only icons.`);
    },
    async () => {
      host.dispatchLocal({ type: "message:send", payload: { clientId: "A-d1", tokens: [{ kind: "icon", id: "shape:line" }, { kind: "icon", id: "count:1" }], replyTo: null } });
      flush(); render();
      say("Player A builds a card from icons and sends the whole thing at once.");
    },
    async () => {
      client.send("message:send", { clientId: "B-d1", tokens: [{ kind: "icon", id: "meta:confirm" }], replyTo: lastHostMessageId() });
      flush(); render();
      say("Player B replies directly on that card.");
    },
    async () => {
      host.dispatchLocal({ type: "message:send", payload: { clientId: "A-d2", tokens: [{ kind: "icon", id: "shape:loop" }, { kind: "icon", id: "count:1" }], replyTo: null } });
      flush(); render();
      say("Another card. This sequence keeps coming up…");
    },
    async () => {
      host.dispatchLocal({ type: "sigil:propose", payload: { clientId: "A-d3", sourceMessageId: lastHostMessageId() } });
      flush(); render();
      say("…so Player A proposes saving it as a sigil.");
    },
    async () => {
      client.send("sigil:confirm", { sigilId: "sigil-1" });
      flush(); render();
      say("Player B approves it. It's now “Sigil 1” — one reusable token for the rest of the session.");
    },
    async () => {
      client.send("message:send", { clientId: "B-d2", tokens: [{ kind: "sigil", id: "sigil-1" }], replyTo: null });
      flush(); render();
      say("Player B drops Sigil 1 straight into a new message.");
    },
    async () => {
      const salt = deriveSalt({ roomCode: "DEMO", runNumber: 1, puzzleIndex: "t0", wordId: DEMO_WORD.id });
      const commitment = await commitmentFor("FISH", salt);
      host.localGuessCorrect = await guessIsCorrect("FISH", DEMO_WORD.answerHash);
      host.dispatchLocal({ type: "guess:commit", payload: { commitment } });
      client.send("guess:commit", { commitment });
      flush(); render();
      say("Both players commit a private guess. Only a fingerprint is sent — never the letters.");
    },
    async () => {
      say("The fingerprints matched and the word was right. That's the whole loop — the real game is two players.");
      caption.appendChild(backToLobbyButton());
    },
  ];

  showScreen("game");
  for (const step of steps) {
    await step();
    await wait(2600);
  }
}

function buildCaptionBar(showScreen) {
  let bar = document.getElementById("demo-caption");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "demo-caption";
    bar.className = "demo-caption";
    bar.setAttribute("role", "status");
    bar.setAttribute("aria-live", "polite");
    document.getElementById("screen-game").prepend(bar);
  }
  void showScreen;
  return bar;
}

function backToLobbyButton() {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "primary-button";
  button.style.marginLeft = "12px";
  button.textContent = "Back to lobby";
  button.addEventListener("click", () => { location.href = location.pathname; });
  return button;
}
