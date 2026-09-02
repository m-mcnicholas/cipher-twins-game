// Same-browser transport: pairs two tabs/windows on one machine through a
// BroadcastChannel instead of the PeerJS broker. Exposes the same surface as
// the PeerJS `Room` (send / "message" / "peer-left" / "connected"), so
// GameHost / GameClient use it unchanged.
//
// Used for local two-device-on-one-machine playtests and for deterministic
// two-page end-to-end tests that must not depend on a public relay. Opt in with
// `?local=<ROOMCODE>&as=host|join` on the game URL.

export class LocalBridgeRoom extends EventTarget {
  constructor(code, role) {
    super();
    this.code = code.toUpperCase();
    this.role = role; // "A" (host) | "B" (joiner)
    this.channel = new BroadcastChannel(`cipher-twins-local-${this.code}`);
    this._peerSeen = false;
    this.channel.addEventListener("message", (event) => this._onWire(event.data));
  }

  async connect() {
    // Either tab may load first, and a BroadcastChannel does not replay
    // messages sent before a listener existed. So re-announce on an interval
    // until the other side has answered, rather than relying on a single hello.
    const ready = new Promise((resolve, reject) => {
      this._resolveReady = resolve;
      this._rejectReady = reject;
    });
    this._helloTimer = setInterval(() => {
      if (this._peerSeen) { clearInterval(this._helloTimer); return; }
      this.channel.postMessage({ __bridge: "hello", from: this.role });
    }, 200);
    this._giveUp = setTimeout(() => {
      clearInterval(this._helloTimer);
      if (!this._peerSeen) this._rejectReady(new Error("No partner on this machine joined that local room."));
    }, 20000);
    this.channel.postMessage({ __bridge: "hello", from: this.role });
    return ready;
  }

  _onWire(data) {
    if (!data || typeof data !== "object") return;
    if (data.__bridge === "hello") {
      if (data.from === this.role) return;
      // Reply so a late arrival also learns we are here.
      this.channel.postMessage({ __bridge: "ack", from: this.role });
      if (this._peerSeen) {
        // The partner's tab reloaded and came back on the same channel.
        this.dispatchEvent(new CustomEvent("peer-rejoined", { detail: { role: data.from } }));
      } else {
        this._markConnected();
      }
      return;
    }
    if (data.__bridge === "ack") {
      if (data.from === this.role) return;
      this._markConnected();
      return;
    }
    if (data.__bridge === "bye") {
      if (data.from === this.role) return;
      this.dispatchEvent(new CustomEvent("peer-left", { detail: {} }));
      return;
    }
    if (data.to && data.to !== this.role) return;
    if (data.type) this.dispatchEvent(new CustomEvent("message", { detail: { type: data.type, payload: data.payload } }));
  }

  _markConnected() {
    if (this._peerSeen) return;
    this._peerSeen = true;
    clearInterval(this._helloTimer);
    clearTimeout(this._giveUp);
    this._resolveReady?.();
    this.dispatchEvent(new CustomEvent("connected", { detail: { role: this.role, code: this.code } }));
  }

  send(type, payload) {
    this.channel.postMessage({ type, payload, from: this.role, to: this.role === "A" ? "B" : "A" });
  }

  close() {
    this.channel.postMessage({ __bridge: "bye", from: this.role });
    this.channel.close();
  }
}
