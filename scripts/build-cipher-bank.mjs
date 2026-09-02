// Curates the active Cipher Twins word bank for the cooperative-language
// redesign and regenerates the three generated word files.
//
//   words/bank.js       — shared metadata only: id, length, canonical category,
//                         tier, provisional familiarity, provisional pars, and
//                         the unsalted SHA-256 answer hash. No plaintext.
//   words/bank-odd.js   — odd-position letters per word (fetched by whichever
//   words/bank-even.js     player currently owns that parity for a puzzle)
//
// Source of truth is the existing split slices (words/w###.a.js / .b.js) plus
// words/manifest.js, which stay as the full reserve pool. Run:
//
//   npm run generate:cipher-bank
//
// FAMILIARITY and PARS are provisional — the redesign plan calls for tuning
// them from observed playtests before star ratings are treated as final.

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const wordsDir = resolve(import.meta.dirname, "../words");
const TIER_LENGTHS = [4, 4, 5, 5, 6, 7, 8]; // one scored puzzle per tier
const PER_TIER = 12;
const TUTORIALS = [
  { slot: 0, word: "FISH" }, // teaches composing / sending / replying / private agreement
  { slot: 1, word: "LAMP" }, // teaches proposing / confirming / reusing a sigil
];

// Deliberately excluded: obscure, ambiguous-category, or same-family forms.
const DENYLIST = new Set([
  "CIVET", "GRAVY", "MALLARD", "OYSTER", "MOSS", "REEF", "DUNE", "VINE", "MIST",
  "ANXIETY", "SADNESS", "HAPPINESS", "JEALOUSY", "GRATITUDE", "CONFIDENT",
  "WHEAT", "GLAD", "KIND", "EAGER",
]);

// Small hand-set of high-recognition words -> familiarity 5.
const VERY_FAMILIAR = new Set([
  "FISH", "BIRD", "WOLF", "LION", "BEAR", "DUCK", "FROG", "CAKE", "SOUP", "RICE",
  "MILK", "CORN", "TREE", "RAIN", "SNOW", "LAKE", "BOOK", "DOOR", "LAMP", "DESK",
  "RING", "FLAG", "JUMP", "SWIM", "WALK", "SING", "LOVE", "FEAR", "HOPE", "CALM",
  "MOUSE", "TIGER", "ZEBRA", "SNAKE", "SHARK", "WHALE", "PANDA", "HORSE", "SHEEP",
  "EAGLE", "APPLE", "BREAD", "PIZZA", "HONEY", "LEMON", "GRAPE", "PEACH", "ONION",
  "RIVER", "OCEAN", "CLOUD", "STORM", "BEACH", "STONE", "GRASS", "CHAIR", "TABLE",
  "KNIFE", "PHONE", "PAPER", "PLATE", "SPOON", "WATCH", "RADIO", "DANCE", "CLIMB",
  "THROW", "CATCH", "LAUGH", "SLEEP", "SMILE", "WRITE", "ANGER", "HAPPY", "TIRED",
  "BRAVE", "RABBIT", "MONKEY", "TURTLE", "SPIDER", "BANANA", "CARROT", "CHERRY",
  "TOMATO", "POTATO", "FOREST", "DESERT", "VALLEY", "ISLAND", "SUNSET", "PENCIL",
  "BOTTLE", "LADDER", "PILLOW", "WINDOW", "MIRROR", "BASKET", "CAMERA", "WALLET",
  "DOLPHIN", "PENGUIN", "GIRAFFE", "LEOPARD", "OCTOPUS", "GORILLA", "PANCAKE",
  "POPCORN", "PUMPKIN", "RAINBOW", "THUNDER", "BLANKET", "LANTERN", "JOURNAL",
  "ELEPHANT", "KANGAROO", "FLAMINGO", "SANDWICH", "BROCCOLI", "DOUGHNUT",
  "MOUNTAIN", "SUNLIGHT", "BACKPACK", "KEYBOARD", "UMBRELLA", "SUITCASE",
  "CURIOUS", "NERVOUS", "EXCITED", "JOYFUL", "AMAZED", "SURPRISE", "GRATEFUL",
]);

