/**
 * Per-glyph control: each letter its own scale, shift, turn and colour,
 * from arrays (cycled), so bulging 70s type or a wave of letters is one
 * text layer.
 *
 * `glyphs: { scale, scaleX, scaleY, dx, dy, rotate, color, origin, advance }`:
 * numbers (or colours) per glyph, counted across the whole block and
 * skipping spaces; `origin` is `'center'` (the default: the glyph's middle
 * at half the cap height) or `'baseline'`; `advance` (default true) lets a
 * scaled glyph take its scaled width, pushing its neighbours along.
 *
 * @module type/glyphs
 */

import { len } from '../geometry.js';
import { toHex } from '../color.js';

/** @param {any} list @param {number} i @param {any} fallback @returns {any} The i-th of a cycled list (or a single value). */
const at = (list, i, fallback) => (list == null ? fallback : Array.isArray(list) ? (list.length ? list[i % list.length] : fallback) : list);

/**
 * Apply per-glyph control to a shaped line: advances widened for scaled
 * glyphs, and each glyph's transform (`t`, about its pen position) and
 * paint key (`paint`, a colour).
 *
 * @param {import('../text.js').Shaped} run
 * @param {any} spec - The layer's `glyphs`.
 * @param {{ start: number, size: number, capHeight: number, canvas: { width: number, height: number }, text: string }} o - `start`: index of the line's first glyph in the block.
 * @returns {{ run: import('../text.js').Shaped, count: number }} The run, and how many glyphs it counted.
 */
export function controlGlyphs(run, spec, o) {
  if (!spec) return { run, count: 0 };
  const glyphs = run.glyphs.map((g) => ({ ...g }));
  const blanks = blankGlyphs(run, o.text);
  let shift = 0;
  let n = 0;
  for (let i = 0; i < glyphs.length; i++) {
    const g = glyphs[i];
    const adv = (i + 1 < run.glyphs.length ? run.glyphs[i + 1].x : run.width) - run.glyphs[i].x;
    g.x += shift;
    if (blanks.has(i)) continue;
    const k = o.start + n++;
    const s = at(spec.scale, k, 1);
    const sx = at(spec.scaleX, k, 1) * s;
    const sy = at(spec.scaleY, k, 1) * s;
    const rot = (at(spec.rotate, k, 0) * Math.PI) / 180;
    const dx = len(at(spec.dx, k, 0), o.canvas);
    const dy = len(at(spec.dy, k, 0), o.canvas);
    const color = at(spec.color, k, undefined);
    const grow = spec.advance === false ? 0 : adv * (sx - 1);
    // About the glyph's centre (at half the cap height), or its baseline.
    const ox = (adv * (spec.advance === false ? 1 : sx)) / 2;
    const oy = spec.origin === 'baseline' ? 0 : -o.capHeight / 2;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const a = cos * sx;
    const b = sin * sx;
    const c = -sin * sy;
    const d = cos * sy;
    // Glyph-local point p maps to origin + R·S·(p − origin/scaled) + shift.
    const px0 = adv / 2;
    g.t = [a, b, c, d, ox - (a * px0 + c * oy) + dx, oy - (b * px0 + d * oy) + dy];
    if (color != null) g.paint = toHex(color);
    shift += grow;
  }
  return { run: { glyphs, width: run.width + shift }, count: n };
}

/**
 * Glyph indices that are spaces (by cluster), so they don't take a slot.
 *
 * @param {import('../text.js').Shaped} run
 * @param {string} text
 * @returns {Set<number>}
 */
function blankGlyphs(run, text) {
  const chars = Array.from(text);
  const out = new Set();
  run.glyphs.forEach((g, i) => {
    const ch = /** @type {any} */ (g).cluster != null ? text[/** @type {any} */ (g).cluster] : chars[i];
    if (ch != null && /\s/.test(ch)) out.add(i);
  });
  return out;
}

/** How many glyphs a line counts (non-space characters). @param {string} text @returns {number} */
export const glyphCount = (text) => Array.from(text).filter((ch) => !/\s/.test(ch)).length;
