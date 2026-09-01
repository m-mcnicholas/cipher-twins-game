// Private guessing without ever putting a plaintext guess on the wire.
//
// Each player derives the same per-puzzle salt from public round facts, hashes
// `${salt}:${guess}` with SHA-256, and sends only that digest to the host. The
// host compares the two digests:
//
//   - equal digests  -> the players guessed the same word
//   - unequal digests -> the players guessed different words
//
// Whether an agreed word is *correct* is decided by each client locally, by
// hashing its own plaintext guess against the manifest answer hash. That check
// never leaves the browser, so no message, snapshot, or log carries a guess,
// a letter, or the position where two guesses diverged.
//
// Concealment, stated plainly: the candidate pool for a puzzle is small and
// both players know the salt, the word length, and the category, so a player
// who wants to can hash every candidate and back out their partner's guess.
// This is casual concealment — it keeps guesses out of the transcript and the
// network tab, not a guarantee against a partner who is trying to peek.

import { sha256Hex } from "./sha256.js";

export function normalizeGuess(text) {
  return String(text ?? "").toUpperCase().replace(/[^A-Z]/g, "");
}

// Deterministic and identical on both peers: derived only from round facts that
// already live in the shared revision.
export function deriveSalt({ roomCode, runNumber, puzzleIndex, wordId }) {
  return `cipher-twins-guess-v1|${roomCode}|${runNumber}|${puzzleIndex}|${wordId}`;
}

export async function commitmentFor(guess, salt) {
  const normalized = normalizeGuess(guess);
  if (!normalized) throw new Error("Cannot commit an empty guess.");
  return sha256Hex(`${salt}:${normalized}`);
}

// True when a normalized plaintext guess matches the manifest answer hash. The
// answer hash is unsalted (it ships in the public manifest); only the
// peer-to-peer agreement commitment is salted.
export async function guessIsCorrect(guess, answerHash) {
  return (await sha256Hex(normalizeGuess(guess))) === answerHash;
}

export const COMMITMENT_STATUS = Object.freeze({
  PENDING: "pending",
  SOLVED: "solved",
  AGREED_WRONG: "agreed-wrong",
  DIFFER: "differ",
});

export const COMMITMENT_MESSAGES = Object.freeze({
  [COMMITMENT_STATUS.PENDING]: "Waiting for both private guesses…",
  [COMMITMENT_STATUS.SOLVED]: "You both committed the same word — and it's the answer.",
  [COMMITMENT_STATUS.AGREED_WRONG]: "You agreed, but the answer is different.",
  [COMMITMENT_STATUS.DIFFER]: "Your private guesses differ.",
});

// `mine` / `theirs` are the two salted commitment digests (or null while a
// player has not committed). `correct` is the caller's own local correctness
// result and is only consulted when the two digests agree.
export function resolveCommitments({ mine, theirs, correct }) {
  if (!mine || !theirs) {
    return { status: COMMITMENT_STATUS.PENDING, agree: null, resolved: false, message: COMMITMENT_MESSAGES.pending };
  }
  const agree = mine === theirs;
  let status;
  if (!agree) status = COMMITMENT_STATUS.DIFFER;
  else status = correct ? COMMITMENT_STATUS.SOLVED : COMMITMENT_STATUS.AGREED_WRONG;
  return { status, agree, resolved: true, message: COMMITMENT_MESSAGES[status] };
}
