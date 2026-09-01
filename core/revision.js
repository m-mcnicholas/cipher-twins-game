// The shared, host-authoritative game state and the pure reducer that advances
// it one validated operation at a time.
//
// A revision is a plain snapshot-able object with a monotonic `version`. The
// host owns the canonical revision; it validates each incoming operation
// (see messages.js), runs `reduce`, and rebroadcasts. Joiners apply the
// broadcast revisions and never mutate their own copy directly.
//
// Invariants the reducer guarantees:
//   - version only ever increases, and by exactly 1 per state-changing op
//   - messages are appended whole and in host-processing order, never interleaved
//   - only a message's author can retract it
//   - a sigil needs its proposer plus one confirmation from the *other* role
//   - the palette only ever grows
//   - an attempt is counted once, when both commitments have resolved
//   - no plaintext guess or private letter is ever stored (enforced by snapshot)

import {
  paletteForPuzzle, fullPalette, ownershipForPuzzle, isMonotonicUnlock,
  PUZZLE_COUNT, TUTORIAL_PALETTE,
} from "./palette.js";
import { scorePuzzle } from "./scoring.js";
import { resolveCommitments, COMMITMENT_STATUS } from "./commitments.js";
import { containsForbiddenKey } from "./messages.js";

export const PHASES = Object.freeze(["lobby", "tutorial", "puzzle", "reveal", "complete"]);
export const TUTORIAL_COUNT = 2;
const APPLIED_ID_CAP = 256;

const emptyPresence = () => ({ composing: false, guessReady: false, ts: 0 });
const other = (role) => (role === "A" ? "B" : "A");
const tokenSignature = (tokens) => tokens.map((t) => `${t.kind}:${t.id}`).join("|");

export function createInitialRevision({ roomCode = "LOCAL", ownershipSeed = 0 } = {}) {
  const seed = ownershipSeed & 1;
  return {
    version: 0,
    phase: "lobby",
    runNumber: 1,
    roomCode,
    ownershipSeed: seed,
    tutorialIndex: 0,
    tutorialSkipVotes: { A: false, B: false },
    puzzleIndex: -1,
    wordId: null,
    wordLength: 0,
    category: null,
    ownership: ownershipForPuzzle(seed, 0),
    unlockedPalette: [...TUTORIAL_PALETTE],
    sigilCounter: 0,
    messages: [],
    archivedTranscripts: [],
    sigils: { confirmed: [], pending: [] },
    attempts: {},
    stars: {},
    commitments: { A: null, B: null },
    lastOutcome: null,
    presence: { A: emptyPresence(), B: emptyPresence() },
    appliedClientIds: [],
  };
}

// Bridges a revision to the shape `validateOperation` expects.
export function operationContext(revision, localRole) {
  return {
    localRole,
    unlockedPalette: new Set(revision.unlockedPalette),
    confirmedSigilIds: new Set(revision.sigils.confirmed.map((s) => s.id)),
    currentMessageIds: new Set(revision.messages.map((m) => m.id)),
  };
}

let idCounter = 0;
function defaultNewId() {
  if (globalThis.crypto?.randomUUID) return `m-${crypto.randomUUID().slice(0, 24)}`;
  idCounter += 1;
  return `m-auto-${Date.now().toString(36)}-${idCounter}`;
}

const ok = (revision, effects = [], extra = {}) => ({ ok: true, revision, effects, ...extra });
const fail = (revision, error) => ({ ok: false, revision, error, effects: [] });

function bumped(revision) {
  revision.version += 1;
  return revision;
}

function recordClientId(revision, clientId) {
  revision.appliedClientIds.push(clientId);
  if (revision.appliedClientIds.length > APPLIED_ID_CAP) {
    revision.appliedClientIds.splice(0, revision.appliedClientIds.length - APPLIED_ID_CAP);
  }
}

// Enters a tutorial exercise or a scored puzzle. Both carry a real word so the
// pair can practise; only puzzles score. `context.nextWord` is called with
// `{ tutorial, index, runNumber }` and returns `{ wordId, wordLength, category }`.
function beginRound(next, { tutorial, index, context }) {
  const info = context.nextWord ? context.nextWord({ tutorial, index, runNumber: next.runNumber }) : null;
  next.phase = tutorial ? "tutorial" : "puzzle";
  if (tutorial) next.tutorialIndex = index;
  else next.puzzleIndex = index;
  next.wordId = info?.wordId ?? null;
  next.wordLength = Number.isInteger(info?.wordLength) ? info.wordLength : 0;
  next.category = info?.category ?? null;
  next.ownership = ownershipForPuzzle(next.ownershipSeed, index);

  const target = tutorial ? [...TUTORIAL_PALETTE] : paletteForPuzzle(index);
  if (isMonotonicUnlock(next.unlockedPalette, target)) {
    next.unlockedPalette = target;
  } else {
    // Never drop an unlocked icon (matters after a keep-lexicon rematch, whose
    // palette is already the full set): union rather than replace.
    const union = [...next.unlockedPalette];
    for (const id of target) if (!union.includes(id)) union.push(id);
    next.unlockedPalette = union;
  }

  next.messages = [];
  next.commitments = { A: null, B: null };
  next.lastOutcome = null;
  if (!tutorial) next.attempts[index] = next.attempts[index] ?? 0;
}

