import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { sha256Hex, sha256HexFallback } from "../core/sha256.js";
import {
  normalizeGuess, deriveSalt, commitmentFor, resolveCommitments, COMMITMENT_STATUS,
} from "../core/commitments.js";
import {
  TUTORIAL_PALETTE, PUZZLE_PALETTE_UNLOCKS, PUZZLE_COUNT,
  paletteForPuzzle, fullPalette, isMonotonicUnlock, assertMonotonicSchedule,
  ownershipForPuzzle, positionsForParity,
} from "../core/palette.js";
import { computeStars, scorePuzzle, countTokens } from "../core/scoring.js";
import {
  validateOperation, validateBroadcast, containsForbiddenKey,
} from "../core/messages.js";
import {
  createInitialRevision, operationContext, reduce, snapshot, prepareRecovery,
  syncResponse, applyDelta, DELTA_SAFE_OPS,
} from "../core/revision.js";
import { createLoopbackPair } from "../core/transport.js";
import { GameHost, GameClient } from "../core/session.js";

const HEX_A = "a".repeat(64);
const HEX_B = "b".repeat(64);

// A deterministic word source: lengths follow the 4,4,5,5,6,7,8 curve.
const LENGTHS = [4, 4, 5, 5, 6, 7, 8];
const stubWord = ({ tutorial, index = 0, runNumber = 1 }) => ({
  wordId: tutorial ? `tut-${index}` : `w-p${index}-r${runNumber}`,
  wordLength: tutorial ? 4 : LENGTHS[index],
  category: tutorial ? "animal" : ["animal", "object", "nature", "food"][index % 4],
});
const ctx = (over = {}) => ({ newId: makeIdFactory(), nextWord: stubWord, now: 1_000, ...over });

function makeIdFactory() {
  let n = 0;
  return () => `m-fixture-${++n}`;
}

function opCtx(revision) {
  return operationContext(revision, "A");
}

// Drive a revision from lobby to the start of puzzle `index` with the reducer.
function advanceToPuzzle(index, over = {}) {
  let rev = createInitialRevision({ roomCode: "ROOMAAA", ownershipSeed: 0 });
  const c = ctx(over);
  rev = reduce(rev, { type: "level:advance", payload: { fromPhase: "lobby", fromIndex: null } }, "A", c).revision;
  rev = reduce(rev, { type: "level:advance", payload: { fromPhase: "tutorial", fromIndex: 0 } }, "A", c).revision;
  rev = reduce(rev, { type: "level:advance", payload: { fromPhase: "tutorial", fromIndex: 1 } }, "A", c).revision;
  for (let i = 0; i < index; i += 1) {
    // force a solve so advance is permitted
    rev.phase = "reveal";
    rev.lastOutcome = { status: COMMITMENT_STATUS.SOLVED, puzzleIndex: i, attempt: 1, agree: true };
    rev = reduce(rev, { type: "level:advance", payload: { fromPhase: "reveal", fromIndex: i } }, "A", c).revision;
  }
  return { rev, c };
}

// ---------------------------------------------------------------- sha256

test("portable sha256 fallback matches the platform digest", async () => {
  for (const sample of ["", "A", "CIPHER TWINS", "the quick brown fox".repeat(9)]) {
    const expected = createHash("sha256").update(sample).digest("hex");
    assert.equal(await sha256Hex(sample), expected);
    assert.equal(sha256HexFallback(new TextEncoder().encode(sample)), expected);
  }
});

// --------------------------------------------------------- commitments

test("guess normalisation strips everything but A-Z", () => {
  assert.equal(normalizeGuess(" b o a t 1 "), "BOAT");
  assert.equal(normalizeGuess("Ölör"), "LR");
});

test("commitments are deterministic per salt and hide the plaintext everywhere it is compared", async () => {
  const salt = deriveSalt({ roomCode: "ROOMAAA", runNumber: 1, puzzleIndex: 0, wordId: "w-p0-r1" });
  const a = await commitmentFor("boat", salt);
  const b = await commitmentFor("BOAT", salt);
  const different = await commitmentFor("boat", deriveSalt({ roomCode: "ROOMAAA", runNumber: 1, puzzleIndex: 1, wordId: "w-p0-r1" }));
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.equal(a, b, "same normalised guess + salt -> same digest");
  assert.notEqual(a, different, "salt changes the digest");
  assert.ok(!a.includes("BOAT") && !a.toLowerCase().includes("boat"));
});

