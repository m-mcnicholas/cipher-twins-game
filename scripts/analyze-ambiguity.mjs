// Measures how ambiguous each active word is *from each player's seat* — the
// question the difficulty curve should actually be built on (see the design
// review's WP-6). Length is a poor proxy: half of an 8-letter animal plus the
// category can pin the answer immediately, while a 4-letter word stays open.
//
//   npm run analyze:ambiguity
//   AMBIGUITY_WORDLIST=/path/to/words npm run analyze:ambiguity
//
// The "odd" player sees positions 1,3,5,…; the "even" player sees 2,4,6,…. For
// each seat we count words consistent with what that seat can see, two ways:
//
//   bank  — other bank words of the same length AND category (the pool a
//           partner is realistically choosing between)
//   dict  — any English word of the same length matching the visible letters
//           (how distinctive the half is in the language at large)
//
// A `dict` count of ≤1 means that seat can identify the word with no help at
// all — the thing to keep out of the early tiers, and to treat as a separate
// playtest case per parity.
//
// The dictionary is $AMBIGUITY_WORDLIST, else /usr/share/dict/words, else the
// bank's own vocabulary (with a printed caveat). This script is only a
// reporting aid; nothing consumes its output automatically yet. Re-tiering the
// campaign from it should wait for WP-3 playtest data — see the plan.

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const wordsDir = resolve(import.meta.dirname, "../words");

export async function reconstructAll() {
  const roleA = (await import(resolve(wordsDir, "role-a.js"))).default;
  const roleB = (await import(resolve(wordsDir, "role-b.js"))).default;
  const { WORDS } = await import(resolve(wordsDir, "manifest.js"));
  return WORDS.map((entry) => {
    const letters = Array(entry.length);
    roleA[entry.id].positions.forEach((p, i) => { letters[p - 1] = roleA[entry.id].letters[i]; });
    roleB[entry.id].positions.forEach((p, i) => { letters[p - 1] = roleB[entry.id].letters[i]; });
    return { id: entry.id, word: letters.join(""), category: entry.category, length: entry.length };
  });
}

export function visiblePositions(parity, length) {
  const out = [];
  for (let p = parity === "odd" ? 1 : 2; p <= length; p += 2) out.push(p);
  return out;
}

// Build a Map<length, string[]> of uppercase A-Z-only words from a newline list.
function indexWordList(text) {
  const byLength = new Map();
  for (const raw of text.split(/\r?\n/)) {
    const w = raw.trim().toUpperCase();
    if (!/^[A-Z]+$/.test(w)) continue;
    if (!byLength.has(w.length)) byLength.set(w.length, new Set());
    byLength.get(w.length).add(w);
  }
  for (const [len, set] of byLength) byLength.set(len, [...set]);
  return byLength;
}

export function loadDictionary() {
  const explicit = process.env.AMBIGUITY_WORDLIST;
  const path = explicit || (existsSync("/usr/share/dict/words") ? "/usr/share/dict/words" : null);
  if (!path) return { byLength: null, source: null };
  return { byLength: indexWordList(readFileSync(path, "utf8")), source: path };
}

const matchesSeat = (candidate, word, positions) =>
  positions.every((p) => candidate[p - 1] === word[p - 1]);

// { bankOdd, bankEven, dictOdd, dictEven, dictMin, asymmetry, trivialSeat }.
export function ambiguityFor(word, category, bankPool, dictByLength) {
  const seat = (parity, pool) => {
    const positions = visiblePositions(parity, word.length);
    return pool.filter((c) => c !== word && c.length === word.length && matchesSeat(c, word, positions)).length;
  };
  const bankWords = bankPool.filter((r) => r.category === category).map((r) => r.word);
  const bankOdd = seat("odd", bankWords);
  const bankEven = seat("even", bankWords);
  const dictOdd = dictByLength ? seat("odd", dictByLength.get(word.length) ?? []) : null;
  const dictEven = dictByLength ? seat("even", dictByLength.get(word.length) ?? []) : null;
  const dictMin = dictOdd == null ? null : Math.min(dictOdd, dictEven);
  return {
    bankOdd, bankEven, dictOdd, dictEven, dictMin,
    asymmetry: dictOdd == null ? Math.abs(bankOdd - bankEven) : Math.abs(dictOdd - dictEven),
    trivialSeat: dictOdd == null ? null : dictOdd <= 1 ? "odd" : dictEven <= 1 ? "even" : null,
  };
}

async function main() {
  const all = await reconstructAll();
  const { byLength: dict, source } = loadDictionary();
  const { ACTIVE_WORDS } = await import(resolve(wordsDir, "bank.js"));

  console.log(source
    ? `dictionary: ${source}`
    : "dictionary: NONE found — falling back to the bank's own vocabulary (counts are a floor).\n");

  const rows = ACTIVE_WORDS.filter((m) => !m.tutorial).map((meta) => {
    const plain = all.find((w) => w.id === meta.id).word;
    return { ...meta, word: plain, ...ambiguityFor(plain, meta.category, all, dict) };
  });

  console.log("tier len category   word         bank(o/e)  dict(o/e)  note");
  console.log("---- --- ---------- -----------  ---------  ---------  ----");
  for (const r of rows.sort((a, b) => a.tier - b.tier || (a.dictMin ?? a.bankOdd) - (b.dictMin ?? b.bankOdd))) {
    const note = r.trivialSeat ? `one-sided: the ${r.trivialSeat} seat can solo it`
      : r.dictMin != null && r.dictMin <= 3 ? "tight"
      : r.asymmetry >= 6 ? "lopsided" : "";
    console.log(
      `${String(r.tier).padEnd(4)} ${String(r.length).padEnd(3)} ${r.category.padEnd(10)} ${r.word.padEnd(11)}  `
      + `${String(r.bankOdd).padStart(3)}/${String(r.bankEven).padEnd(4)}  `
      + `${String(r.dictOdd ?? "-").padStart(3)}/${String(r.dictEven ?? "-").padEnd(4)}  ${note}`);
  }

  const trivial = rows.filter((r) => r.trivialSeat);
  console.log(`\n${rows.length} scored words · ${trivial.length} solvable by one seat alone`
    + (dict ? "" : " (dict unavailable — rerun with AMBIGUITY_WORDLIST for a real read)"));
  const byTier = {};
  for (const r of rows) {
    byTier[r.tier] ??= { n: 0, sum: 0, trivial: 0 };
    byTier[r.tier].n += 1;
    byTier[r.tier].sum += r.dictMin ?? r.bankOdd;
    if (r.trivialSeat) byTier[r.tier].trivial += 1;
  }
  console.log("\ntier  avg min candidates  one-sided");
  for (const [tier, s] of Object.entries(byTier)) {
    console.log(`${tier.padEnd(4)}  ${(s.sum / s.n).toFixed(1).padStart(18)}  ${s.trivial}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