function archiveCurrentRound(next) {
  next.archivedTranscripts.push({
    scope: next.phase === "tutorial" ? "tutorial" : "puzzle",
    index: next.phase === "tutorial" ? next.tutorialIndex : next.puzzleIndex,
    wordId: next.wordId,
    messages: next.messages,
  });
}

/**
 * @param revision current canonical revision (not mutated)
 * @param op       an object already normalised by `validateOperation`
 * @param actor    "A" | "B" — the role that sent `op`
 * @param context  { newId, now, localGuessCorrect, pars, nextWord, ownershipSeed }
 * @returns { ok, revision, error?, effects, ephemeral? }
 */
export function reduce(revision, op, actor, context = {}) {
  if (actor !== "A" && actor !== "B") return fail(revision, "Unknown actor.");
  if (!op || typeof op.type !== "string") return fail(revision, "Malformed operation.");
  const now = Number.isFinite(context.now) ? context.now : Date.now();
  const newId = context.newId || defaultNewId;
  const p = op.payload || {};

  switch (op.type) {
    case "presence:update": {
      const next = structuredClone(revision);
      next.presence[actor] = { composing: p.composing === true, guessReady: p.guessReady === true, ts: now };
      return ok(next, [{ type: "presence", role: actor }], { ephemeral: true });
    }

    case "message:send": {
      if (revision.phase !== "tutorial" && revision.phase !== "puzzle") {
        return fail(revision, "Messages are only allowed during a tutorial or puzzle.");
      }
      if (revision.appliedClientIds.includes(p.clientId)) return ok(revision, [{ type: "duplicate" }]);
      const next = structuredClone(revision);
      const id = newId();
      next.messages.push({
        id, author: actor, tokens: p.tokens.map((t) => ({ ...t })),
        replyTo: p.replyTo ?? null, seq: next.messages.length, ts: now,
      });
      recordClientId(next, p.clientId);
      return ok(bumped(next), [{ type: "message", id, author: actor }]);
    }

    case "message:retract": {
      const index = revision.messages.findIndex((m) => m.id === p.messageId);
      if (index === -1) return fail(revision, "No such message in the current conversation.");
      if (revision.messages[index].author !== actor) return fail(revision, "Only the author may retract a message.");
      const next = structuredClone(revision);
      const [removed] = next.messages.splice(index, 1);
      for (const m of next.messages) if (m.replyTo === removed.id) m.replyTo = null;
      next.messages.forEach((m, i) => { m.seq = i; });
      return ok(bumped(next), [{ type: "retracted", id: removed.id }]);
    }

    case "sigil:propose": {
      if (revision.phase !== "tutorial" && revision.phase !== "puzzle") {
        return fail(revision, "Sigils can only be proposed during a tutorial or puzzle.");
      }
      if (revision.appliedClientIds.includes(p.clientId)) return ok(revision, [{ type: "duplicate" }]);
      const source = revision.messages.find((m) => m.id === p.sourceMessageId);
      if (!source) return fail(revision, "The proposed sigil's source message is not in the current conversation.");
      if (source.author !== actor) return fail(revision, "You can only turn your own message into a sigil.");
      if (source.tokens.length < 2) return fail(revision, "A sigil needs at least two tokens.");
      const signature = tokenSignature(source.tokens);
      if (revision.sigils.confirmed.some((s) => tokenSignature(s.tokens) === signature)) {
        return fail(revision, "That sequence is already a saved sigil.");
      }
      if (revision.sigils.pending.some((s) => tokenSignature(s.tokens) === signature)) {
        return fail(revision, "That sequence is already awaiting confirmation.");
      }
      const next = structuredClone(revision);
      next.sigilCounter += 1;
      const n = next.sigilCounter;
      next.sigils.pending.push({
        id: `sigil-${n}`, alias: `Sigil ${n}`,
        tokens: source.tokens.map((t) => ({ ...t })),
        sourceMessageId: source.id, proposedBy: actor,
      });
      recordClientId(next, p.clientId);
      return ok(bumped(next), [{ type: "sigilProposed", id: `sigil-${n}` }]);
    }

    case "sigil:confirm": {
      const index = revision.sigils.pending.findIndex((s) => s.id === p.sigilId);
      if (index === -1) return fail(revision, "No such pending sigil.");
      const pending = revision.sigils.pending[index];
      if (pending.proposedBy === actor) return fail(revision, "Your partner has to confirm a sigil you proposed.");
      const next = structuredClone(revision);
      next.sigils.pending.splice(index, 1);
      next.sigils.confirmed.push({
        id: pending.id, alias: pending.alias, tokens: pending.tokens,
        proposedBy: pending.proposedBy, confirmedBy: actor,
      });
      return ok(bumped(next), [{ type: "sigilConfirmed", id: pending.id }]);
    }

    case "sigil:reject": {
      const index = revision.sigils.pending.findIndex((s) => s.id === p.sigilId);
      if (index === -1) return fail(revision, "No such pending sigil.");
      const next = structuredClone(revision);
      next.sigils.pending.splice(index, 1);
      return ok(bumped(next), [{ type: "sigilRejected", id: p.sigilId }]);
    }

    case "guess:commit": {
      if (revision.phase !== "puzzle" && revision.phase !== "tutorial") {
        return fail(revision, "You can only commit a guess during a tutorial or puzzle.");
      }
      const next = structuredClone(revision);
      next.commitments[actor] = p.commitment;
      if (next.commitments[other(actor)] == null) {
        return ok(bumped(next), [{ type: "commitPending", role: actor }]);
      }
      const agree = next.commitments.A === next.commitments.B;
      const correct = agree ? Boolean(context.localGuessCorrect) : false;
      const outcome = resolveCommitments({ mine: next.commitments.A, theirs: next.commitments.B, correct });
      next.commitments = { A: null, B: null };

      if (next.phase === "tutorial") {
        // Unscored: show the outcome inline, stay in the exercise.
        next.lastOutcome = { status: outcome.status, tutorial: true, tutorialIndex: next.tutorialIndex, agree };
        return ok(bumped(next), [{ type: "resolved", status: outcome.status, tutorial: true }]);
      }

      const pi = next.puzzleIndex;
      next.attempts[pi] = (next.attempts[pi] ?? 0) + 1;
      next.lastOutcome = { status: outcome.status, puzzleIndex: pi, attempt: next.attempts[pi], agree };
      next.phase = "reveal";
      if (outcome.status === COMMITMENT_STATUS.SOLVED) {
        const pars = context.pars ?? { parTokens: Infinity, parMessages: Infinity };
        next.stars[pi] = scorePuzzle({
          attempts: next.attempts[pi], messages: next.messages,
          parTokens: pars.parTokens, parMessages: pars.parMessages,
        }).stars;
      }
      return ok(bumped(next), [{ type: "resolved", status: outcome.status }]);
    }

    case "guess:retractCommit": {
      if (revision.phase !== "puzzle" && revision.phase !== "tutorial") return fail(revision, "Nothing to retract.");
      if (revision.commitments[actor] == null) return ok(revision, [{ type: "noop" }]);
      if (revision.commitments[other(actor)] != null) {
        return fail(revision, "Both private guesses already arrived — wait for the result.");
      }
      const next = structuredClone(revision);
      next.commitments[actor] = null;
      return ok(bumped(next), [{ type: "commitRetracted", role: actor }]);
    }

    case "tutorial:skipVote": {
      if (revision.phase !== "tutorial") return fail(revision, "There is nothing to skip right now.");
      const next = structuredClone(revision);
      next.tutorialSkipVotes[actor] = p.vote;
      if (next.tutorialSkipVotes.A && next.tutorialSkipVotes.B) {
        if (next.messages.length) {
          next.archivedTranscripts.push({ scope: "tutorial", index: next.tutorialIndex, messages: next.messages });
        }
        next.tutorialIndex = TUTORIAL_COUNT;
        next.tutorialSkipVotes = { A: false, B: false };
        beginRound(next, { tutorial: false, index: 0, context });
        return ok(bumped(next), [{ type: "tutorialsSkipped" }]);
      }
      return ok(bumped(next), [{ type: "skipVote", role: actor, vote: p.vote }]);
    }

    case "level:advance": {
      const positionMatches =
        p.fromPhase === revision.phase &&
        (p.fromIndex == null ||
          (revision.phase === "tutorial" && p.fromIndex === revision.tutorialIndex) ||
          ((revision.phase === "reveal" || revision.phase === "puzzle") && p.fromIndex === revision.puzzleIndex) ||
          revision.phase === "lobby" || revision.phase === "complete");
      if (!positionMatches) return ok(revision, [{ type: "advanceIgnored" }]);

      const next = structuredClone(revision);
      if (revision.phase === "lobby") {
        beginRound(next, { tutorial: true, index: 0, context });
        return ok(bumped(next), [{ type: "phase", phase: "tutorial", tutorialIndex: 0 }]);
      }
      if (revision.phase === "tutorial") {
        if (next.messages.length) archiveCurrentRound(next);
        if (next.tutorialIndex + 1 < TUTORIAL_COUNT) {
          beginRound(next, { tutorial: true, index: next.tutorialIndex + 1, context });
          return ok(bumped(next), [{ type: "phase", phase: "tutorial", tutorialIndex: next.tutorialIndex }]);
        }
        next.tutorialIndex = TUTORIAL_COUNT;
        beginRound(next, { tutorial: false, index: 0, context });
        return ok(bumped(next), [{ type: "phase", phase: "puzzle", puzzleIndex: 0 }]);
      }
      if (revision.phase === "reveal") {
        const solved = next.lastOutcome
          && next.lastOutcome.status === COMMITMENT_STATUS.SOLVED
          && next.lastOutcome.puzzleIndex === next.puzzleIndex;
        if (!solved) return fail(revision, "This puzzle is not solved yet.");
        archiveCurrentRound(next);
        const nextIndex = next.puzzleIndex + 1;
        next.lastOutcome = null;
        if (nextIndex >= PUZZLE_COUNT) {
          next.phase = "complete";
          next.messages = [];
          return ok(bumped(next), [{ type: "phase", phase: "complete" }]);
        }
        beginRound(next, { tutorial: false, index: nextIndex, context });
        return ok(bumped(next), [{ type: "phase", phase: "puzzle", puzzleIndex: nextIndex }]);
      }
      return fail(revision, "Cannot advance from here.");
    }

    case "level:retry": {
      if (revision.phase !== "reveal") return fail(revision, "There is nothing to retry.");
      if (revision.lastOutcome && revision.lastOutcome.status === COMMITMENT_STATUS.SOLVED) {
        return fail(revision, "This puzzle is already solved.");
      }
      const next = structuredClone(revision);
      next.phase = "puzzle";
      next.commitments = { A: null, B: null };
      next.lastOutcome = null;
      return ok(bumped(next), [{ type: "phase", phase: "puzzle", puzzleIndex: next.puzzleIndex }]);
    }

    case "session:rematch": {
      if (revision.phase !== "complete") return fail(revision, "Rematch is only available after the final puzzle.");
      const next = structuredClone(revision);
      next.ownershipSeed = Number.isInteger(context.ownershipSeed) ? (context.ownershipSeed & 1) : (revision.ownershipSeed ^ 1);
      next.runNumber += 1;
      next.tutorialIndex = TUTORIAL_COUNT;
      next.tutorialSkipVotes = { A: false, B: false };
      next.attempts = {};
      next.stars = {};
      next.commitments = { A: null, B: null };
      next.lastOutcome = null;
      if (p.keepLexicon) {
        next.sigils.pending = [];
      } else {
        next.sigils = { confirmed: [], pending: [] };
        next.sigilCounter = 0;
        next.archivedTranscripts = [];
      }
      beginRound(next, { tutorial: false, index: 0, context });
      if (p.keepLexicon) next.unlockedPalette = fullPalette();
      return ok(bumped(next), [{ type: "rematch", keepLexicon: p.keepLexicon }]);
    }

    default:
      return fail(revision, `Unhandled operation: ${op.type}`);
  }
}

