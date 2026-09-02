# Cipher Twins

A 2-player cooperative word game. You and your partner each hold half of a
hidden word's letters. You can't say your letters — you invent a shared
language out of icons and saved sigils to get them across, then privately
enter a guess that's compared only as a scrambled fingerprint.

**Play it:** https://m-mcnicholas.github.io/cipher-twins-game/

Part of [Michael McNicholas' software-engineering portfolio](https://m-mcnicholas.github.io/m-mcnicholas-portfolio/).

## How it works

The site is a static Vite build with no backend:

- **Connections** use [PeerJS](https://peerjs.com/)'s free public broker for the
  initial WebRTC handshake, plus Google STUN and Metered's Open Relay TURN as
  fallbacks. Once connected, the conversation and guesses flow peer-to-peer.
- **Game logic** lives in `core/`: `session.js` (host/client state machines),
  `revision.js` (delta sync + recovery), `messages.js`, `commitments.js`
  (guess fingerprints), `palette.js`, `scoring.js`, `transport.js`.
- **Concealment** is casual, not secure: role-specific word slices and SHA-256
  guess commitments keep a normal session's network tab clean, but a determined
  partner inspecting public assets can work around it. See `network.js`.

## Develop

```sh
npm install
npm run dev            # local dev server
npm run test:logic     # node:test core + integration checks
npm run build          # static build into dist/
```

Append `?demo=1` to the URL for a solo bot-driven walkthrough of the loop.

### Two-device playtest on a LAN

```sh
npm run preview:lan    # build, then serve on 0.0.0.0 and print LAN URLs
npm run dev:lan        # same, but live dev server (no rebuild on edits)
```

Loading the page only needs the local network; connecting the two players still
needs outbound internet on both machines for the peer handshake.

### Word banks

Per-word source files live in `words/w###.a.js` / `words/w###.b.js`. After
editing any of them, regenerate the derived banks:

```sh
npm run generate:word-banks   # role-a.js / role-b.js
npm run generate:cipher-bank  # bank.js / bank-odd.js / bank-even.js
```

CI fails if anything under `words/` is out of date.

## Deployment

Every push to `main` runs `.github/workflows/deploy-pages.yml`: word-bank
freshness check, logic tests, build, and publish `dist/` to GitHub Pages.

## History

Extracted from the portfolio monorepo with `git subtree split`, so commit
history for these files is preserved. Broader Playwright end-to-end coverage
for the game still lives in the portfolio repo.
