// Wire protocol for the cooperative-language redesign.
//
// Two message directions:
//
//   operations  (client -> host)  — a request to change shared state. The host
//                                   is authoritative; it validates, feeds the
//                                   reducer, and rebroadcasts the result.
//   broadcasts  (host -> client)  — a new sanitized revision, a delta, or a
//                                   sync response. Never carries a plaintext
//                                   guess or a private letter.
//
// `validateOperation` / `validateBroadcast` return a freshly built, normalised
// object containing only known fields, or `null` for anything malformed,
// out-of-context, or sent by the wrong role. Per-revision ownership checks
// (author-only retraction, partner-only sigil confirmation) live in the reducer
// because they need the current revision, not just the message.

const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isRole = (value) => value === "A" || value === "B";
const isBool = (value) => value === true || value === false;

const ICON_ID = /^[a-z]+:[a-z0-9]+$/;
const SIGIL_ID = /^sigil-\d{1,4}$/;
const MESSAGE_ID = /^m-[A-Za-z0-9_-]{1,40}$/;
const CLIENT_ID = /^[AB]-[A-Za-z0-9_-]{1,60}$/;
const COMMITMENT = /^[0-9a-f]{64}$/;
const SESSION_ID = /^[A-Za-z0-9_-]{6,64}$/;

export const OPERATION_TYPES = Object.freeze([
  "message:send", "message:retract",
  "sigil:propose", "sigil:confirm", "sigil:reject",
  "guess:commit", "guess:retractCommit",
  "tutorial:skipVote",
  "level:advance", "level:retry", "session:rematch",
  "presence:update",
  "session:hello", "sync:request",
]);

export const BROADCAST_TYPES = Object.freeze([
  "revision:full", "revision:delta", "sync:full", "presence:sync", "recovery:recommit",
]);

const OPERATION_SET = new Set(OPERATION_TYPES);
const BROADCAST_SET = new Set(BROADCAST_TYPES);

// Operations that never mutate versioned state and so are always accepted from
// either role regardless of phase.
export const EPHEMERAL_OPERATIONS = new Set(["presence:update", "session:hello", "sync:request"]);

function normalizeTokens(tokens, context) {
  if (!Array.isArray(tokens) || tokens.length < 1 || tokens.length > 24) return null;
  const out = [];
  for (const token of tokens) {
    if (!isRecord(token) || typeof token.id !== "string") return null;
    if (token.kind === "icon") {
      if (!ICON_ID.test(token.id) || !context.unlockedPalette.has(token.id)) return null;
      out.push({ kind: "icon", id: token.id });
    } else if (token.kind === "sigil") {
      if (!SIGIL_ID.test(token.id) || !context.confirmedSigilIds.has(token.id)) return null;
      out.push({ kind: "sigil", id: token.id });
    } else {
      return null;
    }
  }
  return out;
}

