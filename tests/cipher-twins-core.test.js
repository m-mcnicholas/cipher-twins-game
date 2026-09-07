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
import { computeStars, scorePuzzle, countTokens, expandedTokenCount } from "../core/scoring.js";
import { identityFor, tokenSignature, SIGIL_GLYPH_COUNT } from "../core/sigil-identity.js";
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

// Complete the current tutorial's checklist through the reducer, so a
// tutorial:readyVote is actually allowed to advance.
function completeTutorialObjectives(rev, c) {
  const idx = rev.tutorialIndex;
  const cc = { ...c, newId: makeIdFactory() };
  const cid = (who) => `${who}-obj-t${idx}`; // unique per tutorial so it isn't seen as a duplicate
  if (idx === 0) {
    rev = reduce(rev, { type: "message:send", payload: { clientId: cid("A"), tokens: [{ kind: "icon", id: "shape:line" }], replyTo: null } }, "A", cc).revision;
    const firstId = rev.messages[0].id;
    rev = reduce(rev, { type: "message:send", payload: { clientId: cid("B"), tokens: [{ kind: "icon", id: "meta:confirm" }], replyTo: firstId } }, "B", cc).revision;
    rev = reduce(rev, { type: "guess:commit", payload: { commitment: HEX_A } }, "A", cc).revision;
    rev = reduce(rev, { type: "guess:commit", payload: { commitment: HEX_A } }, "B", cc).revision;
  } else {
    rev = reduce(rev, { type: "message:send", payload: { clientId: cid("A"), tokens: [{ kind: "icon", id: "shape:loop" }, { kind: "icon", id: "count:2" }], replyTo: null } }, "A", cc).revision;
    rev = reduce(rev, { type: "sigil:propose", payload: { clientId: `A-objp-t${idx}`, sourceMessageId: rev.messages[0].id } }, "A", cc).revision;
    const sid = rev.sigils.pending[0].id;
    rev = reduce(rev, { type: "sigil:confirm", payload: { sigilId: sid } }, "B", cc).revision;
    rev = reduce(rev, { type: "message:send", payload: { clientId: cid("B"), tokens: [{ kind: "sigil", id: sid }] } }, "B", cc).revision;
  }
  return rev;
}