test("commitment resolution reports agreement without revealing the guess", () => {
  assert.equal(resolveCommitments({ mine: null, theirs: HEX_B, correct: false }).status, COMMITMENT_STATUS.PENDING);
  assert.equal(resolveCommitments({ mine: HEX_A, theirs: HEX_A, correct: true }).status, COMMITMENT_STATUS.SOLVED);
  assert.equal(resolveCommitments({ mine: HEX_A, theirs: HEX_A, correct: false }).status, COMMITMENT_STATUS.AGREED_WRONG);
  const differ = resolveCommitments({ mine: HEX_A, theirs: HEX_B, correct: true });
  assert.equal(differ.status, COMMITMENT_STATUS.DIFFER);
  assert.equal(differ.agree, false);
  // The differ message must not hint at position or letters.
  assert.doesNotMatch(differ.message, /position|letter|index/i);
});

// -------------------------------------------------------------- palette

test("the palette only ever grows across the session", () => {
  const stages = [TUTORIAL_PALETTE, ...Array.from({ length: PUZZLE_COUNT }, (_, i) => paletteForPuzzle(i))];
  assert.equal(assertMonotonicSchedule(stages), true);
  for (let i = 1; i < stages.length; i += 1) {
    assert.ok(isMonotonicUnlock(stages[i - 1], stages[i]));
    assert.ok(stages[i].length > stages[i - 1].length, `step ${i} adds icons`);
  }
  assert.deepEqual(new Set(fullPalette()), new Set(paletteForPuzzle(PUZZLE_COUNT - 1)));
  // Every unlock icon is actually a namespaced icon id.
  for (const step of PUZZLE_PALETTE_UNLOCKS) for (const id of step) assert.match(id, /^[a-z]+:[a-z0-9]+$/);
});

test("isMonotonicUnlock rejects a palette that drops an unlocked icon", () => {
  assert.equal(isMonotonicUnlock(["shape:line", "count:1"], ["shape:line"]), false);
  assert.throws(() => assertMonotonicSchedule([["shape:line", "count:1"], ["shape:line"]]), /dropped unlocked icons/);
});

test("letter ownership alternates parity every puzzle from the random seed", () => {
  for (const seed of [0, 1]) {
    let prev = ownershipForPuzzle(seed, 0);
    for (let i = 1; i < 7; i += 1) {
      const now = ownershipForPuzzle(seed, i);
      assert.notEqual(now.A, prev.A, `puzzle ${i} flips A's parity`);
      assert.notEqual(now.A, now.B, "the two roles always hold opposite parity");
      prev = now;
    }
  }
  assert.notEqual(ownershipForPuzzle(0, 0).A, ownershipForPuzzle(1, 0).A, "the seed decides the initial owner");
  assert.deepEqual(positionsForParity("odd", 7), [1, 3, 5, 7]);
  assert.deepEqual(positionsForParity("even", 6), [2, 4, 6]);
});

// -------------------------------------------------------------- scoring

test("efficiency stars follow the par thresholds", () => {
  const pars = { parTokens: 10, parMessages: 4 };
  assert.equal(computeStars({ attempts: 1, tokens: 10, messages: 4, ...pars }).stars, 3);
  assert.equal(computeStars({ attempts: 1, tokens: 11, messages: 4, ...pars }).stars, 2);
  assert.equal(computeStars({ attempts: 2, tokens: 15, messages: 6, ...pars }).stars, 2);
  assert.equal(computeStars({ attempts: 3, tokens: 10, messages: 4, ...pars }).stars, 1);
  assert.equal(computeStars({ attempts: 1, tokens: 16, messages: 4, ...pars }).stars, 1);
});

test("a sigil token counts once regardless of how many icons it expands to", () => {
  const messages = [
    { tokens: [{ kind: "icon", id: "shape:line" }, { kind: "sigil", id: "sigil-1" }] },
    { tokens: [{ kind: "sigil", id: "sigil-1" }] },
  ];
  assert.equal(countTokens(messages), 3);
  assert.equal(scorePuzzle({ attempts: 1, messages, parTokens: 3, parMessages: 2 }).stars, 3);
});

// ------------------------------------------------------ protocol schemas

test("message:send is normalised, palette-scoped, and reply-checked", () => {
  const revision = createInitialRevision();
  revision.messages.push({ id: "m-existing", author: "A", tokens: [], replyTo: null, seq: 0 });
  const context = operationContext(revision, "B");

  const good = {
    type: "message:send",
    payload: { clientId: "B-abc_1", tokens: [{ kind: "icon", id: "shape:line" }], replyTo: "m-existing", extra: "drop me" },
  };
  assert.deepEqual(validateOperation(good, context), {
    type: "message:send",
    payload: { clientId: "B-abc_1", tokens: [{ kind: "icon", id: "shape:line" }], replyTo: "m-existing" },
  });

  const locked = { ...good, payload: { ...good.payload, tokens: [{ kind: "icon", id: "cmp:bigger" }] } };
  assert.equal(validateOperation(locked, context), null, "an unlocked-only icon is rejected");
  assert.equal(validateOperation({ ...good, payload: { ...good.payload, tokens: [{ kind: "sigil", id: "sigil-9" }] } }, context), null);
  assert.equal(validateOperation({ ...good, payload: { ...good.payload, replyTo: "m-missing" } }, context), null);
  assert.equal(validateOperation({ ...good, payload: { ...good.payload, clientId: 'B-"onerror' } }, context), null);
  assert.equal(validateOperation({ ...good, payload: { ...good.payload, tokens: [] } }, context), null);
});

