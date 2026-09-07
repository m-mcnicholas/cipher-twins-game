// Cooperative stars. There is no failure state and no hard limit — stars only
// reward *how* a pair solved a puzzle, and the thing being rewarded is the
// fantasy: reaching a shared understanding and leaning on the language you
// built together. Raw brevity is a secondary, displayed-only stat, never the
// thing that wins a star (the old rubric effectively said "invent a language,
// then use it as little as possible").
//
//   3 stars — solved on the first attempt with a mutual first-try agreement,
//             AND either the pair reused a saved sigil this round, or no shared
//             language exists yet and they stayed within par (early-puzzle
//             fallback).
//   2 stars — solved in at most two attempts (an "agreed but wrong" or a
//             mismatch, then a fix), OR a first-try solve that met neither the
//             language nor the par condition.
//   1 star  — solved any other way.
//
// A saved sigil counts as ONE transmitted token no matter how many icons it
// expands to (`expandedTokenCount` gives the icon-weight where that's wanted).
//
// THRESHOLDS ARE PROVISIONAL. They were set without playtest data; the plan's
// WP-3 (≥5 novice pairs) is meant to tune EARLY_PAR_SLACK and the reuse
// condition from observed behaviour.

export const TWO_STAR_PAR_MULTIPLIER = 1.5;
// A first solve with no shared language yet still earns 3 stars if the pair
// stayed within this multiple of par. Loose on purpose — par itself is a guess.
export const EARLY_PAR_SLACK = 1.25;

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

// `input`:
//   attempts        resolved attempts so far (>= 1 on a solve)
//   tokens          raw tokens sent this round (ledger `tokensRaw`)
//   messages        cards sent this round (ledger `messagesSent`)
//   parTokens/parMessages   provisional pars, or null/Infinity when unknown
//   firstTryAgree   both players' first resolved attempt was a match (any word)
//   sigilReuses     confirmed-sigil tokens dropped into cards this round
//   confirmedSigils number of saved sigils that exist (0 => no language yet)
//   byAuthor        { A, B } card counts — used for the displayed balance stat only
export function computeStars(input = {}) {
  const {
    attempts = 1,
    tokens = 0,
    messages = 0,
    parTokens = Infinity,
    parMessages = Infinity,
    firstTryAgree = false,
    sigilReuses = 0,
    confirmedSigils = 0,
    byAuthor = null,
  } = input;

  const parKnown = Number.isFinite(parTokens) && Number.isFinite(parMessages);
  const withinPar = parKnown ? tokens <= parTokens && messages <= parMessages : true;
  const withinEarlySlack = parKnown
    ? tokens <= parTokens * EARLY_PAR_SLACK && messages <= parMessages * EARLY_PAR_SLACK
    : true;

  const firstTry = attempts <= 1 && firstTryAgree === true;
  const leanedOnLanguage = sigilReuses >= 1;
  const noLanguageYet = confirmedSigils === 0;

  let stars;
  if (firstTry && (leanedOnLanguage || (noLanguageYet && withinEarlySlack))) stars = 3;
  else if (attempts <= 2 || firstTry) stars = 2;
  else stars = 1;

  const balance = byAuthor && (byAuthor.A + byAuthor.B) > 0
    ? Math.min(byAuthor.A, byAuthor.B) / (byAuthor.A + byAuthor.B) // 0.5 is perfectly even
    : null;

  return {
    stars,
    breakdown: {
      attempts, tokens, messages, parTokens, parMessages,
      firstTryAgree: firstTryAgree === true,
      sigilReuses, leanedOnLanguage, noLanguageYet,
      withinPar,
      tokenEfficiency: parKnown && parTokens > 0 ? tokens / parTokens : null,
      balance,
    },
  };
}

// Convenience for tests: score straight from a finished puzzle's transcript,
// deriving the ledger-style counts from the message array.
export function scorePuzzle({ attempts, messages, parTokens, parMessages, firstTryAgree, sigilReuses, confirmedSigils }) {
  return computeStars({
    attempts,
    tokens: countTokens(messages),
    messages: countMessages(messages),
    parTokens,
    parMessages,
    firstTryAgree,
    sigilReuses,
    confirmedSigils,
  });
}
