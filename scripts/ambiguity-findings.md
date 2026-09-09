# Ambiguity analysis — findings (design review WP-6)

`npm run analyze:ambiguity` (against `/usr/share/dict/words`, 2026‑09) confirms
the review's hypothesis: **the campaign's difficulty curve is inverted.** It
tiers by word length, but longer words are *easier* to guess because half the
letters plus the (openly shown) category pin the answer.

## Per-tier read

| tier | length | avg. min candidates per seat | words one seat can solo (of 12) |
|-----:|-------:|-----------------------------:|--------------------------------:|
| 0 | 4 | 20.2 | 0 |
| 1 | 4 | 13.9 | 0 |
| 2 | 5 | 3.3 | 5 |
| 3 | 5 | 4.3 | 3 |
| 4 | 6 | 5.8 | 3 |
| 5 | 7 | 1.9 | 7 |
| 6 | 8 | 0.6 | 11 |

"min candidates per seat" = the smaller of the two seats' counts of English
words of the same length consistent with that seat's visible letters. A value
of ≤1 means that player can identify the word with **no communication at all**.

**29 of 84 scored words are solvable by one seat alone.** They cluster in the
tiers the campaign currently calls hardest (tiers 5–6). The genuinely open
puzzles — where both halves stay ambiguous and the pair *has* to build shared
meaning — are the short words in tiers 0–1.

Examples of one-sided words: MOUNTAIN, KEYBOARD, ELEPHANT, DOLPHIN, GIRAFFE,
BISCUIT, BROCCOLI (odd seat solos); AMAZED, SCRAMBLE, SPRINKLE (even seat solos).

## What this does and doesn't support

The analyzer's `dict` columns use an uncategorised English list, so they are an
**upper bound** on real ambiguity (the true game also fixes the category). The
`bank` columns — same length *and* category, drawn from the game's own ~320‑word
vocabulary — are almost all `0/0`: within the shipped vocabulary every word is
already uniquely pinned by half its letters. That's the documented casual‑
concealment tradeoff, not a difficulty signal.

So this is enough to say **the curve is backwards and ~1/3 of scored words break
the cooperative premise**, but not enough to *re-tier deterministically*. A real
re-tier needs:

1. a **committed** common‑word list (~2–5k entries) so `generate:cipher-bank`
   produces identical output on every machine and CI's `git diff --exit-code
   words/` stays meaningful;
2. per-seat candidate counts computed with the category constraint applied;
3. WP‑3 playtest data (≥5 novice pairs, **each parity treated as its own
   case**) to calibrate where the tier boundaries actually fall.

Until then `scripts/build-cipher-bank.mjs` stays length-tiered, with a pointer
to this file, and `analyze-ambiguity.mjs` is a standalone diagnostic.

## Immediate low-risk options (no playtest needed)

- Drop the most one-sided words (dict min = 0 for a seat) from the active bank
  into the reserve pool: MOUNTAIN, GIRAFFE, BROCCOLI, DOUGHNUT, ANXIOUS,
  BLOSSOM, BISCUIT, CLIMB, HYENA, AMAZED, … — they need no cooperation.
- Pull more 4‑letter words up the curve; they are the ones that stay genuinely
  ambiguous for both seats.