function familiarityFor(word, length) {
  if (VERY_FAMILIAR.has(word)) return 5;
  if (length <= 5) return 4;
  if (length <= 7) return 3;
  return 2;
}

// Provisional efficiency pars, scaled by length. parMessages ~ one card per
// letter plus a little slack; parTokens ~ a handful of icons per letter.
function parsFor(length) {
  return { parTokens: Math.round(length * 2.5) + 4, parMessages: length + 3 };
}

function shareFamily(a, b) {
  if (a === b) return true;
  const short = a.length <= b.length ? a : b;
  const long = a.length <= b.length ? b : a;
  if (long.startsWith(short)) return true; // plural / derived form
  return a.slice(0, 4) === b.slice(0, 4); // same 4-letter stem
}

async function reconstruct() {
  const manifestSource = await readFile(resolve(wordsDir, "manifest.js"), "utf8");
  const roleA = (await import(resolve(wordsDir, "role-a.js"))).default;
  const roleB = (await import(resolve(wordsDir, "role-b.js"))).default;
  const { WORDS } = await import(resolve(wordsDir, "manifest.js"));
  void manifestSource;

  return WORDS.map((entry) => {
    const a = roleA[entry.id];
    const b = roleB[entry.id];
    const letters = Array(entry.length);
    a.positions.forEach((position, i) => { letters[position - 1] = a.letters[i]; });
    b.positions.forEach((position, i) => { letters[position - 1] = b.letters[i]; });
    return { id: entry.id, word: letters.join(""), category: entry.category, length: entry.length };
  });
}

function pickTier(pool, count, taken) {
  // Round-robin over categories for balance, deterministic order, skip families.
  const byCategory = new Map();
  for (const row of pool) {
    if (!byCategory.has(row.category)) byCategory.set(row.category, []);
    byCategory.get(row.category).push(row);
  }
  for (const list of byCategory.values()) list.sort((x, y) => x.word.localeCompare(y.word));
  const categories = [...byCategory.keys()].sort();

  const chosen = [];
  let cursor = 0;
  let guard = 0;
  while (chosen.length < count && guard < 5000) {
    guard += 1;
    const category = categories[cursor % categories.length];
    cursor += 1;
    const list = byCategory.get(category);
    const perCategoryCap = Math.ceil(count / Math.min(categories.length, 4)) + 1;
    if (chosen.filter((c) => c.category === category).length >= perCategoryCap) continue;
    const next = list.find(
      (row) => !taken.has(row.word) && !chosen.some((c) => shareFamily(c.word, row.word)),
    );
    if (!next) continue;
    list.splice(list.indexOf(next), 1);
    chosen.push(next);
    taken.add(next.word);
  }
  if (chosen.length < count) {
    throw new Error(`Could not fill a tier: got ${chosen.length}/${count}`);
  }
  return chosen.sort((x, y) => x.word.localeCompare(y.word));
}

function slice(word, parity) {
  const positions = [];
  const letters = [];
  const start = parity === "odd" ? 1 : 2;
  for (let position = start; position <= word.length; position += 2) {
    positions.push(position);
    letters.push(word[position - 1]);
  }
  return { positions, letters };
}

function serialiseModule(name, object) {
  return `// Generated by npm run generate:cipher-bank. Do not edit by hand.\n`
    + `export default ${JSON.stringify(object, null, 2)};\n`;
}