test("guess:commit only accepts a 64-char hex digest", () => {
  const context = operationContext(createInitialRevision(), "A");
  assert.deepEqual(
    validateOperation({ type: "guess:commit", payload: { commitment: HEX_A } }, context),
    { type: "guess:commit", payload: { commitment: HEX_A } },
  );
  assert.equal(validateOperation({ type: "guess:commit", payload: { commitment: "BOAT" } }, context), null);
  assert.equal(validateOperation({ type: "guess:commit", payload: { commitment: HEX_A.toUpperCase() } }, context), null);
});

test("broadcast validation refuses a snapshot carrying a forbidden field", () => {
  assert.equal(validateBroadcast({ type: "revision:full", payload: { revision: { version: 1, guess: "BOAT" } } }), null);
  assert.equal(validateBroadcast({ type: "revision:full", payload: { revision: { version: 1, commitments: { A: "nope", B: null } } } }), null);
  assert.ok(validateBroadcast({ type: "revision:full", payload: { revision: { version: 1, commitments: { A: HEX_A, B: null } } } }));
  assert.equal(containsForbiddenKey({ nested: { deep: { letters: ["B"] } } }), true);
  assert.equal(containsForbiddenKey({ nested: { deep: { answerHash: "ok" } } }), false);
});

// -------------------------------------------------------------- reducer

test("messages are appended whole, in order, one version bump each", () => {
  let rev = advanceToPuzzle(0).rev;
  const base = rev.version;
  rev = reduce(rev, { type: "message:send", payload: { clientId: "A-1", tokens: [{ kind: "icon", id: "shape:line" }], replyTo: null } }, "A", ctx()).revision;
  rev = reduce(rev, { type: "message:send", payload: { clientId: "B-1", tokens: [{ kind: "icon", id: "count:2" }, { kind: "icon", id: "pos:first" }], replyTo: null } }, "B", ctx()).revision;
  assert.equal(rev.version, base + 2);
  assert.deepEqual(rev.messages.map((m) => [m.author, m.tokens.length, m.seq]), [["A", 1, 0], ["B", 2, 1]]);

  const dup = reduce(rev, { type: "message:send", payload: { clientId: "A-1", tokens: [{ kind: "icon", id: "shape:dot" }], replyTo: null } }, "A", ctx());
  assert.equal(dup.revision.version, rev.version, "a repeated clientId is a no-op");
  assert.equal(dup.revision.messages.length, 2);
});

test("only the author can retract, and dangling replies are cleared", () => {
  let rev = advanceToPuzzle(0).rev;
  const c = ctx();
  rev = reduce(rev, { type: "message:send", payload: { clientId: "A-1", tokens: [{ kind: "icon", id: "shape:line" }], replyTo: null } }, "A", c).revision;
  const firstId = rev.messages[0].id;
  rev = reduce(rev, { type: "message:send", payload: { clientId: "B-1", tokens: [{ kind: "icon", id: "count:1" }], replyTo: firstId } }, "B", c).revision;

  assert.equal(reduce(rev, { type: "message:retract", payload: { messageId: firstId } }, "B", c).ok, false);
  const after = reduce(rev, { type: "message:retract", payload: { messageId: firstId } }, "A", c).revision;
  assert.equal(after.messages.length, 1);
  assert.equal(after.messages[0].replyTo, null, "the reply no longer points at a removed message");
  assert.equal(after.messages[0].seq, 0);
});

