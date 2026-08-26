// Two independent, deterministic letter -> glyph mappings ("fonts").
//
// Every letter A-Z maps to a 5-bit index (0-25 fits in 5 bits). Each font
// renders that same index in a structurally different visual language, so a
// player who somehow saw both fonts side by side for the same letter still
// could not "read across" them by shape alone — Font A is a dot/line matrix,
// Font B is a radial arrow burst with a different rotation offset. This is
// what makes the raw glyphs unusable as letters: they only carry shape,
// symmetry, and count information, which is exactly what the icon palette
// is built to describe.

const TAU = Math.PI * 2;

function letterIndex(letter) {
  const code = letter.toUpperCase().charCodeAt(0) - 65;
  if (code < 0 || code > 25) throw new RangeError(`Not a letter: ${letter}`);
  return code;
}

function bits(index) {
  return [0, 1, 2, 3, 4].map((i) => (index >> i) & 1);
}

function svgWrap(inner, extraClass = "") {
  return `<svg class="glyph-svg ${extraClass}" viewBox="0 0 64 64" width="100%" height="100%" role="img" aria-hidden="true">${inner}</svg>`;
}

// Font A — dot-matrix: five pentagon anchors, filled dot for a 1-bit,
// hollow ring for a 0-bit, faint lines connecting every filled anchor.
export function glyphFontA(letter) {
  const idx = letterIndex(letter);
  const b = bits(idx);
  const cx = 32, cy = 32, r = 21;
  const anchors = b.map((_, i) => {
    const angle = -Math.PI / 2 + (i * TAU) / 5;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  });

  const lit = anchors.filter((_, i) => b[i] === 1);
  let lines = "";
  for (let i = 0; i < lit.length; i++) {
    for (let j = i + 1; j < lit.length; j++) {
      lines += `<line x1="${lit[i][0].toFixed(1)}" y1="${lit[i][1].toFixed(1)}" x2="${lit[j][0].toFixed(1)}" y2="${lit[j][1].toFixed(1)}" stroke="currentColor" stroke-width="1.4" stroke-opacity="0.45" />`;
    }
  }

  let dots = "";
  anchors.forEach(([x, y], i) => {
    if (b[i] === 1) {
      dots += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5.5" fill="currentColor" />`;
    } else {
      dots += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="none" stroke="currentColor" stroke-width="1.6" />`;
    }
  });

  const core = `<circle cx="${cx}" cy="${cy}" r="2.2" fill="currentColor" fill-opacity="0.55" />`;
  return svgWrap(lines + dots + core, "glyph-font-a");
}

// Font B — radial arrows: five spokes offset a half-step from Font A's
// anchors, long with an arrowhead for a 1-bit, a short stub for a 0-bit.
export function glyphFontB(letter) {
  const idx = letterIndex(letter);
  const b = bits(idx);
  const cx = 32, cy = 32;
  const shortR = 9, longR = 24;

  let spokes = "";
  b.forEach((bit, i) => {
    const angle = -Math.PI / 2 + Math.PI / 5 + (i * TAU) / 5;
    const len = bit === 1 ? longR : shortR;
    const x = cx + len * Math.cos(angle);
    const y = cy + len * Math.sin(angle);
    spokes += `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />`;
    if (bit === 1) {
      const wing = Math.PI / 7;
      const ax = x - 7 * Math.cos(angle - wing);
      const ay = y - 7 * Math.sin(angle - wing);
      const bx = x - 7 * Math.cos(angle + wing);
      const by = y - 7 * Math.sin(angle + wing);
      spokes += `<polygon points="${x.toFixed(1)},${y.toFixed(1)} ${ax.toFixed(1)},${ay.toFixed(1)} ${bx.toFixed(1)},${by.toFixed(1)}" fill="currentColor" />`;
    }
  });

  const core = `<polygon points="32,27 37,32 32,37 27,32" fill="currentColor" fill-opacity="0.6" />`;
  return svgWrap(spokes + core, "glyph-font-b");
}

export const FONTS = { A: glyphFontA, B: glyphFontB };

export function renderGlyph(font, letter) {
  return FONTS[font](letter);
}
