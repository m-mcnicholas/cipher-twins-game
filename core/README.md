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

## Phase 3 (done)

- **Delta sync** — `syncResponse` replays a contiguous run of delta-safe ops
  (`DELTA_SAFE_OPS`: messages, sigils, presence) from a bounded host op-log;
  a round/phase change or a commit in the gap forces a full snapshot.
  `applyDelta` re-validates every op through `validateOperation` before the
  reducer, so a tampered delta can't smuggle a bad payload.
- **Recovery** — `../app.js` persists the host snapshot + both identities to
  `sessionStorage`; the lobby offers *Reconnect / Discard*. `network.js` lets a
  host reclaim its room id (`host(code)`) and accept a replacement connection
  for a dropped partner (`peer-rejoined`); the joiner auto-retries `join`. A
  `#recovery-panel` alertdialog offers *Retry / Return to lobby / Start a new
  room* when reconnection fails or the host is gone. `prepareRecovery` still
  clears half-finished commitments and asks both players to recommit.
- **Solo bot demo** — `core/bot-demo.js` (`?demo=1` from the lobby): a
  LoopbackChannel drives both sides through the whole loop with captions; the
  scored game stays two-player (`state.demo` disables local input).
- **A11y / responsive pass** — Escape closes drawers and restores focus, one
  drawer open at a time, message aria-names include the reply target, a
  non-colour glyph per player, coarse-pointer target sizes, and a sticky word
  track + composer bar with the conversation scrolling between them on narrow
  screens.

## Still open

Playtest-driven tuning of `FAMILIARITY` and the scoring pars with ≥5 novice
pairs (human-in-the-loop — see the plan's acceptance criteria).
