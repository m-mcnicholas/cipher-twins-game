// Room/session layer.
//
// This site is a static Vite build deployed to GitHub Pages — there is no
// server process to hold room state or broker connections, so the "Socket.io
// room" from the original design doc is adapted to a serverless WebRTC room
// using PeerJS's free public cloud broker (id.peerjs.com) purely for the
// initial handshake. Once the two browsers are connected, gameplay traffic
// (board updates, submitted guesses, level advances) flows peer-to-peer and
// never touches a server we run.
//
// Confidentiality trade-off, stated plainly: a real backend could refuse to
// ever transmit Player A's letters to Player B's socket. A static site
// cannot enforce that the same way, because both players load the same
// public JS bundle. What this app does instead: the host is treated as
// Player A and the joiner as Player B, decided once at connection time, and
// each role's code path only ever fetches its own `words/wNNN.a.js` /
// `wNNN.b.js` chunk (see game.js) — so a normal play session's network
// tab never shows the partner's letters, and the shared `manifest.js` ships
// only a SHA-256 hash of each answer, never the plaintext word. A player who
// deliberately guesses the sibling file's URL could still fetch it — that is
// an inherent limit of hosting with no backend, not something the UI hides.

import Peer from "peerjs";

const ROOM_PREFIX = "cipher-twins-v1-";
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

// PeerJS's free cloud broker only hands out STUN servers by default, which is
// enough for a direct peer-to-peer path on an open network but fails outright
// ("negotiation ... failed") on networks that block outbound UDP or enforce a
// restrictive NAT — school and corporate Wi-Fi being the common case. The
// Open Relay Project (metered.ca) runs a free public TURN relay for exactly
// this; its TURN-over-TLS-443 entry gets through firewalls that only allow
// outbound HTTPS-shaped traffic, at the cost of routing gameplay through a
// third-party relay instead of a direct link.
const ICE_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443?transport=tcp",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ],
};

export function randomRoomCode(length = 5) {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

export class Room extends EventTarget {
  constructor() {
    super();
    this.peer = null;
    this.conn = null;
    this.role = null; // "A" (host) | "B" (joiner)
    this.code = null;
  }

  _emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  _wireConnection(conn) {
    this.conn = conn;
    conn.on("data", (message) => {
      if (message && typeof message.type === "string") {
        this._emit("message", message);
      }
    });
    conn.on("close", () => this._emit("peer-left", {}));
    conn.on("error", (err) => this._emit("error", { err }));
  }

  async host() {
    this.role = "A";
    this.code = randomRoomCode();
    this.peer = new Peer(ROOM_PREFIX + this.code, { config: ICE_CONFIG });

    await new Promise((resolve, reject) => {
      this.peer.once("open", resolve);
      this.peer.once("error", reject);
    });

    this.peer.on("connection", (conn) => {
      if (this.conn) {
        conn.close(); // room already has a partner; refuse extras
        return;
      }
      this._wireConnection(conn);
      conn.once("open", () => this._emit("connected", { role: this.role, code: this.code }));
    });

    this.peer.on("error", (err) => this._emit("error", { err }));
    return this.code;
  }

  async join(code) {
    this.role = "B";
    this.code = code.trim().toUpperCase();
    this.peer = new Peer({ config: ICE_CONFIG });

    await new Promise((resolve, reject) => {
      this.peer.once("open", resolve);
      this.peer.once("error", reject);
    });

    const conn = this.peer.connect(ROOM_PREFIX + this.code, { reliable: true });
    this._wireConnection(conn);

    await new Promise((resolve, reject) => {
      conn.once("open", resolve);
      conn.once("error", reject);
      setTimeout(() => reject(new Error("Room not found, offline, or the connection couldn't get through this network.")), 20000);
    });

    this.peer.on("error", (err) => this._emit("error", { err }));
    this._emit("connected", { role: this.role, code: this.code });
  }

  send(type, payload) {
    if (!this.conn || !this.conn.open) return;
    this.conn.send({ type, payload });
  }

  close() {
    this.conn?.close();
    this.peer?.destroy();
  }
}
