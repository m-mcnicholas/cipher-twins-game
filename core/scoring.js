// Cooperative efficiency stars. There is no failure state and no hard limit —
// stars only reward a pair that solved a puzzle economically. A pair that
// talked a great deal and guessed several times still finishes with one
// celebratory star.
//
//   3 stars — solved on the first resolved attempt, at or below both pars
//   2 stars — no more than two attempts, and within 150% of both pars
//   1 star  — solved, any other way
//
// A saved sigil counts as a single transmitted token no matter how many icons
// it expands to, so building shared language is never penalised.

export const TWO_STAR_PAR_MULTIPLIER = 1.5;

export function tokensInMessage(message) {
  return Array.isArray(message?.tokens) ? message.tokens.length : 0;
}

// Icon-equivalent weight of a token list: an icon is 1, a saved sigil is the
// weight of what it expands to (recursively, guarded). Nested sigils are
// rejected at proposal time, so in practice this is one level deep; the
// recursion is defence in depth. `confirmedSigils` is the revision's
// `sigils.confirmed` array (or a Map keyed by sigil id).
export function expandedTokenCount(tokens, confirmedSigils = [], depth = 0) {
  if (!Array.isArray(tokens) || depth > 8) return 0;
  const byId = confirmedSigils instanceof Map
    ? confirmedSigils
    : new Map((confirmedSigils || []).map((s) => [s.id, s]));
  let total = 0;
  for (const token of tokens) {
    if (token?.kind === "sigil") {
      const sigil = byId.get(token.id);
      total += sigil ? expandedTokenCount(sigil.tokens, byId, depth + 1) : 1;
    } else {
      total += 1;
    }
  }
  return total;
}

export function countTokens(messages = []) {
  return messages.reduce((total, message) => total + tokensInMessage(message), 0);
}

export function countMessages(messages = []) {
  return Array.isArray(messages) ? messages.length : 0;
}

export function computeStars({ attempts, tokens, messages, parTokens, parMessages }) {
  const withinPar = tokens <= parTokens && messages <= parMessages;
  const withinStretch =
    tokens <= parTokens * TWO_STAR_PAR_MULTIPLIER &&
    messages <= parMessages * TWO_STAR_PAR_MULTIPLIER;

  let stars;
  if (attempts <= 1 && withinPar) stars = 3;
  else if (attempts <= 2 && withinStretch) stars = 2;
  else stars = 1;

  return {
    stars,
    breakdown: { attempts, tokens, messages, parTokens, parMessages, withinPar, withinStretch },
  };
}

// Convenience: score straight from a finished puzzle's transcript.
export function scorePuzzle({ attempts, messages, parTokens, parMessages }) {
  return computeStars({
    attempts,
    tokens: countTokens(messages),
    messages: countMessages(messages),
    parTokens,
    parMessages,
  });
}