// `context`:
//   localRole            "A" | "B" — the receiver's own role
//   unlockedPalette      Set<string> of currently legal icon ids
//   confirmedSigilIds    Set<string> of currently legal sigil ids
//   currentMessageIds    Set<string> of message ids in the live conversation
//   sessionId (optional) expected session id for hello/sync
export function validateOperation(message, context) {
  if (!isRecord(message) || !OPERATION_SET.has(message.type) || !isRecord(message.payload)) return null;
  const { type, payload } = message;
  const p = payload;

  switch (type) {
    case "message:send": {
      if (typeof p.clientId !== "string" || !CLIENT_ID.test(p.clientId)) return null;
      const tokens = normalizeTokens(p.tokens, context);
      if (!tokens) return null;
      let replyTo = null;
      if (p.replyTo != null) {
        if (typeof p.replyTo !== "string" || !MESSAGE_ID.test(p.replyTo) || !context.currentMessageIds.has(p.replyTo)) return null;
        replyTo = p.replyTo;
      }
      return { type, payload: { clientId: p.clientId, tokens, replyTo } };
    }
    case "message:retract": {
      if (typeof p.messageId !== "string" || !MESSAGE_ID.test(p.messageId)) return null;
      return { type, payload: { messageId: p.messageId } };
    }
    case "sigil:propose": {
      if (typeof p.clientId !== "string" || !CLIENT_ID.test(p.clientId)) return null;
      if (typeof p.sourceMessageId !== "string" || !MESSAGE_ID.test(p.sourceMessageId)) return null;
      return { type, payload: { clientId: p.clientId, sourceMessageId: p.sourceMessageId } };
    }
    case "sigil:confirm":
    case "sigil:reject": {
      if (typeof p.sigilId !== "string" || !SIGIL_ID.test(p.sigilId)) return null;
      return { type, payload: { sigilId: p.sigilId } };
    }
    case "guess:commit": {
      if (typeof p.commitment !== "string" || !COMMITMENT.test(p.commitment)) return null;
      return { type, payload: { commitment: p.commitment } };
    }
    case "guess:retractCommit":
    case "level:retry": {
      return { type, payload: {} };
    }
    case "tutorial:skipVote": {
      if (!isBool(p.vote)) return null;
      return { type, payload: { vote: p.vote } };
    }
    case "level:advance": {
      if (typeof p.fromPhase !== "string" || p.fromPhase.length > 16) return null;
      const fromIndex = Number.isInteger(p.fromIndex) ? p.fromIndex : null;
      return { type, payload: { fromPhase: p.fromPhase, fromIndex } };
    }
    case "session:rematch": {
      if (!isBool(p.keepLexicon)) return null;
      return { type, payload: { keepLexicon: p.keepLexicon } };
    }
    case "presence:update": {
      return { type, payload: { composing: p.composing === true, guessReady: p.guessReady === true } };
    }
    case "session:hello": {
      if (typeof p.sessionId !== "string" || !SESSION_ID.test(p.sessionId)) return null;
      if (!isRole(p.role)) return null;
      const lastVersion = Number.isInteger(p.lastVersion) && p.lastVersion >= 0 ? p.lastVersion : 0;
      return { type, payload: { sessionId: p.sessionId, role: p.role, lastVersion } };
    }
    case "sync:request": {
      const haveVersion = Number.isInteger(p.haveVersion) && p.haveVersion >= 0 ? p.haveVersion : 0;
      return { type, payload: { haveVersion } };
    }
    default:
      return null;
  }
}

export function validateBroadcast(message) {
  if (!isRecord(message) || !BROADCAST_SET.has(message.type) || !isRecord(message.payload)) return null;
  const { type, payload } = message;

  if (type === "revision:full" || type === "sync:full") {
    if (!isRecord(payload.revision) || !Number.isInteger(payload.revision.version)) return null;
    if ("commitments" in payload.revision) {
      const c = payload.revision.commitments;
      if (!isRecord(c) || !["A", "B"].every((r) => c[r] === null || (typeof c[r] === "string" && COMMITMENT.test(c[r])))) return null;
    }
    if (containsForbiddenKey(payload.revision)) return null;
    return { type, payload: { revision: payload.revision } };
  }
  if (type === "revision:delta") {
    if (!Number.isInteger(payload.fromVersion) || !Number.isInteger(payload.toVersion)) return null;
    if (!Array.isArray(payload.ops)) return null;
    if (containsForbiddenKey(payload.ops)) return null;
    return { type, payload: { fromVersion: payload.fromVersion, toVersion: payload.toVersion, ops: payload.ops } };
  }
  if (type === "presence:sync") {
    if (!isRecord(payload.presence)) return null;
    return { type, payload: { presence: payload.presence } };
  }
  if (type === "recovery:recommit") {
    return { type, payload: {} };
  }
  return null;
}

// Defence in depth: a shared payload must never carry a plaintext guess or a
// private letter under any key name. `answerHash` (a public digest) is allowed.
const FORBIDDEN_KEYS = new Set(["guess", "guesses", "plaintext", "letters", "letter", "answer", "answers", "roleData", "privateLetters", "myGuess", "partnerGuess"]);

export function containsForbiddenKey(value, depth = 0) {
  if (depth > 12 || value === null || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((entry) => containsForbiddenKey(entry, depth + 1));
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key)) return true;
    if (containsForbiddenKey(nested, depth + 1)) return true;
  }
  return false;
}
