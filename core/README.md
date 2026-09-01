# Cipher Twins core (cooperative-language redesign)

Backend-free foundation for the redesign. Phase 1 built the modules here; phase 2
built `../app.js` on top of them and retired the old `game.js` / `protocol.js`
board game.

| module | responsibility |
| --- | --- |
| `sha256.js` | Portable `sha256Hex` (platform digest, plain-HTTP-LAN fallback). Shared by the game and the commitment layer. |
| `commitments.js` | Salted SHA-256 guess commitments. `deriveSalt` → `commitmentFor` → `resolveCommitments` yields `solved` / `agreed-wrong` / `differ` / `pending` without ever transmitting a guess, a letter, or a diverging position. Concealment is casual — small candidate pool + shared salt — and the header comment says so. |
| `palette.js` | Monotonic unlock schedule (`TUTORIAL_PALETTE` → `paletteForPuzzle(i)` → `fullPalette()`), `isMonotonicUnlock` / `assertMonotonicSchedule` guards, and odd/even letter-ownership parity that flips every puzzle from a random seed. |
| `scoring.js` | Cooperative efficiency stars: 3 (first attempt, within both pars), 2 (≤2 attempts, ≤150% of both pars), 1 (any other solve). A sigil is one token. No failure state. |
| `messages.js` | Wire protocol. `validateOperation` (client→host) and `validateBroadcast` (host→client) return freshly-built, field-whitelisted objects or `null`. `containsForbiddenKey` is defence-in-depth against a plaintext guess or private letter reaching a shared payload. |
| `revision.js` | Versioned, host-authoritative shared state + the pure `reduce(revision, op, actor, context)`. Guarantees: version +1 per state-changing op, whole-card append order, author-only retraction, proposer + partner sigil approval, palette only grows, one attempt per resolved commitment pair, no secret ever stored (`snapshot()` throws otherwise). `prepareRecovery` clears a half-finished commitment round and asks both players to recommit. |
| `transport.js` | `LoopbackChannel` / `createLoopbackPair` — deterministic in-process two-endpoint transport with `flush()` / `deliverNext()` for controlled interleaving and `replaceConnection(role)` for disconnect/rejoin. No PeerJS broker. |
| `session.js` | `GameHost` (owns the canonical revision, validates + reduces + broadcasts) and `GameClient` (read-only mirror, sends operations upstream). Phase 2's UI attaches here. |

## Tests

`tests/cipher-twins-core.test.js` (run via `npm run test:logic`) covers protocol
schemas, role/authorship authorization, revision handling, atomic concurrent
sends, mutual sigil approval, monotonic unlocks, alternating ownership, scoring
thresholds, snapshot sanitisation, recovery, and full paired loopback flows
(tutorial skip, reply, sigil reuse, matching-wrong / mismatched / correct
guesses, retry, keep-lexicon rematch, disconnect/rejoin, unrecoverable host
loss). Every broadcast in the paired flows is asserted free of forbidden keys
and plaintext answers.

## Phase 2 (done)

`../app.js` + rewritten `../index.html` / `../styles.css`: message-card composer,
combined All/Mine/Partner conversation, archived-transcript drawer, sigil lexicon
(propose / approve / insert / expand), commitment guessing, reveal + stars,
keep-lexicon / fresh rematch, physical-keyboard letter entry, live-region
announcements, semantic hidden cells, Player A/B text beside colour. Curated bank
(`words/bank.js` + `bank-odd/even.js`, `scripts/build-cipher-bank.mjs`) with tier
/ category / familiarity / pars validation. Same-machine `local-bridge.js`
transport and `tests/cipher-twins.spec.js` two-page e2e.

## Still open (later phases)

Full WCAG audit and the deeper responsive drawer behaviour; session-storage
snapshot persistence + PeerJS reconnect/rejoin recovery UI; the scripted solo
bot demo; delta (vs. full) snapshot sync; and playtest-driven tuning of
`FAMILIARITY` and the scoring pars with ≥5 novice pairs.
