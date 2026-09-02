// Serve Cipher Twins on every network interface so other computers on the
// same Wi-Fi/LAN can open it for a two-device playtest.
//
// Default: build the static site, then run `vite preview` bound to 0.0.0.0.
// With `--dev`: skip the build and run the live dev server instead, which is
// better while changing game code because edits reload without a rebuild.
//
// Either way the script prints the LAN URL for each detected address.
//
// Reachability note: loading the page only needs the LAN. Actually connecting
// the two players still needs outbound internet on both machines, because the
// WebRTC handshake uses the public PeerJS broker and STUN/TURN servers
// described in network.js.

import { build, createServer, preview } from "vite";

const useDevServer = process.argv.includes("--dev");

function report(server) {
  const roots = server.resolvedUrls?.network ?? [];
  const label = useDevServer ? "dev server" : "preview";

  console.log(`\n  Cipher Twins ${label} — open on any computer on this network:\n`);
  if (roots.length === 0) {
    console.log("  No LAN address found. Connect this machine to Wi-Fi or Ethernet,");
    console.log("  or check that a firewall or VPN is not hiding the local network.\n");
  } else {
    for (const root of roots) {
      console.log(`  ${root}`);
    }
    console.log("\n  Both players also need internet access for the peer handshake.");
    console.log("  Press Ctrl+C to stop.\n");
  }
}

async function stop(server) {
  try {
    await server.close();
  } finally {
    process.exit(0);
  }
}

let server;
if (useDevServer) {
  server = await createServer({ server: { host: true } });
  await server.listen();
} else {
  await build();
  server = await preview({ preview: { host: true } });
}

server.printUrls();
report(server);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => stop(server));
}