async function main() {
  const rows = (await reconstruct()).filter((row) => !DENYLIST.has(row.word));
  const taken = new Set();

  // Tutorials first so their words are reserved out of the scored pool.
  const tutorialEntries = TUTORIALS.map(({ slot, word }) => {
    const row = rows.find((r) => r.word === word);
    if (!row) throw new Error(`Tutorial word ${word} is not in the reserve pool.`);
    taken.add(word);
    return { ...row, slot };
  });

  const tiers = [];
  for (let tier = 0; tier < TIER_LENGTHS.length; tier += 1) {
    const length = TIER_LENGTHS[tier];
    const pool = rows.filter((row) => row.length === length && !taken.has(row.word));
    tiers.push(pickTier(pool, PER_TIER, taken));
  }

  const active = [];
  const oddSlices = {};
  const evenSlices = {};

  const register = (row, tier, { tutorial = false, slot = null } = {}) => {
    const answerHash = createHash("sha256").update(row.word).digest("hex");
    active.push({
      id: row.id,
      length: row.length,
      category: row.category,
      tier,
      tutorial,
      slot,
      familiarity: familiarityFor(row.word, row.length),
      ...parsFor(row.length),
      answerHash,
    });
    oddSlices[row.id] = slice(row.word, "odd");
    evenSlices[row.id] = slice(row.word, "even");
  };

  tutorialEntries.forEach((entry) => register(entry, "tutorial", { tutorial: true, slot: entry.slot }));
  tiers.forEach((tierRows, tier) => tierRows.forEach((row) => register(row, tier)));

  const activeIds = new Set(active.map((a) => a.id));
  const reserveIds = rows.filter((row) => !activeIds.has(row.id)).map((row) => row.id).sort();

  // ---- validation ----
  const problems = [];
  for (let tier = 0; tier < TIER_LENGTHS.length; tier += 1) {
    const list = active.filter((a) => a.tier === tier);
    if (list.length !== PER_TIER) problems.push(`tier ${tier} has ${list.length} words, expected ${PER_TIER}`);
    if (list.some((a) => a.length !== TIER_LENGTHS[tier])) problems.push(`tier ${tier} has a wrong-length word`);
    if (new Set(list.map((a) => a.category)).size < 3) problems.push(`tier ${tier} spans fewer than 3 categories`);
  }
  const seenHashes = new Set();
  for (const entry of active) {
    if (seenHashes.has(entry.answerHash)) problems.push(`duplicate answer hash for ${entry.id}`);
    seenHashes.add(entry.answerHash);
    const odd = oddSlices[entry.id];
    const even = evenSlices[entry.id];
    const merged = odd.positions.length + even.positions.length;
    if (merged !== entry.length) problems.push(`${entry.id} slices do not cover ${entry.length} positions`);
  }
  if (problems.length) {
    console.error("Bank validation failed:\n - " + problems.join("\n - "));
    process.exit(1);
  }

  const bankModule = `// Generated by npm run generate:cipher-bank. Do not edit by hand.
//
// Shared metadata only — no plaintext letters. FAMILIARITY (1-5) and the pars
// are provisional and meant to be tuned from playtests. Odd/even letter slices
// live in bank-odd.js / bank-even.js and are fetched per puzzle by whichever
// player currently owns that parity.
export const ACTIVE_WORDS = ${JSON.stringify(active, null, 2)};

export const TIER_LENGTHS = ${JSON.stringify(TIER_LENGTHS)};

// Ids kept as reserve content for future rotations.
export const RESERVE_IDS = ${JSON.stringify(reserveIds)};
`;

  await writeFile(resolve(wordsDir, "bank.js"), bankModule);
  await writeFile(resolve(wordsDir, "bank-odd.js"), serialiseModule("bank-odd", oddSlices));
  await writeFile(resolve(wordsDir, "bank-even.js"), serialiseModule("bank-even", evenSlices));

  console.log(`Wrote bank.js (${active.length} active: 2 tutorial + ${TIER_LENGTHS.length}x${PER_TIER}), `
    + `bank-odd.js, bank-even.js. ${reserveIds.length} ids held in reserve.`);
}

main();
