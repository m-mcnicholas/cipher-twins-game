# Cipher Twins

A 2-player asymmetric co-op word puzzle. Each player sees a different,
incomplete slice of a hidden word's letters and must reconstruct it with a
partner using only a shared icon palette — no typing, no spelling, no numbers.

**Play it:** https://m-mcnicholas.github.io/cipher-twins-game/

Part of [Michael McNicholas' software-engineering portfolio](https://m-mcnicholas.github.io/m-mcnicholas-portfolio/).

## How it works

Ten rounds draw from a generated 321-word bank, with each word split by letter
position parity so neither player holds every letter. The site is a static Vite
build with no backend:

- **Connections** use [PeerJS](https://peerjs.com/)'s free public broker for the
  initial WebRTC handshake, plus Google STUN and Metered's Open Relay TURN as
  fallbacks. Once connected, board updates and guesses flow peer-to-peer.
- **Puzzle concealment** is casual, not secure: role-specific `role-a.js` /
  `role-b.js` banks and SHA-256 answer hashes keep a normal play session's
  network tab clean, but a determined player inspecting public assets can read
  the other role's letters. See `network.js` for the full trade-off note.

## Develop

```sh
npm install
npm run dev            # local dev server
npm run test:logic     # node:test protocol / word-bank checks
npm run build          # static build into dist/
```

### Two-device playtest on a LAN

```sh
npm run preview:lan    # build, then serve on 0.0.0.0 and print LAN URLs
npm run dev:lan        # same, but live dev server (no rebuild on edits)
```

Loading the page only needs the local network; connecting the two players still
needs outbound internet on both machines for the peer handshake.

### Word banks

Per-word source files live in `words/w###.a.js` and `words/w###.b.js`. After
editing any of them, regenerate the consolidated role banks:

```sh
npm run generate:word-banks
```

CI fails if `words/role-a.js` / `words/role-b.js` are out of date.

## Deployment

Every push to `main` triggers `.github/workflows/deploy-pages.yml`: it runs the
logic tests, builds, and publishes `dist/` to GitHub Pages.
