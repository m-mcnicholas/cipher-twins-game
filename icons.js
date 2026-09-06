// The fixed, shared communication palette. Every icon here describes shape,
// position, count, comparison, letter form, or a meta signal — nothing in this
// set can spell a letter or a number directly, which is the whole point:
// players can only point at *properties* of their glyphs, never the glyphs
// themselves. Placing icons in a row on the shared board is the entire
// vocabulary; the app never tries to parse what a sequence "means" — that
// inference is the players' job.
//
// The "Letter form" group replaced an earlier "Category" group: the word's
// category is shown openly every round (index.html #fact-category), so
// category icons only ever restated what both players already knew. Letter-form
// icons instead give the pair more vocabulary for the thing they actually have
// to communicate — the shape of a hidden letter.

function svg(inner) {
  return `<svg viewBox="0 0 24 24" width="100%" height="100%" role="img" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}

function tally(n) {
  let marks = "";
  for (let i = 0; i < n; i++) {
    const x = 5 + i * 3.6;
    marks += `<line x1="${x}" y1="5" x2="${x}" y2="19" />`;
  }
  if (n >= 5) {
    marks += `<line x1="3" y1="17" x2="19" y2="7" stroke-width="1.5" />`;
  }
  return svg(marks);
}

export const ICONS = {
  // shape
  "shape:line": { label: "Straight line", group: "Shape", render: () => svg('<line x1="4" y1="18" x2="20" y2="6" />') },
  "shape:curve": { label: "Curve", group: "Shape", render: () => svg('<path d="M4 18 Q12 2 20 18" />') },
  "shape:loop": { label: "Loop", group: "Shape", render: () => svg('<circle cx="12" cy="12" r="7.5" />') },
  "shape:cross": { label: "Cross", group: "Shape", render: () => svg('<line x1="5" y1="5" x2="19" y2="19" /><line x1="19" y1="5" x2="5" y2="19" />') },
  "shape:dot": { label: "Dot", group: "Shape", render: () => svg('<circle cx="12" cy="12" r="3.2" fill="currentColor" />') },
  "shape:symmetric": { label: "Symmetric", group: "Shape", render: () => svg('<path d="M12 3v18" stroke-dasharray="2 2" /><path d="M6 6 L12 12 L6 18" /><path d="M18 6 L12 12 L18 18" />') },
  "shape:asymmetric": { label: "Asymmetric", group: "Shape", render: () => svg('<path d="M5 18 L11 5 L19 19" />') },

  // position
  "pos:first": { label: "First", group: "Position", render: () => svg('<rect x="4" y="5" width="4" height="14" fill="currentColor" stroke="none" /><rect x="10" y="5" width="10" height="14" rx="1" />') },
  "pos:last": { label: "Last", group: "Position", render: () => svg('<rect x="4" y="5" width="10" height="14" rx="1" /><rect x="16" y="5" width="4" height="14" fill="currentColor" stroke="none" />') },
  "pos:before": { label: "Before X", group: "Position", render: () => svg('<path d="M13 5 L6 12 L13 19" /><line x1="16" y1="5" x2="16" y2="19" stroke-dasharray="2 2" />') },
  "pos:after": { label: "After X", group: "Position", render: () => svg('<path d="M11 5 L18 12 L11 19" /><line x1="8" y1="5" x2="8" y2="19" stroke-dasharray="2 2" />') },
  "pos:between": { label: "Between", group: "Position", render: () => svg('<line x1="5" y1="5" x2="5" y2="19" /><line x1="19" y1="5" x2="19" y2="19" /><path d="M9 12 h6" /><path d="M12 9 v6" />') },

  // count
  "count:1": { label: "Count 1", group: "Count", render: () => tally(1) },
  "count:2": { label: "Count 2", group: "Count", render: () => tally(2) },
  "count:3": { label: "Count 3", group: "Count", render: () => tally(3) },
  "count:4": { label: "Count 4", group: "Count", render: () => tally(4) },
  "count:5": { label: "Count 5", group: "Count", render: () => tally(5) },

  // comparison
  "cmp:same": { label: "Same as", group: "Comparison", render: () => svg('<line x1="4" y1="9" x2="20" y2="9" /><line x1="4" y1="15" x2="20" y2="15" />') },
  "cmp:diff": { label: "Different from", group: "Comparison", render: () => svg('<line x1="4" y1="9" x2="20" y2="9" /><line x1="4" y1="15" x2="20" y2="15" /><line x1="9" y1="4" x2="15" y2="20" />') },
  "cmp:bigger": { label: "Bigger", group: "Comparison", render: () => svg('<path d="M4 17 L20 7" /><path d="M13 7 h7 v10" />') },
  "cmp:smaller": { label: "Smaller", group: "Comparison", render: () => svg('<path d="M4 7 L20 17" /><path d="M4 7 v10 h7" />') },

  // letter form — properties of the hidden glyph itself
  "form:enclosed": { label: "Has an enclosed space", group: "Letter form", render: () => svg('<path d="M9 3 C3 3 3 21 9 21 C17 21 17 3 9 3 Z" /><circle cx="10.5" cy="12" r="2.2" fill="currentColor" stroke="none" />') },
  "form:open": { label: "No enclosed space", group: "Letter form", render: () => svg('<path d="M19 6 A8 8 0 1 0 19 18" />') },
  "form:upright": { label: "Mostly upright strokes", group: "Letter form", render: () => svg('<line x1="8" y1="4" x2="8" y2="20" /><line x1="12" y1="4" x2="12" y2="20" /><line x1="16" y1="4" x2="16" y2="20" />') },
  "form:wide": { label: "Mostly level strokes", group: "Letter form", render: () => svg('<line x1="4" y1="8" x2="20" y2="8" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="16" x2="20" y2="16" />') },
  "form:vowel": { label: "Is a vowel", group: "Letter form", render: () => svg('<ellipse cx="12" cy="12" rx="8.5" ry="5.5" /><ellipse cx="12" cy="12" rx="3" ry="2" fill="currentColor" stroke="none" />') },
  "form:echo": { label: "Looks like the letter before it", group: "Letter form", render: () => svg('<path d="M7.5 8.5 A6 6 0 1 1 6 14" /><path d="M4 10.5 L6 14.5 L10 12.5" fill="currentColor" stroke="none" />') },

  // meta
  "meta:next": { label: "Next letter", group: "Meta", render: () => svg('<line x1="12" y1="3" x2="12" y2="21" stroke-dasharray="3 3" /><path d="M8 7 L12 3 L16 7" /><path d="M8 17 L12 21 L16 17" />') },
  "meta:confirm": { label: "Confirm", group: "Meta", render: () => svg('<path d="M4 12 L10 18 L20 6" />') },
  "meta:reject": { label: "Reject", group: "Meta", render: () => svg('<circle cx="12" cy="12" r="8" /><line x1="6.3" y1="17.7" x2="17.7" y2="6.3" />') },
  "meta:question": { label: "Question", group: "Meta", render: () => svg('<path d="M8 8 a4 4 0 1 1 6 3.5 c-1.5 1-2 2-2 3.5" /><circle cx="12" cy="19" r="0.8" fill="currentColor" />') },
};

export const ICON_GROUPS = ["Shape", "Position", "Count", "Comparison", "Letter form", "Meta"];

export function renderIcon(id) {
  const icon = ICONS[id];
  if (!icon) throw new Error(`Unknown icon: ${id}`);
  return icon.render();
}

// Abstract marks a saved sigil can wear (chosen by core/sigil-identity.js from
// the icons it stands for). Deliberately non-alphabetic — they name a shared
// idea without spelling anything. Keep the count in sync with
// SIGIL_GLYPH_COUNT in core/sigil-identity.js.
const SIGIL_GLYPHS = [
  '<circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />',
  '<path d="M12 3 L21 20 L3 20 Z" />',
  '<path d="M4 12 h16 M12 4 v16" /><circle cx="12" cy="12" r="6" />',
  '<path d="M6 6 L18 18 M18 6 L6 18" /><rect x="7" y="7" width="10" height="10" rx="2" />',
  '<path d="M12 3 L15 9 L21 12 L15 15 L12 21 L9 15 L3 12 L9 9 Z" />',
  '<path d="M5 19 Q12 3 19 19" /><line x1="5" y1="19" x2="19" y2="19" />',
  '<circle cx="8" cy="12" r="4.5" /><circle cx="16" cy="12" r="4.5" />',
  '<path d="M12 3 v18 M6 7 h12 M6 17 h12" />',
  '<path d="M4 15 Q12 -2 20 15" stroke-width="2" /><circle cx="12" cy="15" r="2.4" fill="currentColor" stroke="none" />',
  '<rect x="5" y="5" width="14" height="14" rx="3" transform="rotate(45 12 12)" />',
  '<path d="M12 4 C6 8 6 16 12 20 C18 16 18 8 12 4 Z" />',
  '<path d="M4 12 h16 M9 7 l-5 5 5 5 M15 7 l5 5 -5 5" />',
];

export function renderSigilGlyph(index) {
  return svg(SIGIL_GLYPHS[((index % SIGIL_GLYPHS.length) + SIGIL_GLYPHS.length) % SIGIL_GLYPHS.length]);
}

export { SIGIL_GLYPHS };