test("a sigil needs the proposer's own message plus the partner's confirmation", () => {
  let rev = advanceToPuzzle(0).rev;
  const c = ctx();
  rev = reduce(rev, { type: "message:send", payload: { clientId: "A-1", tokens: [{ kind: "icon", id: "shape:loop" }, { kind: "icon", id: "count:2" }], replyTo: null } }, "A", c).revision;
  const msgId = rev.messages[0].id;

  assert.equal(reduce(rev, { type: "sigil:propose", payload: { clientId: "B-1", sourceMessageId: msgId } }, "B", c).ok, false, "cannot propose a partner's message");
  rev = reduce(rev, { type: "sigil:propose", payload: { clientId: "A-2", sourceMessageId: msgId } }, "A", c).revision;
  assert.equal(rev.sigils.pending.length, 1);
  assert.equal(rev.sigils.pending[0].alias, "Sigil 1");

  assert.equal(reduce(rev, { type: "sigil:confirm", payload: { sigilId: "sigil-1" } }, "A", c).ok, false, "the proposer cannot self-confirm");
  rev = reduce(rev, { type: "sigil:confirm", payload: { sigilId: "sigil-1" } }, "B", c).revision;
  assert.equal(rev.sigils.confirmed.length, 1);
  assert.equal(rev.sigils.confirmed[0].confirmedBy, "B");
  assert.equal(rev.sigils.pending.length, 0);

  // The confirmed sigil is now a legal token.
  const sendWithSigil = validateOperation(
    { type: "message:send", payload: { clientId: "A-3", tokens: [{ kind: "sigil", id: "sigil-1" }], replyTo: null } },
    operationContext(rev, "A"),
  );
  assert.ok(sendWithSigil);
});

test("rejected sigil numbers are burned, never reused", () => {
  let rev = advanceToPuzzle(0).rev;
  const c = ctx();
  rev = reduce(rev, { type: "message:send", payload: { clientId: "A-1", tokens: [{ kind: "icon", id: "shape:loop" }, { kind: "icon", id: "count:2" }], replyTo: null } }, "A", c).revision;
  rev = reduce(rev, { type: "sigil:propose", payload: { clientId: "A-2", sourceMessageId: rev.messages[0].id } }, "A", c).revision;
  rev = reduce(rev, { type: "sigil:reject", payload: { sigilId: "sigil-1" } }, "B", c).revision;
  assert.equal(rev.sigils.pending.length, 0);

  rev = reduce(rev, { type: "message:send", payload: { clientId: "A-3", tokens: [{ kind: "icon", id: "shape:line" }, { kind: "icon", id: "pos:last" }], replyTo: null } }, "A", c).revision;
  rev = reduce(rev, { type: "sigil:propose", payload: { clientId: "A-4", sourceMessageId: rev.messages[1].id } }, "A", c).revision;
  assert.equal(rev.sigils.pending[0].alias, "Sigil 2", "the next alias skips the rejected number");
});

test("an attempt counts once, when both commitments have resolved", () => {
  const { rev: start, c } = advanceToPuzzle(0);
  let rev = start;
  const pi = rev.puzzleIndex;

  const firstCommit = reduce(rev, { type: "guess:commit", payload: { commitment: HEX_A } }, "A", c);
  rev = firstCommit.revision;
  assert.equal(rev.attempts[pi] ?? 0, 0, "one commitment alone does not count as an attempt");
  assert.equal(rev.phase, "puzzle");

  // retract is allowed while the partner has not committed
  rev = reduce(rev, { type: "guess:retractCommit", payload: {} }, "A", c).revision;
  assert.equal(rev.commitments.A, null);

  rev = reduce(rev, { type: "guess:commit", payload: { commitment: HEX_A } }, "A", c).revision;
  rev = reduce(rev, { type: "guess:commit", payload: { commitment: HEX_A } }, "B", { ...c, localGuessCorrect: true, pars: { parTokens: 20, parMessages: 8 } }).revision;
  assert.equal(rev.attempts[pi], 1);
  assert.equal(rev.phase, "reveal");
  assert.equal(rev.lastOutcome.status, COMMITMENT_STATUS.SOLVED);
  assert.equal(rev.stars[pi], 3);
  assert.deepEqual(rev.commitments, { A: null, B: null }, "commitments are cleared after resolving");
});

test("agreeing on the wrong word and disagreeing are distinct, letterless outcomes", () => {
  for (const [correct, expected] of [[false, COMMITMENT_STATUS.AGREED_WRONG]]) {
    const { rev: start, c } = advanceToPuzzle(0);
    let rev = reduce(start, { type: "guess:commit", payload: { commitment: HEX_A } }, "A", c).revision;
    rev = reduce(rev, { type: "guess:commit", payload: { commitment: HEX_A } }, "B", { ...c, localGuessCorrect: correct }).revision;
    assert.equal(rev.lastOutcome.status, expected);
    assert.equal(rev.stars[rev.puzzleIndex], undefined, "no stars without a solve");
  }
  const { rev: start, c } = advanceToPuzzle(0);
  let rev = reduce(start, { type: "guess:commit", payload: { commitment: HEX_A } }, "A", c).revision;
  rev = reduce(rev, { type: "guess:commit", payload: { commitment: HEX_B } }, "B", { ...c, localGuessCorrect: true }).revision;
  assert.equal(rev.lastOutcome.status, COMMITMENT_STATUS.DIFFER);
  assert.equal(rev.lastOutcome.agree, false);
});

