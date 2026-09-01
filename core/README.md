# Cipher Twins core (cooperative-language redesign — phase 1)

Backend-free, UI-free foundation for the redesign. The existing 10-level game in
`../game.js` still runs on the old `../protocol.js` / `../network.js` path and is
untouched apart from sharing `sha256.js`. Phase 2 builds the new interface on the
modules here and retires the old path.

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

## Not in this phase

New UI, message-card composer, combined conversation view, archived-transcript
drawer, responsive/a11y layer, curated word bank + metadata + bank validator,
tutorial (FISH/LAMP) and bot-demo scripts, delta (vs. full) snapshot sync, and
wiring `game.js` onto this reducer.
