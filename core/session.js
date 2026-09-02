// Thin orchestration that binds a transport endpoint to the reducer.
//
//   GameHost   owns the canonical revision. It validates every operation
//              (its own and the joiner's), runs `reduce`, and broadcasts a
//              sanitized snapshot whenever the version moves.
//   GameClient (the joiner) holds a read-only mirror it refreshes from
//              broadcasts, and sends operations upstream.
//
// No UI here — Phase 2 builds the interface on top of these two objects. The
// loopback transport plus these classes are enough to drive full two-player
// flows in tests.

import {
  createInitialRevision, operationContext, reduce, snapshot, fromSnapshot,
  prepareRecovery, syncResponse, applyDelta,
} from "./revision.js";
import { validateOperation, validateBroadcast } from "./messages.js";

const OP_LOG_CAP = 128;

export class GameHost extends EventTarget {
  /**
   * @param endpoint     loopback/real transport endpoint for role "A"
   * @param options.revision      starting revision (defaults to a fresh lobby)
   * @param options.nextWord      ({ puzzleIndex, runNumber }) => { wordId, wordLength, category }
   * @param options.pars          (puzzleIndex) => { parTokens, parMessages }
   * @param options.newId         () => string message id (injectable for determinism)
   * @param options.now           () => epoch ms (injectable for determinism)
   */
  constructor(endpoint, options = {}) {
    super();
    this.endpoint = endpoint;
    this.revision = options.revision ?? createInitialRevision(options.initial ?? {});
    this.nextWord = options.nextWord ?? (() => null);
    this.pars = options.pars ?? (() => ({ parTokens: Infinity, parMessages: Infinity }));
    this.newId = options.newId ?? undefined;
    this.now = options.now ?? undefined;
    // Set by the host's own UI (or a test) to its current local correctness.
    // Consulted only when both commitments have arrived and they agree.
    this.localGuessCorrect = false;

    // Recent state-changing ops, newest last, for delta sync after a brief drop.
    this.opLog = [];

    this._onMessage = (event) => this._handleFromJoiner(event.detail);
    endpoint.addEventListener("message", this._onMessage);
  }

  _context() {
    return {
      newId: this.newId,
      now: this.now ? this.now() : undefined,
      nextWord: this.nextWord,
      pars: this.pars(this.revision.puzzleIndex),
      localGuessCorrect: this.localGuessCorrect,
    };
  }

  _apply(op, actor) {
    const result = reduce(this.revision, op, actor, this._context());
    if (!result.ok) {
      this.dispatchEvent(new CustomEvent("rejected", { detail: { op, actor, error: result.error } }));
      return result;
    }
    const changed = result.revision.version !== this.revision.version;
    this.revision = result.revision;
    if (changed && !result.ephemeral) {
      this.opLog.push({ version: this.revision.version, type: op.type, payload: op.payload, actor });
      if (this.opLog.length > OP_LOG_CAP) this.opLog.splice(0, this.opLog.length - OP_LOG_CAP);
    }
    for (const effect of result.effects) {
      this.dispatchEvent(new CustomEvent("effect", { detail: { ...effect, actor } }));
    }
    if (changed && !result.ephemeral) this._broadcast();
    return result;
  }

  _broadcast() {
    this.endpoint.send("revision:full", { revision: snapshot(this.revision) });
    this.dispatchEvent(new CustomEvent("revision", { detail: { version: this.revision.version } }));
  }

  _handleFromJoiner(raw) {
    if (raw && (raw.type === "sync:request" || raw.type === "session:hello")) {
      const have = raw.payload?.haveVersion ?? raw.payload?.lastVersion ?? 0;
      const response = syncResponse(this.revision, have, this.opLog);
      if (response.mode === "full") {
        this.endpoint.send("sync:full", { revision: response.revision });
      } else if (response.mode === "delta") {
        this.endpoint.send("revision:delta", {
          fromVersion: response.fromVersion, toVersion: response.toVersion, ops: response.ops,
        });
      }
      return;
    }
    const op = validateOperation(raw, operationContext(this.revision, "B"));
    if (!op) {
      this.dispatchEvent(new CustomEvent("rejected", { detail: { raw, actor: "B", error: "failed validation" } }));
      return;
    }
    this._apply(op, "B");
  }

  // The host's own player action. `raw` is a `{ type, payload }` operation.
  dispatchLocal(raw) {
    const op = validateOperation(raw, operationContext(this.revision, "A"));
    if (!op) return { ok: false, error: "failed validation", revision: this.revision, effects: [] };
    return this._apply(op, "A");
  }

  // The peer (joiner) reconnected. The host keeps its own transport endpoint;
  // it just drops any half-finished commitment round and pushes a full snapshot
  // to whoever is now on the other end.
  recoverPeer() {
    const { revision, recommitRequired } = prepareRecovery(this.revision);
    this.revision = revision;
    this._broadcast();
    if (recommitRequired) this.endpoint.send("recovery:recommit", {});
    return { recommitRequired };
  }

  // The host's *own* connection object was replaced (host-side reconnect).
  rebind(endpoint) {
    this.endpoint.removeEventListener("message", this._onMessage);
    this.endpoint = endpoint;
    endpoint.addEventListener("message", this._onMessage);
    return this.recoverPeer();
  }

  destroy() {
    this.endpoint.removeEventListener("message", this._onMessage);
  }
}

export class GameClient extends EventTarget {
  constructor(endpoint, { role = "B" } = {}) {
    super();
    this.endpoint = endpoint;
    this.role = role;
    this.revision = null;
    this.recommitRequired = false;
    this._onMessage = (event) => this._handleBroadcast(event.detail);
    endpoint.addEventListener("message", this._onMessage);
  }

  _handleBroadcast(raw) {
    if (raw && raw.type === "recovery:recommit") {
      this.recommitRequired = true;
      this.dispatchEvent(new CustomEvent("recommit-required"));
      return;
    }
    const broadcast = validateBroadcast(raw);
    if (!broadcast) return;
    if (broadcast.type === "revision:full" || broadcast.type === "sync:full") {
      const incoming = broadcast.payload.revision;
      if (this.revision && incoming.version < this.revision.version) return; // stale
      this.revision = fromSnapshot(incoming);
      this.recommitRequired = false;
      this.dispatchEvent(new CustomEvent("revision", { detail: { version: incoming.version } }));
      return;
    }
    if (broadcast.type === "revision:delta") {
      const { fromVersion, toVersion, ops } = broadcast.payload;
      if (!this.revision || this.revision.version !== fromVersion) {
        // We are not exactly where this delta starts — ask for a full snapshot.
        this.requestSync();
        return;
      }
      const validate = (candidate, actor) =>
        validateOperation(candidate, operationContext(this.revision, actor));
      const result = applyDelta(this.revision, ops, validate);
      if (!result.ok || result.revision.version !== toVersion) {
        this.requestSync();
        return;
      }
      this.revision = result.revision;
      this.dispatchEvent(new CustomEvent("revision", { detail: { version: toVersion } }));
    }
  }

  send(type, payload = {}) {
    this.endpoint.send(type, payload);
  }

  hello(sessionId, lastVersion = 0) {
    this.endpoint.send("session:hello", { sessionId, role: this.role, lastVersion });
  }

  requestSync() {
    this.endpoint.send("sync:request", { haveVersion: this.revision?.version ?? 0 });
  }

  rebind(endpoint) {
    this.endpoint.removeEventListener("message", this._onMessage);
    this.endpoint = endpoint;
    endpoint.addEventListener("message", this._onMessage);
  }

  destroy() {
    this.endpoint.removeEventListener("message", this._onMessage);
  }
}