test("retry is only possible from an unsolved reveal and keeps the conversation", () => {
  const { rev: start, c } = advanceToPuzzle(0);
  let rev = reduce(start, { type: "message:send", payload: { clientId: "A-1", tokens: [{ kind: "icon", id: "shape:line" }], replyTo: null } }, "A", c).revision;
  rev = reduce(rev, { type: "guess:commit", payload: { commitment: HEX_A } }, "A", c).revision;
  rev = reduce(rev, { type: "guess:commit", payload: { commitment: HEX_B } }, "B", { ...c, localGuessCorrect: false }).revision;
  assert.equal(rev.phase, "reveal");
  const retried = reduce(rev, { type: "level:retry", payload: {} }, "B", c);
  assert.equal(retried.ok, true);
  assert.equal(retried.revision.phase, "puzzle");
  assert.equal(retried.revision.messages.length, 1, "the conversation survives a retry");
  assert.deepEqual(retried.revision.commitments, { A: null, B: null });
});

test("advance is idempotent and only leaves a reveal once the puzzle is solved", () => {
  let rev = createInitialRevision();
  const c = ctx();
  rev = reduce(rev, { type: "level:advance", payload: { fromPhase: "lobby", fromIndex: null } }, "A", c).revision;
  assert.equal(rev.phase, "tutorial");
  // a stale advance (wrong fromPhase) changes nothing
  const stale = reduce(rev, { type: "level:advance", payload: { fromPhase: "lobby", fromIndex: null } }, "B", c);
  assert.equal(stale.revision.version, rev.version);

  rev = reduce(rev, { type: "level:advance", payload: { fromPhase: "tutorial", fromIndex: 0 } }, "A", c).revision;
  rev = reduce(rev, { type: "level:advance", payload: { fromPhase: "tutorial", fromIndex: 1 } }, "A", c).revision;
  assert.equal(rev.phase, "puzzle");
  assert.equal(rev.puzzleIndex, 0);

  rev.phase = "reveal";
  rev.lastOutcome = { status: COMMITMENT_STATUS.DIFFER, puzzleIndex: 0, attempt: 1, agree: false };
  assert.equal(reduce(rev, { type: "level:advance", payload: { fromPhase: "reveal", fromIndex: 0 } }, "A", c).ok, false);
});

test("every puzzle transition keeps the palette monotonic and flips ownership", () => {
  let { rev, c } = advanceToPuzzle(0);
  let prevPalette = rev.unlockedPalette;
  let prevOwner = rev.ownership.A;
  for (let i = 1; i < PUZZLE_COUNT; i += 1) {
    rev.phase = "reveal";
    rev.lastOutcome = { status: COMMITMENT_STATUS.SOLVED, puzzleIndex: i - 1, attempt: 1, agree: true };
    rev = reduce(rev, { type: "level:advance", payload: { fromPhase: "reveal", fromIndex: i - 1 } }, "A", c).revision;
    assert.equal(rev.puzzleIndex, i);
    assert.ok(isMonotonicUnlock(prevPalette, rev.unlockedPalette), `puzzle ${i} palette is a superset`);
    assert.notEqual(rev.ownership.A, prevOwner, `puzzle ${i} flips ownership`);
    prevPalette = rev.unlockedPalette;
    prevOwner = rev.ownership.A;
  }
  // Past the last puzzle -> complete.
  rev.phase = "reveal";
  rev.lastOutcome = { status: COMMITMENT_STATUS.SOLVED, puzzleIndex: PUZZLE_COUNT - 1, attempt: 1, agree: true };
  rev = reduce(rev, { type: "level:advance", payload: { fromPhase: "reveal", fromIndex: PUZZLE_COUNT - 1 } }, "A", c).revision;
  assert.equal(rev.phase, "complete");
});

test("a tutorial guess resolves inline without scoring or leaving the exercise", () => {
  let rev = createInitialRevision();
  const c = ctx();
  rev = reduce(rev, { type: "level:advance", payload: { fromPhase: "lobby", fromIndex: null } }, "A", c).revision;
  assert.equal(rev.phase, "tutorial");
  assert.equal(rev.wordId, "tut-0", "the tutorial carries a real word to practise on");

  rev = reduce(rev, { type: "guess:commit", payload: { commitment: HEX_A } }, "A", c).revision;
  rev = reduce(rev, { type: "guess:commit", payload: { commitment: HEX_A } }, "B", { ...c, localGuessCorrect: true }).revision;
  assert.equal(rev.phase, "tutorial", "a tutorial does not advance to a reveal");
  assert.equal(rev.lastOutcome.status, COMMITMENT_STATUS.SOLVED);
  assert.equal(rev.lastOutcome.tutorial, true);
  assert.deepEqual(rev.attempts, {}, "tutorial guesses are never counted as attempts");
  assert.deepEqual(rev.stars, {});
});

