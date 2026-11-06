/**
 * A built-in face of a few symbols type often wants and fonts often lack
 * (✺ ✦ ✶ ★ ☆ ♥ ♡ ▶ ◀ ● ◆ ■ ♪ ≠), drawn as shapes. The last fallback when a
 * text layer's font has no glyph for a character.
 *
 * @module type/symbols
 */

/** Advance, font units (1000 per em). */
const ADV = 820;
/** Centre of a symbol: half the advance across, about the middle of a capital up. */
const CX = ADV / 2;
const CY = 340;
const R = 360;

/** @param {[number, number][]} pts @returns {string} A closed polygon, font units (y up). */
const poly = (pts) => `M${pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L')}Z`;

/** @param {number} n @param {number} inner @param {number} [turn=0] @returns {[number, number][]} A star's points (clockwise from the top). */
function star(n, inner, turn = 0) {
  return Array.from({ length: n * 2 }, (_, i) => {
    const a = (i / (n * 2)) * Math.PI * 2 + turn;
    const r = i % 2 ? R * inner : R;
    return /** @type {[number, number]} */ ([CX + r * Math.sin(a), CY + r * Math.cos(a)]);
  });
}

/** @param {number} k - Size, 0–1. @returns {[number, number][]} A heart, clockwise. */
function heart(k) {
  return Array.from({ length: 72 }, (_, i) => {
    const t = (i / 72) * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3;
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    return /** @type {[number, number]} */ ([CX + x * 22 * k, CY + 30 + y * 22 * k]);
  });
}

/** @param {number} r @param {number} [n=48] @returns {[number, number][]} */
const circle = (r, n = 48) => Array.from({ length: n }, (_, i) => /** @type {[number, number]} */ ([CX + r * Math.sin((i / n) * Math.PI * 2), CY + r * Math.cos((i / n) * Math.PI * 2)]));

/**
 * Not-equal, on a narrower advance (`NARROW`): two bars and a slash, one
 * contour each, all wound alike so they fill as one.
 *
 * @returns {string}
 */
function notEqual() {
  const cx = NARROW / 2;
  const [half, bar, gap, lean, stem] = [230, 62, 112, 150, 31];
  const rect = (/** @type {number} */ y) => poly([[cx - half, y + bar / 2], [cx + half, y + bar / 2], [cx + half, y - bar / 2], [cx - half, y - bar / 2]]);
  const slash = poly([[cx + lean - stem, CY + 300], [cx + lean + stem, CY + 300], [cx - lean + stem, CY - 300], [cx - lean - stem, CY - 300]]);
  return rect(CY + gap) + rect(CY - gap) + slash;
}

/** Advance of the narrow symbols (≠), font units. */
const NARROW = 600;

/** Outlines by character. An inner contour runs the other way (a hole). */
const SHAPES = /** @type {Record<string, string>} */ ({
  '✺': poly(star(16, 0.5)),
  '✦': poly(star(4, 0.32)),
  '✶': poly(star(6, 0.45)),
  '★': poly(star(5, 0.4)),
  '☆': poly(star(5, 0.4)) + poly(star(5, 0.4).map(([x, y]) => /** @type {[number, number]} */ ([CX + (x - CX) * 0.7, CY + (y - CY) * 0.7])).reverse()),
  '♥': poly(heart(1)),
  '♡': poly(heart(1)) + poly(heart(0.72).map(([x, y]) => /** @type {[number, number]} */ ([x, y + 28])).reverse()),
  '▶': poly([[CX - R * 0.8, CY + R], [CX + R, CY], [CX - R * 0.8, CY - R]]),
  '◀': poly([[CX + R * 0.8, CY + R], [CX + R * 0.8, CY - R], [CX - R, CY]]),
  '●': poly(circle(R * 0.8)),
  '◆': poly([[CX, CY + R], [CX + R * 0.8, CY], [CX, CY - R], [CX - R * 0.8, CY]]),
  '■': poly([[CX - R * 0.75, CY + R * 0.75], [CX + R * 0.75, CY + R * 0.75], [CX + R * 0.75, CY - R * 0.75], [CX - R * 0.75, CY - R * 0.75]]),
  '♪': poly([[CX - 40, CY + R], [CX + 220, CY + R * 0.7], [CX + 220, CY + R * 0.45], [CX + 20, CY + R * 0.72], [CX + 20, CY - R * 0.55], [CX - 40, CY - R * 0.55]]) + poly(circle(110).map(([x, y]) => /** @type {[number, number]} */ ([x - 120, y - R * 0.6]))),
  '≠': notEqual(),
});

const CHARS = Object.keys(SHAPES);

/** @type {any} */
let face;

/**
 * The symbol face (shaped and outlined in JavaScript).
 *
 * @returns {import('../fonts.js').LoadedFont}
 */
export function symbolFace() {
  face ??= {
    name: 'symbols',
    weight: 400,
    style: 'normal',
    font: null,
    upem: 1000,
    ascender: 800,
    descender: -200,
    capHeight: 700,
    paths: new Map(),
    axes: {},
    variations: {},
    source: { name: 'symbols', src: 'covers:symbols', weight: 400 },
    glyphToPath: (/** @type {number} */ gid) => SHAPES[CHARS[gid - 1]] ?? '',
    shapeRun: (/** @type {string} */ text) => Array.from(text).map((ch, i) => ({ gid: CHARS.indexOf(ch) + 1, cluster: i, xAdvance: ch === '≠' ? NARROW : ADV, xOffset: 0, yOffset: 0 })),
  };
  return face;
}

/** The characters the symbol face draws. */
export const SYMBOLS = Object.freeze(CHARS.join(''));
