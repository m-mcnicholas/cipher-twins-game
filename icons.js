// The fixed, shared communication palette. Every icon here describes shape,
// position, count, comparison, category, or a meta signal — nothing in this
// set can spell a letter or a number directly, which is the whole point:
// players can only point at *properties* of their glyphs, never the glyphs
// themselves. Placing icons in a row on the shared board is the entire
// vocabulary; the app never tries to parse what a sequence "means" — that
// inference is the players' job.

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

  // category
  "cat:animal": { label: "Animal", group: "Category", render: () => svg('<circle cx="12" cy="14" r="2" /><circle cx="6" cy="9" r="1.6" /><circle cx="18" cy="9" r="1.6" /><circle cx="8.5" cy="6" r="1.4" /><circle cx="15.5" cy="6" r="1.4" />') },
  "cat:object": { label: "Object", group: "Category", render: () => svg('<path d="M4 8 L12 4 L20 8 V17 L12 21 L4 17 Z" /><path d="M4 8 L12 12 L20 8" /><line x1="12" y1="12" x2="12" y2="21" />') },
  "cat:nature": { label: "Nature", group: "Category", render: () => svg('<path d="M12 21 V11" /><path d="M12 11 C6 11 5 5 5 5 C11 5 12 11 12 11 Z" /><path d="M12 15 C18 15 19 9 19 9 C13 9 12 15 12 15 Z" />') },
  "cat:action": { label: "Action", group: "Category", render: () => svg('<circle cx="12" cy="5" r="2" /><path d="M12 8 v5 M12 9 l-5 4 M12 9 l5 3 M12 13 l-4 7 M12 13 l4 7" />') },
  "cat:food": { label: "Food", group: "Category", render: () => svg('<path d="M12 4 C7 4 5 8 5 12 C5 17 8 20 12 20 C16 20 19 17 19 12 C19 8 17 4 12 4 Z" /><path d="M12 4 C12 2 13.5 1.5 14.5 2" />') },
  "cat:feeling": { label: "Feeling", group: "Category", render: () => svg('<path d="M12 20 C5 15 3 11 5 7.5 C7 4.5 11 5 12 8 C13 5 17 4.5 19 7.5 C21 11 19 15 12 20 Z" />') },

  // meta
  "meta:confirm": { label: "Confirm", group: "Meta", render: () => svg('<path d="M4 12 L10 18 L20 6" />') },
  "meta:reject": { label: "Reject", group: "Meta", render: () => svg('<line x1="5" y1="5" x2="19" y2="19" /><line x1="19" y1="5" x2="5" y2="19" />') },
  "meta:question": { label: "Question", group: "Meta", render: () => svg('<path d="M8 8 a4 4 0 1 1 6 3.5 c-1.5 1-2 2-2 3.5" /><circle cx="12" cy="19" r="0.8" fill="currentColor" />') },
};

export const ICON_GROUPS = ["Shape", "Position", "Count", "Comparison", "Category", "Meta"];

export function renderIcon(id) {
  const icon = ICONS[id];
  if (!icon) throw new Error(`Unknown icon: ${id}`);
  return icon.render();
}
