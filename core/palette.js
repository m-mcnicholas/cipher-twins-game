// The communication palette expands monotonically across the session, and
// letter ownership alternates parity every puzzle. Both are pure schedules with
// no dependency on the DOM or the network, so the host can derive them and the
// tests can assert them directly.

// Tutorials open with basic shapes, small counts, the meta signals, the two
// end-position relations, and the next-letter divider. Everything here stays
// available for the rest of the session.
export const TUTORIAL_PALETTE = Object.freeze([
  "shape:line", "shape:curve", "shape:loop", "shape:cross", "shape:dot",
  "count:1", "count:2", "count:3",
  "meta:confirm", "meta:reject", "meta:question", "meta:next",
  "pos:first", "pos:last",
]);

// One unlock step per scored puzzle (lengths 4, 4, 5, 5, 6, 7, 8). Each entry
// lists only the icons introduced at that puzzle; nothing is ever removed.
export const PUZZLE_PALETTE_UNLOCKS = Object.freeze([
  Object.freeze(["shape:symmetric", "shape:asymmetric"]),        // symmetry
  Object.freeze(["pos:before", "pos:after"]),                    // adjacency relations
  Object.freeze(["pos:between", "cmp:same", "cmp:diff"]),        // last position relation + same/different
  Object.freeze(["count:4", "count:5"]),                         // larger counts
  Object.freeze(["cat:animal", "cat:object", "cat:nature"]),     // category group one
  Object.freeze(["cat:action", "cat:food", "cat:feeling"]),      // category group two
  Object.freeze(["cmp:bigger", "cmp:smaller"]),                  // magnitude comparison
]);

export const PUZZLE_COUNT = PUZZLE_PALETTE_UNLOCKS.length;

// Cumulative palette visible during puzzle `index` (0-based). `index < 0` is the
// tutorial palette. Order is stable: tutorial icons first, then unlocks in the
// order they were introduced, de-duplicated.
export function paletteForPuzzle(index) {
  const seen = new Set();
  const ordered = [];
  const push = (id) => { if (!seen.has(id)) { seen.add(id); ordered.push(id); } };
  TUTORIAL_PALETTE.forEach(push);
  for (let i = 0; i <= index && i < PUZZLE_PALETTE_UNLOCKS.length; i += 1) {
    PUZZLE_PALETTE_UNLOCKS[i].forEach(push);
  }
  return ordered;
}

// The full palette once every unlock has fired — used by keep-lexicon rematches.
export function fullPalette() {
  return paletteForPuzzle(PUZZLE_PALETTE_UNLOCKS.length - 1);
}

// `next` is a monotonic successor of `prev` when it keeps every icon `prev`
// already had (order is not significant).
export function isMonotonicUnlock(prev, next) {
  const nextSet = new Set(next);
  return prev.every((id) => nextSet.has(id));
}

// Throws if the schedule ever drops a previously unlocked icon. Callers pass the
// sequence of palettes they intend to present, tutorial first.
export function assertMonotonicSchedule(palettes) {
  for (let i = 1; i < palettes.length; i += 1) {
    if (!isMonotonicUnlock(palettes[i - 1], palettes[i])) {
      const dropped = palettes[i - 1].filter((id) => !palettes[i].includes(id));
      throw new Error(`Palette step ${i} dropped unlocked icons: ${dropped.join(", ")}`);
    }
  }
  return true;
}

// ---- letter ownership -------------------------------------------------------

// `seedParity` (0 or 1) is chosen once at random by the host. From it, ownership
// of the odd-numbered positions alternates between the two network roles every
// puzzle, which also alternates who holds position 1 and who holds the extra
// letter on odd-length words.
export function ownershipForPuzzle(seedParity, puzzleIndex) {
  const aOwnsOdd = ((seedParity + puzzleIndex) % 2) === 0;
  return aOwnsOdd ? { A: "odd", B: "even" } : { A: "even", B: "odd" };
}

// Positions (1-based) held by the `"odd"` or `"even"` owner of a word of the
// given length.
export function positionsForParity(parity, wordLength) {
  const start = parity === "odd" ? 1 : 2;
  const positions = [];
  for (let position = start; position <= wordLength; position += 2) positions.push(position);
  return positions;
}