test("a unanimous skip vote jumps straight to the first puzzle", () => {
  let rev = createInitialRevision();
  const c = ctx();
  rev = reduce(rev, { type: "level:advance", payload: { fromPhase: "lobby", fromIndex: null } }, "A", c).revision;
  rev = reduce(rev, { type: "tutorial:skipVote", payload: { vote: true } }, "A", c).revision;
  assert.equal(rev.phase, "tutorial", "one vote is not enough");
  rev = reduce(rev, { type: "tutorial:skipVote", payload: { vote: true } }, "B", c).revision;
  assert.equal(rev.phase, "puzzle");
  assert.equal(rev.puzzleIndex, 0);
});

test("keep-lexicon rematch retains sigils, archives, and opens the full palette", () => {
  let { rev, c } = advanceToPuzzle(0);
  rev = reduce(rev, { type: "message:send", payload: { clientId: "A-1", tokens: [{ kind: "icon", id: "shape:loop" }, { kind: "icon", id: "count:2" }], replyTo: null } }, "A", c).revision;
  rev = reduce(rev, { type: "sigil:propose", payload: { clientId: "A-2", sourceMessageId: rev.messages[0].id } }, "A", c).revision;
  rev = reduce(rev, { type: "sigil:confirm", payload: { sigilId: "sigil-1" } }, "B", c).revision;
  rev.phase = "complete";

  const kept = reduce(rev, { type: "session:rematch", payload: { keepLexicon: true } }, "A", { ...c, ownershipSeed: 1 }).revision;
  assert.equal(kept.runNumber, 2);
  assert.equal(kept.sigils.confirmed.length, 1);
  assert.deepEqual(new Set(kept.unlockedPalette), new Set(fullPalette()));
  assert.equal(kept.phase, "puzzle");
  assert.equal(kept.puzzleIndex, 0);

  const fresh = reduce(rev, { type: "session:rematch", payload: { keepLexicon: false } }, "A", c).revision;
  assert.equal(fresh.sigils.confirmed.length, 0);
  assert.equal(fresh.sigilCounter, 0);
  assert.deepEqual(fresh.archivedTranscripts, []);
});

test("snapshots drop presence and refuse forbidden fields; recovery clears commitments", () => {
  const { rev, c } = advanceToPuzzle(0);
  let working = reduce(rev, { type: "presence:update", payload: { composing: true, guessReady: false } }, "A", c).revision;
  working = reduce(working, { type: "guess:commit", payload: { commitment: HEX_A } }, "A", c).revision;

  const snap = snapshot(working);
  assert.ok(!("presence" in snap));
  assert.equal(containsForbiddenKey(snap), false);
  assert.throws(() => snapshot({ ...working, roleData: { letters: ["B"] } }), /forbidden field/);

  const { revision: recovered, recommitRequired } = prepareRecovery(working);
  assert.deepEqual(recovered.commitments, { A: null, B: null });
  assert.equal(recommitRequired, true);
  assert.equal(recovered.version, working.version + 1);
});

// ------------------------------------------------------------ delta sync

test("a short lag is caught up with a delta of safe ops; anything else forces a full snapshot", () => {
  const { rev: start, c } = advanceToPuzzle(0);
  const base = start.version;
  let working = start;
  const log = [];
  const applySafe = (op, actor) => {
    working = reduce(working, op, actor, c).revision;
    log.push({ version: working.version, type: op.type, payload: op.payload, actor });
  };
  applySafe({ type: "message:send", payload: { clientId: "A-1", tokens: [{ kind: "icon", id: "shape:line" }], replyTo: null } }, "A");
  applySafe({ type: "message:send", payload: { clientId: "B-1", tokens: [{ kind: "icon", id: "count:1" }], replyTo: null } }, "B");

  const response = syncResponse(working, base, log);
  assert.equal(response.mode, "delta");
  assert.equal(response.fromVersion, base);
  assert.equal(response.toVersion, working.version);
  assert.ok(response.ops.every((o) => DELTA_SAFE_OPS.has(o.type)));

  const replayed = applyDelta(start, response.ops);
  assert.equal(replayed.ok, true);
  assert.equal(replayed.revision.version, working.version);
  assert.deepEqual(replayed.revision.messages.map((m) => m.author), ["A", "B"]);

  // A commit in the missed range is not delta-safe -> full snapshot instead.
  working = reduce(working, { type: "guess:commit", payload: { commitment: HEX_A } }, "A", c).revision;
  const withCommit = [...log, { version: working.version, type: "guess:commit", payload: { commitment: HEX_A }, actor: "A" }];
  assert.equal(syncResponse(working, base, withCommit).mode, "full");
});

