import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir } from "node:fs/promises";
import test from "node:test";

import { ICONS } from "../icons.js";
import { randomRoomCode, Room } from "../network.js";
import { applyBoardOperation, canHostAdvance, validateIncomingMessage } from "../protocol.js";
import { LEVEL_SCHEDULE, WORDS } from "../words/manifest.js";
import roleA from "../words/role-a.js";
import roleB from "../words/role-b.js";

const wordIds = new Set(WORDS.map(({ id }) => id));
const baseContext = {
  localRole: "A", levelCount: LEVEL_SCHEDULE.length, levelIndex: 0, wordId: "w001",
  wordLength: 4, wordIds, allowedIconIds: new Set(Object.keys(ICONS)), maxBoardIcons: 4,
};

test("host advancement accepts each target only once", () => {
  assert.equal(canHostAdvance(2, 3, 10), true);
  assert.equal(canHostAdvance(3, 3, 10), false);
  assert.equal(canHostAdvance(3, 5, 10), false);
  assert.equal(canHostAdvance(10, 11, 10), false);
});

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

test("host serialization preserves simultaneous board additions", () => {
  let board = [];
  board = applyBoardOperation(board, { id: "A-one", kind: "add", iconId: "shape:line" }, "A", 4);
  board = applyBoardOperation(board, { id: "B-two", kind: "add", iconId: "shape:curve" }, "B", 4);
  assert.deepEqual(board.map(({ iconId, by }) => [iconId, by]), [["shape:line", "A"], ["shape:curve", "B"]]);
  board = applyBoardOperation(board, { id: "B-three", kind: "undo" }, "B", 4);
  assert.equal(board.length, 1);
  board = applyBoardOperation(board, { id: "A-four", kind: "clear" }, "A", 4);
  assert.deepEqual(board, []);
});

test("peer messages are role-aware, level-scoped, and schema validated", () => {
  const valid = { type: "board:op", payload: { levelIndex: 0, wordId: "w001", operation: { id: "B-safe", kind: "add", iconId: "shape:line" } } };
  assert.deepEqual(validateIncomingMessage(valid, baseContext), valid);
  assert.equal(validateIncomingMessage({ ...valid, payload: { ...valid.payload, levelIndex: 1 } }, baseContext), null);
  assert.equal(validateIncomingMessage({ ...valid, payload: { ...valid.payload, operation: { ...valid.payload.operation, iconId: 'x\" onmouseover=\"alert(1)' } } }, baseContext), null);
  assert.equal(validateIncomingMessage({ type: "level:advance", payload: { index: 1, wordId: "w002" } }, baseContext), null);
  assert.equal(validateIncomingMessage({ type: "guess:submit", payload: { levelIndex: 0, wordId: "w001", guess: "TOO-LONG" } }, baseContext), null);
});

test("generated word banks reconstruct every manifest word correctly", async () => {
  const sourceFiles = await readdir(new URL("../words/", import.meta.url));
  assert.equal(sourceFiles.filter((file) => /^w\d{3}\.[ab]\.js$/.test(file)).length, WORDS.length * 2);
  assert.equal(Object.keys(roleA).length, WORDS.length);
  assert.equal(Object.keys(roleB).length, WORDS.length);

  for (const word of WORDS) {
    const a = roleA[word.id];
    const b = roleB[word.id];
    const [sourceA, sourceB] = await Promise.all([
      import(`../words/${word.id}.a.js`).then((module) => module.default),
      import(`../words/${word.id}.b.js`).then((module) => module.default),
    ]);
    assert.ok(a && b, `${word.id} has both role slices`);
    assert.deepEqual(a, sourceA, `${word.id} role A bank is current`);
    assert.deepEqual(b, sourceB, `${word.id} role B bank is current`);
    assert.equal(a.positions.length, a.letters.length);
    assert.equal(b.positions.length, b.letters.length);
    const positions = [...a.positions, ...b.positions];
    assert.deepEqual([...positions].sort((x, y) => x - y), Array.from({ length: word.length }, (_, index) => index + 1));
    assert.equal(new Set(positions).size, word.length);
    const answer = Array(word.length);
    a.positions.forEach((position, index) => { answer[position - 1] = a.letters[index]; });
    b.positions.forEach((position, index) => { answer[position - 1] = b.letters[index]; });
    assert.equal(createHash("sha256").update(answer.join("")).digest("hex"), word.answerHash, `${word.id} hash`);
  }
});
