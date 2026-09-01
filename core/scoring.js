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
