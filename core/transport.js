// A deterministic in-process transport that stands in for the PeerJS room in
// tests. Two endpoints ("A" = host, "B" = joiner) exchange `{ type, payload }`
// messages through a shared channel, with the same event surface the real
// `Room` exposes: `message`, `peer-left`, and `close()`.
//
// Delivery is explicit. In the default "manual" mode a `send` only queues a
// message; a test calls `flush()` (all of them, in FIFO order) or
// `deliverNext()` (one at a time) to control interleaving. "sync" mode delivers
// on send. Every message is structure-cloned as it crosses the channel, so a
// mutation after `send` cannot reach the peer — exactly like a real wire.

class LoopbackEndpoint extends EventTarget {
  constructor(channel, role) {
    super();
    this.channel = channel;
    this.role = role;
    this.open = true;
  }

  send(type, payload) {
    if (!this.open) return;
    this.channel._enqueue(this.role, { type, payload });
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this.channel._notifyClose(this.role);
  }
}

export class LoopbackChannel {
  constructor({ code = "LOCAL", mode = "manual" } = {}) {
    this.code = code;
    this.mode = mode;
    this.queue = [];
    this.delivered = [];
    this.endpoints = {
      A: new LoopbackEndpoint(this, "A"),
      B: new LoopbackEndpoint(this, "B"),
    };
  }

  get host() { return this.endpoints.A; }
  get joiner() { return this.endpoints.B; }

  _enqueue(from, message) {
    const to = from === "A" ? "B" : "A";
    this.queue.push({ from, to, message: structuredClone(message) });
    if (this.mode === "sync") this.flush();
  }

  _dispatch(entry) {
    this.delivered.push(entry);
    const target = this.endpoints[entry.to];
    if (target && target.open) {
      target.dispatchEvent(new CustomEvent("message", { detail: entry.message }));
    }
  }

  // Deliver every queued message in order. Messages queued *during* delivery
  // (e.g. the host answering an op) are delivered in the same drain.
  flush() {
    let count = 0;
    while (this.queue.length) {
      this._dispatch(this.queue.shift());
      count += 1;
      if (count > 10000) throw new Error("Loopback flush did not settle — probable message loop.");
    }
    return count;
  }

  deliverNext() {
    if (!this.queue.length) return null;
    const entry = this.queue.shift();
    this._dispatch(entry);
    return entry;
  }

  pending() {
    return this.queue.map((entry) => ({ from: entry.from, to: entry.to, type: entry.message.type }));
  }

  _notifyClose(role) {
    const peerRole = role === "A" ? "B" : "A";
    const peer = this.endpoints[peerRole];
    if (peer && peer.open) {
      peer.dispatchEvent(new CustomEvent("peer-left", { detail: { role } }));
    }
  }

  // Recovery: the disconnected role opens a fresh connection with the same room
  // code. The surviving endpoint gets a `peer-rejoined` event; the caller is
  // then expected to push a full snapshot to the returned endpoint.
  replaceConnection(role) {
    const fresh = new LoopbackEndpoint(this, role);
    this.endpoints[role] = fresh;
    const peerRole = role === "A" ? "B" : "A";
    const peer = this.endpoints[peerRole];
    if (peer && peer.open) {
      peer.dispatchEvent(new CustomEvent("peer-rejoined", { detail: { role } }));
    }
    return fresh;
  }
}

export function createLoopbackPair(options) {
  const channel = new LoopbackChannel(options);
  return { channel, host: channel.host, joiner: channel.joiner };
}
