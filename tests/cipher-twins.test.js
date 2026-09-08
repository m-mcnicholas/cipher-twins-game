import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { randomRoomCode, Room } from "../network.js";
import { ACTIVE_WORDS, TIER_LENGTHS, RESERVE_IDS } from "../words/bank.js";
import oddSlices from "../words/bank-odd.js";
import evenSlices from "../words/bank-even.js";
import { ICONS } from "../icons.js";
import { WORDS } from "../words/manifest.js";
import roleA from "../words/role-a.js";
import roleB from "../words/role-b.js";

// ---- room / transport --------------------------------------------------

test("room codes use the longer unambiguous format", () => {
  const codes = new Set(Array.from({ length: 200 }, () => randomRoomCode()));
  assert.equal(codes.size, 200);
  for (const code of codes) assert.match(code, /^[A-HJ-NP-Z2-9]{7}$/);
});

test("room state reports a peer disconnection", () => {
  const handlers = new Map();
  const connection = { on: (name, handler) => handlers.set(name, handler) };
  const room = new Room();
  let disconnected = false;
  room.addEventListener("peer-left", () => { disconnected = true; });
  room._wireConnection(connection);
  handlers.get("close")();
  assert.equal(disconnected, true);
});

// ---- curated word bank -----------------------------------------------

test("the curated bank has 2 tutorial words and 7 balanced tiers of 12", () => {
  const tutorials = ACTIVE_WORDS.filter((w) => w.tutorial);
  assert.deepEqual(tutorials.map((w) => w.slot).sort(), [0, 1]);

  assert.equal(TIER_LENGTHS.length, 7);
  for (let tier = 0; tier < TIER_LENGTHS.length; tier += 1) {
    const rows = ACTIVE_WORDS.filter((w) => w.tier === tier);
    assert.equal(rows.length, 12, `tier ${tier} count`);
    assert.ok(rows.every((w) => w.length === TIER_LENGTHS[tier]), `tier ${tier} lengths`);
    assert.ok(new Set(rows.map((w) => w.category)).size >= 3, `tier ${tier} category spread`);
    assert.ok(rows.every((w) => w.parTokens > 0 && w.parMessages > 0), `tier ${tier} pars present`);
    assert.ok(rows.every((w) => w.familiarity >= 1 && w.familiarity <= 5), `tier ${tier} familiarity range`);
  }
  assert.ok(RESERVE_IDS.length > 100, "the rest of the pool is retained as reserve");
});

test("every active word's odd+even slices reconstruct to its answer hash", () => {
  for (const entry of ACTIVE_WORDS) {
    const odd = oddSlices[entry.id];
    const even = evenSlices[entry.id];
    assert.ok(odd && even, `${entry.id} has both slices`);
    const letters = Array(entry.length);
    odd.positions.forEach((p, i) => { letters[p - 1] = odd.letters[i]; });
    even.positions.forEach((p, i) => { letters[p - 1] = even.letters[i]; });
    assert.equal(letters.filter(Boolean).length, entry.length, `${entry.id} fully covered`);
    assert.deepEqual(odd.positions, odd.positions.filter((p) => p % 2 === 1), `${entry.id} odd parity`);
    assert.deepEqual(even.positions, even.positions.filter((p) => p % 2 === 0), `${entry.id} even parity`);
    assert.equal(
      createHash("sha256").update(letters.join("")).digest("hex"),
      entry.answerHash,
      `${entry.id} hash`,
    );
  }
});

test("the shared bank metadata carries no plaintext letters or answers", async () => {
  const source = await readFile(new URL("../words/bank.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /"word"\s*:/);
  assert.doesNotMatch(source, /"letters"\s*:/);
  for (const entry of ACTIVE_WORDS) {
    assert.equal(Object.prototype.hasOwnProperty.call(entry, "word"), false, `${entry.id} exposes no plaintext`);
  }
});

test("the reserve pool's generated role banks stay in sync with their sources", async () => {
  assert.equal(Object.keys(roleA).length, WORDS.length);
  assert.equal(Object.keys(roleB).length, WORDS.length);
  for (const word of WORDS) {
    const a = roleA[word.id];
    const b = roleB[word.id];
    assert.ok(a && b, `${word.id} has both role slices`);
    const positions = [...a.positions, ...b.positions];
    assert.deepEqual(positions.sort((x, y) => x - y), Array.from({ length: word.length }, (_, i) => i + 1));
    const letters = Array(word.length);
    a.positions.forEach((p, i) => { letters[p - 1] = a.letters[i]; });
    b.positions.forEach((p, i) => { letters[p - 1] = b.letters[i]; });
    assert.equal(createHash("sha256").update(letters.join("")).digest("hex"), word.answerHash, `${word.id} hash`);
  }
});

test("tutorial and puzzle palettes only reference real icons", async () => {
  const { paletteForPuzzle, TUTORIAL_PALETTE } = await import("../core/palette.js");
  const iconIds = new Set(Object.keys(ICONS));
  for (const id of TUTORIAL_PALETTE) assert.ok(iconIds.has(id), `${id} exists`);
  for (let tier = 0; tier < TIER_LENGTHS.length; tier += 1) {
    for (const id of paletteForPuzzle(tier)) assert.ok(iconIds.has(id), `${id} exists`);
  }
});

test("the redundant category icons are gone, replaced by letter-form vocabulary", async () => {
  const { paletteForPuzzle } = await import("../core/palette.js");
  assert.equal(Object.keys(ICONS).some((id) => id.startsWith("cat:")), false, "no category icons remain");
  const full = new Set(paletteForPuzzle(TIER_LENGTHS.length - 1));
  for (const id of ["form:enclosed", "form:open", "form:vowel", "form:upright", "form:wide", "form:echo"]) {
    assert.ok(ICONS[id] && ICONS[id].group === "Letter form", `${id} is a Letter form icon`);
    assert.ok(full.has(id), `${id} unlocks by the end of the campaign`);
  }
});

test("the ambiguity analyzer counts consistent candidates per seat", async () => {
  const { ambiguityFor, visiblePositions } = await import("../scripts/analyze-ambiguity.mjs");
  assert.deepEqual(visiblePositions("odd", 5), [1, 3, 5]);
  assert.deepEqual(visiblePositions("even", 5), [2, 4]);

  // BEAR: odd seat sees B_A_ (pos 1,3); even seat sees _E_R (pos 2,4).
  const bankPool = [
    { word: "BEAR", category: "animal", length: 4 },
    { word: "BEAD", category: "object", length: 4 }, // wrong category -> ignored by the bank count
    { word: "BOAR", category: "animal", length: 4 }, // shares BEAR's odd half
  ];
  const dict = new Map([[4, ["BEAR", "BEAD", "BEAK", "BOAR", "REAR", "GEAR"]]]);
  const amb = ambiguityFor("BEAR", "animal", bankPool, dict);

  assert.equal(amb.bankOdd, 1, "BOAR shares B_A_");
  assert.equal(amb.bankEven, 0);
  assert.equal(amb.dictOdd, 3, "BEAD, BEAK, BOAR all match B_A_");
  assert.equal(amb.dictEven, 2, "REAR, GEAR match _E_R");
  assert.equal(amb.asymmetry, 1);
  assert.equal(amb.trivialSeat, null);

  // A word only one dict word matches on a seat -> that seat is trivial.
  const dict2 = new Map([[4, ["BEAR", "GEAR"]]]);
  assert.equal(ambiguityFor("BEAR", "animal", [], dict2).trivialSeat, "odd", "nothing else fits B_A_");
});