test("applyDelta rejects a tampered op and leaves the revision untouched", () => {
  const { rev: start } = advanceToPuzzle(0);
  const validate = (op, actor) => validateOperation(op, operationContext(start, actor));
  const bad = applyDelta(start, [
    { type: "message:send", payload: { clientId: "not a valid id!!", tokens: [{ kind: "icon", id: "shape:line" }], replyTo: null }, actor: "A" },
  ], validate);
  assert.equal(bad.ok, false);
  assert.equal(bad.revision, start);
});

// -------------------------------------------------- paired loopback flows

function pairedSession(extra = {}) {
  const { channel, host: hostEp, joiner: joinerEp } = createLoopbackPair({ code: "ROOMAAA", mode: "manual" });
  const host = new GameHost(hostEp, {
    initial: { roomCode: "ROOMAAA", ownershipSeed: 0 },
    nextWord: stubWord,
    pars: () => ({ parTokens: 20, parMessages: 8 }),
    newId: makeIdFactory(),
    ...extra,
  });
  const client = new GameClient(joinerEp, { role: "B" });
  const secretsSeen = [];
  const check = (entry) => {
    secretsSeen.push(entry);
    assert.equal(containsForbiddenKey(entry.message), false, `no forbidden key in ${entry.message.type}`);
    assert.doesNotMatch(JSON.stringify(entry.message), /"BOAT"|"SHARK"/i);
  };
  const originalDispatch = channel._dispatch.bind(channel);
  channel._dispatch = (entry) => { check(entry); return originalDispatch(entry); };
  return { channel, host, client, hostEp, joinerEp, secretsSeen };
}

test("paired flow: tutorials, a reply, a reused sigil, and a correct solve", async () => {
  const { channel, host, client } = pairedSession();

  host.dispatchLocal({ type: "level:advance", payload: { fromPhase: "lobby", fromIndex: null } });
  channel.flush();
  host.dispatchLocal({ type: "tutorial:skipVote", payload: { vote: true } });
  client.send("tutorial:skipVote", { vote: true });
  channel.flush();
  assert.equal(host.revision.phase, "puzzle");
  assert.equal(client.revision.phase, "puzzle");
  assert.equal(client.revision.version, host.revision.version);

  host.dispatchLocal({ type: "message:send", payload: { clientId: "A-m1", tokens: [{ kind: "icon", id: "shape:loop" }, { kind: "icon", id: "count:2" }], replyTo: null } });
  channel.flush();
  const firstId = client.revision.messages[0].id;
  client.send("message:send", { clientId: "B-m1", tokens: [{ kind: "icon", id: "meta:confirm" }], replyTo: firstId });
  channel.flush();
  assert.equal(host.revision.messages[1].replyTo, firstId);

  host.dispatchLocal({ type: "sigil:propose", payload: { clientId: "A-s1", sourceMessageId: firstId } });
  channel.flush();
  client.send("sigil:confirm", { sigilId: "sigil-1" });
  channel.flush();
  assert.equal(host.revision.sigils.confirmed.length, 1);

  client.send("message:send", { clientId: "B-m2", tokens: [{ kind: "sigil", id: "sigil-1" }], replyTo: null });
  channel.flush();
  assert.equal(client.revision.messages.at(-1).tokens[0].kind, "sigil");

  host.localGuessCorrect = true;
  const salt = deriveSalt({ roomCode: "ROOMAAA", runNumber: 1, puzzleIndex: 0, wordId: host.revision.wordId });
  const commitment = await commitmentFor("boat", salt);
  host.dispatchLocal({ type: "guess:commit", payload: { commitment } });
  client.send("guess:commit", { commitment });
  channel.flush();

  assert.equal(host.revision.phase, "reveal");
  assert.equal(host.revision.lastOutcome.status, COMMITMENT_STATUS.SOLVED);
  assert.equal(host.revision.stars[0], 3);
  assert.equal(client.revision.stars[0], 3);
});