// Drive a revision from lobby to the start of puzzle `index` with the reducer.
// Uses the mutual skip vote (the by-design bypass) so callers that don't care
// about tutorials aren't coupled to the checklist.
function advanceToPuzzle(index, over = {}) {
  let rev = createInitialRevision({ roomCode: "ROOMAAA", ownershipSeed: 0 });
  const c = ctx(over);
  rev = reduce(rev, { type: "level:advance", payload: { fromPhase: "lobby", fromIndex: null } }, "A", c).revision;
  rev = reduce(rev, { type: "tutorial:skipVote", payload: { vote: true } }, "A", c).revision;
  rev = reduce(rev, { type: "tutorial:skipVote", payload: { vote: true } }, "B", c).revision;
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

test("expandedTokenCount weighs a sigil as the icons it stands for", () => {
  const confirmed = [{ id: "sigil-1", tokens: [{ kind: "icon", id: "a:1" }, { kind: "icon", id: "a:2" }, { kind: "icon", id: "a:3" }] }];
  assert.equal(expandedTokenCount([{ kind: "icon", id: "a:1" }, { kind: "sigil", id: "sigil-1" }], confirmed), 4);
  assert.equal(expandedTokenCount([{ kind: "sigil", id: "sigil-missing" }], confirmed), 1, "an unknown sigil id falls back to 1");
  assert.equal(expandedTokenCount([], confirmed), 0);
});

test("the scoring ledger counts every sent card, even after it is retracted", () => {
  const { rev: start, c } = advanceToPuzzle(0);
  const pars = { parTokens: 6, parMessages: 2 };
  let rev = start;
  const send = (clientId, tokens, actor) =>
    reduce(rev, { type: "message:send", payload: { clientId, tokens, replyTo: null } }, actor, c).revision;
  rev = send("A-1", [{ kind: "icon", id: "shape:line" }], "A");
  rev = send("A-2", [{ kind: "icon", id: "shape:curve" }], "A");
  rev = send("B-1", [{ kind: "icon", id: "count:2" }], "B");
  assert.equal(rev.roundStats.messagesSent, 3);
  assert.deepEqual(rev.roundStats.byAuthor, { A: 2, B: 1 });

  // A retracts both of its cards.
  for (const id of rev.messages.filter((m) => m.author === "A").map((m) => m.id)) {
    rev = reduce(rev, { type: "message:retract", payload: { messageId: id } }, "A", c).revision;
  }
  assert.equal(rev.messages.length, 1, "the transcript shrinks");
  assert.equal(rev.roundStats.messagesSent, 3, "the ledger does not");

  rev = reduce(rev, { type: "guess:commit", payload: { commitment: HEX_A } }, "A", c).revision;
  rev = reduce(rev, { type: "guess:commit", payload: { commitment: HEX_A } }, "B", { ...c, localGuessCorrect: true, pars }).revision;
  // 3 sent cards is over parMessages 2 -> the retract trick cannot buy back 3 stars.
  assert.equal(rev.stars[rev.puzzleIndex], 2);
  assert.equal(rev.lastOutcome.messages, 3);
  assert.equal(rev.lastOutcome.stars, 2);
  assert.equal(rev.lastOutcome.breakdown.withinPar, false);
});

test("roundStats resets when a new round begins", () => {
  const { rev: start, c } = advanceToPuzzle(0);
  let rev = reduce(start, { type: "message:send", payload: { clientId: "A-1", tokens: [{ kind: "icon", id: "shape:line" }], replyTo: null } }, "A", c).revision;
  assert.equal(rev.roundStats.messagesSent, 1);
  rev.phase = "reveal";
  rev.lastOutcome = { status: COMMITMENT_STATUS.SOLVED, puzzleIndex: 0, attempt: 1, agree: true };
  rev = reduce(rev, { type: "level:advance", payload: { fromPhase: "reveal", fromIndex: 0 } }, "A", c).revision;
  assert.equal(rev.puzzleIndex, 1);
  assert.deepEqual(rev.roundStats, {
    messagesSent: 0, tokensRaw: 0, tokensExpanded: 0, byAuthor: { A: 0, B: 0 }, sigilReuses: 0, firstTryAgree: null,
  });
});

// ------------------------------------------------------ sigil identity

test("a sigil's look is a pure, stable function of the icons it stands for", () => {
  const a = [{ kind: "icon", id: "shape:loop" }, { kind: "icon", id: "count:2" }];
  const b = [{ kind: "icon", id: "count:2" }, { kind: "icon", id: "shape:loop" }]; // order matters
  assert.deepEqual(identityFor(a), identityFor(a), "deterministic");
  assert.notDeepEqual(identityFor(a), identityFor(b), "reordered icons read as a different sigil");
  const id = identityFor(a);
  assert.ok(id.glyphIndex >= 0 && id.glyphIndex < SIGIL_GLYPH_COUNT);
  assert.ok(id.hue >= 0 && id.hue < 360);
  assert.equal(tokenSignature(a), "icon:shape:loop|icon:count:2");

  // reasonable spread: many distinct sequences do not all collapse to one glyph
  const glyphs = new Set();
  for (let i = 0; i < 60; i += 1) {
    glyphs.add(identityFor([{ kind: "icon", id: `x:${i}` }, { kind: "icon", id: "y:1" }]).glyphIndex);
  }
  assert.ok(glyphs.size >= 6, `saw ${glyphs.size} distinct glyphs across 60 sequences`);
});

test("sigilUses counts reuse in a card, not proposing or confirming, and survives a new round", () => {
  const { rev: start, c } = advanceToPuzzle(0);
  let rev = reduce(start, { type: "message:send", payload: { clientId: "A-1", tokens: [{ kind: "icon", id: "shape:loop" }, { kind: "icon", id: "count:2" }], replyTo: null } }, "A", c).revision;
  rev = reduce(rev, { type: "sigil:propose", payload: { clientId: "A-2", sourceMessageId: rev.messages[0].id } }, "A", c).revision;
  rev = reduce(rev, { type: "sigil:confirm", payload: { sigilId: "sigil-1" } }, "B", c).revision;
  assert.deepEqual(rev.sigilUses, {}, "confirming a sigil is not a use");

  rev = reduce(rev, { type: "message:send", payload: { clientId: "B-1", tokens: [{ kind: "sigil", id: "sigil-1" }, { kind: "sigil", id: "sigil-1" }] }, }, "B", c).revision;
  assert.equal(rev.sigilUses["sigil-1"], 2, "two sigil tokens in one card count twice");

  // advancing to the next puzzle keeps the cumulative count
  rev.phase = "reveal";
  rev.lastOutcome = { status: COMMITMENT_STATUS.SOLVED, puzzleIndex: 0, attempt: 1, agree: true };
  rev = reduce(rev, { type: "level:advance", payload: { fromPhase: "reveal", fromIndex: 0 } }, "A", c).revision;
  assert.equal(rev.sigilUses["sigil-1"], 2, "sigilUses is cumulative across the run");
  assert.equal(rev.roundStats.sigilReuses, 0, "but the per-round reuse counter reset");
});

test("a fresh rematch wipes sigilUses; keeping the lexicon preserves it", () => {
  let rev = createInitialRevision();
  rev.phase = "complete";
  rev.sigils.confirmed = [{ id: "sigil-1", alias: "Sigil 1", tokens: [{ kind: "icon", id: "shape:loop" }, { kind: "icon", id: "count:2" }], proposedBy: "A", confirmedBy: "B" }];
  rev.sigilUses = { "sigil-1": 5 };
  const c = ctx();

  const kept = reduce(rev, { type: "session:rematch", payload: { keepLexicon: true } }, "A", c).revision;
  assert.equal(kept.sigilUses["sigil-1"], 5, "kept language keeps its history");

  const fresh = reduce(rev, { type: "session:rematch", payload: { keepLexicon: false } }, "A", c).revision;
  assert.deepEqual(fresh.sigilUses, {}, "fresh start clears it");
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
  // the reveal screen (WP-2) reads its scorecard straight off lastOutcome
  assert.equal(rev.lastOutcome.tokens, 0);
  assert.equal(rev.lastOutcome.messages, 0);
  assert.equal(rev.lastOutcome.parTokens, 20);
  assert.equal(rev.lastOutcome.parMessages, 8);
  assert.equal(rev.lastOutcome.stars, 3);
  assert.equal(rev.lastOutcome.breakdown.withinPar, true);
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

  // level:advance no longer handles the tutorial phase — only a mutual
  // tutorial:readyVote can move it. The op is silently ignored, not an error.
  const ignored = reduce(rev, { type: "level:advance", payload: { fromPhase: "tutorial", fromIndex: 0 } }, "A", c);
  assert.equal(ignored.revision.version, rev.version);
  assert.equal(ignored.revision.phase, "tutorial");

  rev = reduce(rev, { type: "tutorial:readyVote", payload: { vote: true } }, "A", c).revision;
  assert.equal(rev.phase, "tutorial", "one confirmation is not enough");
  rev = reduce(rev, { type: "tutorial:readyVote", payload: { vote: true } }, "B", c).revision;
  assert.equal(rev.tutorialIndex, 0, "both ready, but the checklist is unfinished — still here");
  rev = completeTutorialObjectives(rev, c);   // both are already ready -> auto-advances
  assert.equal(rev.tutorialIndex, 1, "checklist done -> next tutorial");
  rev = completeTutorialObjectives(rev, c);
  rev = reduce(rev, { type: "tutorial:readyVote", payload: { vote: true } }, "A", c).revision;
  rev = reduce(rev, { type: "tutorial:readyVote", payload: { vote: true } }, "B", c).revision;
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

test("a tutorial needs both readiness votes AND its checklist before it advances", () => {
  let rev = createInitialRevision();
  const c = ctx();
  rev = reduce(rev, { type: "level:advance", payload: { fromPhase: "lobby", fromIndex: null } }, "A", c).revision;

  // Both say they're ready, but nothing has been done yet.
  rev = reduce(rev, { type: "tutorial:readyVote", payload: { vote: true } }, "A", c).revision;
  const blocked = reduce(rev, { type: "tutorial:readyVote", payload: { vote: true } }, "B", c);
  assert.equal(blocked.revision.tutorialIndex, 0, "mutual readiness is not enough on its own");
  assert.ok(blocked.effects.some((e) => e.type === "readyBlocked"), "the UI is told the checklist is blocking");
  rev = blocked.revision;

  // Work the checklist: send a card, reply to the partner, match a fingerprint.
  rev = reduce(rev, { type: "message:send", payload: { clientId: "A-1", tokens: [{ kind: "icon", id: "shape:line" }], replyTo: null } }, "A", c).revision;
  assert.deepEqual(rev.tutorialObjectives, { sentCard: true });
  const firstId = rev.messages[0].id;
  rev = reduce(rev, { type: "message:send", payload: { clientId: "B-1", tokens: [{ kind: "icon", id: "meta:confirm" }], replyTo: firstId } }, "B", c).revision;
  assert.equal(rev.tutorialObjectives.repliedToPartner, true);
  assert.equal(rev.phase, "tutorial", "still here — the guess objective is outstanding");
  rev = reduce(rev, { type: "guess:commit", payload: { commitment: HEX_A } }, "A", c).revision;
  // The final objective lands while both votes still stand -> auto-advance.
  rev = reduce(rev, { type: "guess:commit", payload: { commitment: HEX_A } }, "B", c).revision;
  assert.equal(rev.tutorialIndex, 1, "checklist complete + both ready -> next tutorial");

  // A replying to their own card does not count as replying to the partner.
  rev = reduce(rev, { type: "message:send", payload: { clientId: "A-2", tokens: [{ kind: "icon", id: "shape:loop" }, { kind: "icon", id: "count:2" }], replyTo: null } }, "A", c).revision;
  rev = reduce(rev, { type: "message:send", payload: { clientId: "A-3", tokens: [{ kind: "icon", id: "shape:dot" }], replyTo: rev.messages[0].id } }, "A", c).revision;
  assert.equal(rev.tutorialObjectives.repliedToPartner, undefined);

  // Tutorial 2: propose, approve, reuse.
  rev = reduce(rev, { type: "sigil:propose", payload: { clientId: "A-4", sourceMessageId: rev.messages[0].id } }, "A", c).revision;
  assert.equal(rev.tutorialObjectives.proposedSigil, true);
  const sid = rev.sigils.pending[0].id;
  rev = reduce(rev, { type: "sigil:confirm", payload: { sigilId: sid } }, "B", c).revision;
  assert.equal(rev.tutorialObjectives.approvedSigil, true);
  rev = reduce(rev, { type: "tutorial:readyVote", payload: { vote: true } }, "A", c).revision;
  rev = reduce(rev, { type: "tutorial:readyVote", payload: { vote: true } }, "B", c).revision;
  assert.equal(rev.phase, "tutorial", "reuse still missing");
  rev = reduce(rev, { type: "message:send", payload: { clientId: "B-2", tokens: [{ kind: "sigil", id: sid }] } }, "B", c).revision;
  assert.equal(rev.phase, "puzzle", "reusing the sigil finishes the checklist and both were ready");
  assert.equal(rev.puzzleIndex, 0);
});

test("a mutual skip vote bypasses the tutorial checklist entirely", () => {
  let rev = createInitialRevision();
  const c = ctx();
  rev = reduce(rev, { type: "level:advance", payload: { fromPhase: "lobby", fromIndex: null } }, "A", c).revision;
  rev = reduce(rev, { type: "tutorial:skipVote", payload: { vote: true } }, "A", c).revision;
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

test("paired flow: presence is relayed to the partner without a version bump", () => {
  const { channel, host, client, secretsSeen } = pairedSession();
  host.dispatchLocal({ type: "level:advance", payload: { fromPhase: "lobby", fromIndex: null } });
  host.dispatchLocal({ type: "tutorial:skipVote", payload: { vote: true } });
  client.send("tutorial:skipVote", { vote: true });
  channel.flush();
  const settledVersion = host.revision.version;

  client.send("presence:update", { composing: true, guessReady: false });
  channel.flush();
  assert.equal(host.revision.presence.B.composing, true);
  assert.equal(client.revision.presence.B.composing, true, "the joiner sees its own relayed presence");
  assert.equal(host.revision.version, settledVersion, "presence does not bump the version");

  host.dispatchLocal({ type: "presence:update", payload: { composing: false, guessReady: true } });
  channel.flush();
  assert.equal(client.revision.presence.A.guessReady, true, "the joiner sees the host's presence");
  assert.equal(host.revision.version, settledVersion);
  for (const entry of secretsSeen) assert.equal(containsForbiddenKey(entry.message), false);
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