// ---- snapshots & recovery -------------------------------------------------

// A revision safe to persist or send over the wire: ephemeral presence removed,
// and a hard assertion that nothing secret slipped in.
export function snapshot(revision) {
  const clone = structuredClone(revision);
  delete clone.presence;
  if (containsForbiddenKey(clone)) {
    throw new Error("Refusing to snapshot: shared state contains a forbidden field.");
  }
  return clone;
}

// Rehydrate a joiner or a replacing host from a snapshot.
export function fromSnapshot(snap) {
  return { ...structuredClone(snap), presence: { A: emptyPresence(), B: emptyPresence() } };
}

// After a disconnect/rejoin, unresolved commitments are dropped and both players
// are asked to recommit, so a half-finished attempt can't silently resolve
// against a stale digest.
export function prepareRecovery(revision) {
  const next = structuredClone(revision);
  const hadPending = next.commitments.A != null || next.commitments.B != null;
  next.commitments = { A: null, B: null };
  next.presence = { A: emptyPresence(), B: emptyPresence() };
  next.version += 1;
  return { revision: next, recommitRequired: hadPending && next.phase === "puzzle" };
}

// Host's answer to a `sync:request`. Phase 1 always replies with a full
// sanitized snapshot when the caller is behind; deltas are a later optimisation.
export function syncResponse(revision, haveVersion) {
  if (Number.isInteger(haveVersion) && haveVersion >= revision.version) {
    return { mode: "up-to-date", version: revision.version };
  }
  return { mode: "full", revision: snapshot(revision) };
}