test("paired flow: simultaneous messages are serialised, never interleaved", () => {
  const { channel, host, client } = pairedSession();
  host.dispatchLocal({ type: "level:advance", payload: { fromPhase: "lobby", fromIndex: null } });
  host.dispatchLocal({ type: "tutorial:skipVote", payload: { vote: true } });
  client.send("tutorial:skipVote", { vote: true });
  channel.flush();

  // Both queue a two-token card before either is delivered.
  host.dispatchLocal({ type: "message:send", payload: { clientId: "A-x", tokens: [{ kind: "icon", id: "shape:line" }, { kind: "icon", id: "shape:curve" }], replyTo: null } });
  client.send("message:send", { clientId: "B-x", tokens: [{ kind: "icon", id: "count:1" }, { kind: "icon", id: "count:3" }], replyTo: null });
  channel.flush();

  const shapes = host.revision.messages.map((m) => m.tokens.map((t) => t.id));
  assert.equal(host.revision.messages.length, 2);
  for (const card of shapes) assert.equal(card.length, 2, "each card kept all of its own tokens together");
  assert.deepEqual(client.revision.messages.map((m) => m.tokens.map((t) => t.id)), shapes);
});

test("paired flow: disconnect and rejoin resyncs and forces a recommit", async () => {
  const { channel, host, client, secretsSeen } = pairedSession();
  host.dispatchLocal({ type: "level:advance", payload: { fromPhase: "lobby", fromIndex: null } });
  host.dispatchLocal({ type: "tutorial:skipVote", payload: { vote: true } });
  client.send("tutorial:skipVote", { vote: true });
  channel.flush();

  const salt = deriveSalt({ roomCode: "ROOMAAA", runNumber: 1, puzzleIndex: 0, wordId: host.revision.wordId });
  client.send("guess:commit", { commitment: await commitmentFor("boat", salt) });
  channel.flush();
  assert.equal(host.revision.commitments.B, await commitmentFor("boat", salt));

  let peerLeft = false;
  host.endpoint.addEventListener("peer-left", () => { peerLeft = true; });
  channel.joiner.close();
  assert.equal(peerLeft, true);

  const freshJoiner = channel.replaceConnection("B");
  client.rebind(freshJoiner);
  const { recommitRequired } = host.recoverPeer();
  channel.flush();

  assert.equal(recommitRequired, true);
  assert.equal(client.recommitRequired, true);
  assert.equal(client.revision.version, host.revision.version);
  assert.deepEqual(host.revision.commitments, { A: null, B: null }, "the stale commitment is gone");
  for (const entry of secretsSeen) assert.equal(containsForbiddenKey(entry.message), false);
});

test("paired flow: a dropped broadcast is recovered by a delta, not a full snapshot", () => {
  const { channel, host, client } = pairedSession();
  host.dispatchLocal({ type: "level:advance", payload: { fromPhase: "lobby", fromIndex: null } });
  host.dispatchLocal({ type: "tutorial:skipVote", payload: { vote: true } });
  client.send("tutorial:skipVote", { vote: true });
  channel.flush();
  const syncedVersion = client.revision.version;

  // Host sends two cards, but the joiner never receives those broadcasts.
  host.dispatchLocal({ type: "message:send", payload: { clientId: "A-d1", tokens: [{ kind: "icon", id: "shape:line" }], replyTo: null } });
  host.dispatchLocal({ type: "message:send", payload: { clientId: "A-d2", tokens: [{ kind: "icon", id: "count:2" }], replyTo: null } });
  channel.queue.length = 0; // the two revision:full broadcasts are lost

  let deltaSeen = 0;
  const originalDispatch = channel._dispatch.bind(channel);
  channel._dispatch = (entry) => { if (entry.message.type === "revision:delta") deltaSeen += 1; return originalDispatch(entry); };

  client.requestSync();
  channel.flush();

  assert.equal(deltaSeen, 1, "the host answered with a delta");
  assert.equal(client.revision.version, host.revision.version);
  assert.equal(client.revision.version, syncedVersion + 2);
  assert.deepEqual(client.revision.messages.map((m) => m.tokens[0].id), ["shape:line", "count:2"]);
});

test("paired flow: an unrecoverable host loss leaves the joiner on the last good snapshot", () => {
  const { channel, host, client } = pairedSession();
  host.dispatchLocal({ type: "level:advance", payload: { fromPhase: "lobby", fromIndex: null } });
  host.dispatchLocal({ type: "tutorial:skipVote", payload: { vote: true } });
  client.send("tutorial:skipVote", { vote: true });
  channel.flush();
  const lastVersion = client.revision.version;
  const lastPhase = client.revision.phase;

  let hostGone = false;
  client.endpoint.addEventListener("peer-left", () => { hostGone = true; });
  channel.host.close();

  assert.equal(hostGone, true);
  // The client cannot advance on its own — it holds only a read-only mirror.
  client.send("level:advance", { fromPhase: "puzzle", fromIndex: 0 });
  channel.flush();
  assert.equal(client.revision.version, lastVersion);
  assert.equal(client.revision.phase, lastPhase);
});
