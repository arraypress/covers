/**
 * A built-in 5×7 pixel face (`font: 'pixel'`): A–Z, 0–9 and basic
 * punctuation, each glyph a set of square cells merged into row runs. It
 * is a face like any other (layout, fitting, justification, text on a
 * path, per-glyph control all work), drawn as paths. The bitmaps are
 * image-effects' pixel font (its `ascii` effect draws with them).
 *
 * Metrics, in a 1000-unit em: a cell is 100 units, capitals are 7 cells
 * (700), the advance is 6 cells (a cell's gap after each glyph), a space
 * is 4 cells. Lowercase is drawn as capitals.
 *
 * @module type/pixel
 */

import { PIXEL_GLYPHS as BITMAPS } from '@logomarks/image-effects/pixel-font';

/** Cell size, font units. */
const CELL = 100;

/** Glyph id per character (1-based; 0 is missing), and back. */
const CHARS = Object.keys(BITMAPS);
const GID = new Map(CHARS.map((c, i) => [c, i + 1]));
const SPACE = CHARS.length + 1;

/**
 * A bitmap's cells as path data, row runs merged: font units, y up,
 * baseline 0.
 *
 * @param {string} bits - 35 cells, row by row from the top.
 * @returns {string}
 */
function cellsPath(bits) {
  let d = '';
  for (let row = 0; row < 7; row++) {
    const top = (7 - row) * CELL;
    for (let col = 0; col < 5; col++) {
      if (bits[row * 5 + col] !== '#') continue;
      let end = col;
      while (end + 1 < 5 && bits[row * 5 + end + 1] === '#') end++;
      const x0 = col * CELL;
      const x1 = (end + 1) * CELL;
      d += `M${x0},${top}L${x1},${top}L${x1},${top - CELL}L${x0},${top - CELL}Z`;
      col = end;
    }
  }
  return d;
}

/** @type {Map<number, string>} */
const PATHS = new Map(CHARS.map((c, i) => [i + 1, cellsPath(BITMAPS[c])]));

/** @type {any} */
let face;

/**
 * The pixel face, shaped and outlined in JavaScript (no font file).
 *
 * @returns {import('../fonts.js').LoadedFont}
 */
export function pixelFace() {
  face ??= {
    name: 'pixel',
    weight: 400,
    style: 'normal',
    font: null,
    upem: 1000,
    ascender: 800,
    descender: -200,
    capHeight: 7 * CELL,
    paths: new Map(),
    axes: {},
    variations: {},
    source: { name: 'pixel', src: 'covers:pixel', weight: 400 },
    glyphToPath: (/** @type {number} */ gid) => PATHS.get(gid) ?? '',
    shapeRun: (/** @type {string} */ text) => Array.from(text).map((ch, i) => {
      const c = BITMAPS[ch] ? ch : ch.toUpperCase();
      const gid = ch === ' ' ? SPACE : GID.get(c) ?? 0;
      return { gid, cluster: i, xAdvance: ch === ' ' ? 4 * CELL : 6 * CELL, xOffset: 0, yOffset: 0 };
    }),
  };
  return face;
}

/** Characters the pixel face draws. */
export const PIXEL_CHARS = Object.freeze(CHARS.join(''));
