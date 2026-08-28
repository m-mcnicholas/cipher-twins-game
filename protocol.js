const MESSAGE_TYPES = new Set(["board:op", "board:state", "guess:submit", "level:advance", "level:retry", "request:advance", "request:retry"]);
const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isIndex = (value, levelCount) => Number.isInteger(value) && value >= 0 && value <= levelCount;
const hasLevel = (payload, context) => payload.levelIndex === context.levelIndex && payload.wordId === context.wordId;

export function validateIncomingMessage(message, context) {
  if (!isRecord(message) || !MESSAGE_TYPES.has(message.type) || !isRecord(message.payload)) return null;
  const { type, payload } = message;
  const hostOnly = new Set(["level:advance", "board:state", "level:retry"]);
  const joinerOnly = new Set(["board:op", "request:advance", "request:retry"]);
  if (hostOnly.has(type) && context.localRole !== "B") return null;
  if (joinerOnly.has(type) && context.localRole !== "A") return null;

  if (type === "level:advance") {
    if (!isIndex(payload.index, context.levelCount)) return null;
    if (payload.index === context.levelCount) return payload.wordId === null ? { type, payload: { index: payload.index, wordId: null } } : null;
    if (typeof payload.wordId !== "string" || !context.wordIds.has(payload.wordId)) return null;
    return { type, payload: { index: payload.index, wordId: payload.wordId } };
  }
  if (type === "request:advance") return isIndex(payload.index, context.levelCount) ? { type, payload: { index: payload.index } } : null;
  if (type === "guess:submit") {
    if (!hasLevel(payload, context) || typeof payload.guess !== "string" || !/^[A-Z]+$/.test(payload.guess) || payload.guess.length !== context.wordLength) return null;
    return { type, payload: { levelIndex: payload.levelIndex, wordId: payload.wordId, guess: payload.guess } };
  }
  if (type === "level:retry" || type === "request:retry") {
    return hasLevel(payload, context) ? { type, payload: { levelIndex: payload.levelIndex, wordId: payload.wordId } } : null;
  }
  if (type === "board:op") {
    if (!hasLevel(payload, context) || !isRecord(payload.operation)) return null;
    const operation = payload.operation;
    if (typeof operation.id !== "string" || !/^B-[A-Za-z0-9_-]{1,80}$/.test(operation.id)) return null;
    if (!["add", "undo", "clear"].includes(operation.kind)) return null;
    if (operation.kind === "add" && (typeof operation.iconId !== "string" || !context.allowedIconIds.has(operation.iconId))) return null;
    return { type, payload: { levelIndex: payload.levelIndex, wordId: payload.wordId, operation: { id: operation.id, kind: operation.kind, ...(operation.kind === "add" ? { iconId: operation.iconId } : {}) } } };
  }
  if (type === "board:state") {
    if (!hasLevel(payload, context) || !Number.isSafeInteger(payload.revision) || payload.revision < 0 || !Array.isArray(payload.icons) || payload.icons.length > context.maxBoardIcons) return null;
    const icons = [];
    for (const entry of payload.icons) {
      if (!isRecord(entry) || typeof entry.id !== "string" || !/^[A-Z]-[A-Za-z0-9_-]{1,80}$/.test(entry.id)) return null;
      if (!context.allowedIconIds.has(entry.iconId) || !["A", "B"].includes(entry.by)) return null;
      icons.push({ id: entry.id, iconId: entry.iconId, by: entry.by });
    }
    return { type, payload: { levelIndex: payload.levelIndex, wordId: payload.wordId, revision: payload.revision, icons } };
  }
  return null;
}

export function applyBoardOperation(board, operation, by, maxBoardIcons) {
  if (operation.kind === "add") return board.length >= maxBoardIcons ? board : [...board, { id: operation.id, iconId: operation.iconId, by }];
  if (operation.kind === "undo") return board.slice(0, -1);
  if (operation.kind === "clear") return [];
  return board;
}

export function canHostAdvance(currentIndex, targetIndex, levelCount) {
  return Number.isInteger(targetIndex) && targetIndex === currentIndex + 1 && targetIndex <= levelCount;
}
