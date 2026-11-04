/**
 * `look`: graded presets, built from the grading filters, `amount` of the
 * way from the original (0–1): `fade` (lifted blacks, softened whites),
 * `crossProcess` (slide film in negative chemistry: yellow highlights,
 * cyan-blue shadows, hard contrast), `bleachBypass` (silver kept in:
 * desaturated, harsh, metallic), `tealOrange` (warm skin against cool
 * shadows), `warmFilm` and `coolFilm` (balanced stock, gently faded), and
 * `noir` (hard black and white).
 *
 * @module effects/looks
 */

import { num } from '../svg.js';
import { curveTable, transfer, balanceTables } from './grade.js';
import { LUMA, mat } from './util.js';

/** @param {number} v @returns {string} */
const saturate = (v) => `<feColorMatrix type="saturate" values="${num(v, 3)}"/>`;

/** @param {[number, number][]} pts @returns {number[]} */
const curve = (pts) => curveTable(pts, 96);

/** A curve on all three channels. @param {[number, number][]} pts @returns {string} */
const tone = (pts) => { const t = curve(pts); return transfer([t, t, t]); };

/** A table per channel. @param {[number, number][][]} rgbPts @returns {string} */
const split = (rgbPts) => transfer(rgbPts.map(curve));

/** A colour balance. @param {Parameters<typeof balanceTables>[0]} z @returns {string} */
const balance = (z) => transfer(balanceTables(z).map((t) => t));

/** The presets, as filter primitives. @type {Record<string, () => string>} */
const LOOKS = {
  fade: () => tone([[0, 0.11], [0.25, 0.3], [0.75, 0.76], [1, 0.93]]) + saturate(0.82),
  crossProcess: () => split([
    [[0, 0.04], [0.25, 0.15], [0.75, 0.9], [1, 1]],
    [[0, 0], [0.25, 0.17], [0.75, 0.9], [1, 1]],
    [[0, 0.2], [0.5, 0.46], [1, 0.66]],
  ]) + saturate(1.12),
  bleachBypass: () => `<feColorMatrix in="SourceGraphic" type="matrix" values="${mat([...LUMA, 0, 0, ...LUMA, 0, 0, ...LUMA, 0, 0, 0, 0, 0, 1, 0])}" result="lkg"/>`
    + '<feBlend in="lkg" in2="SourceGraphic" mode="overlay" result="lko"/>'
    + '<feComposite in="lko" in2="lkg" operator="arithmetic" k2="0.55" k3="0.45"/>'
    + tone([[0, 0], [0.22, 0.14], [0.5, 0.5], [0.8, 0.88], [1, 1]]),
  tealOrange: () => tone([[0, 0.02], [0.25, 0.21], [0.75, 0.8], [1, 0.98]])
    + balance({ shadows: [-0.32, 0.06, 0.3], midtones: [0.06, 0, -0.08], highlights: [0.26, 0.06, -0.3] })
    + saturate(1.12),
  warmFilm: () => tone([[0, 0.06], [0.3, 0.3], [0.7, 0.74], [1, 0.95]])
    + balance({ shadows: [0.06, 0.02, -0.06], midtones: [0.1, 0.03, -0.12], highlights: [0.08, 0.04, -0.12] })
    + saturate(0.92),
  coolFilm: () => tone([[0, 0.06], [0.3, 0.29], [0.7, 0.73], [1, 0.95]])
    + balance({ shadows: [-0.1, 0.04, 0.14], midtones: [-0.08, 0.01, 0.1], highlights: [-0.04, 0.02, 0.06] })
    + saturate(0.85),
  noir: () => `<feColorMatrix type="matrix" values="${mat([0.3, 0.6, 0.1, 0, 0, 0.3, 0.6, 0.1, 0, 0, 0.3, 0.6, 0.1, 0, 0, 0, 0, 0, 1, 0])}"/>`
    + tone([[0, 0], [0.18, 0.05], [0.45, 0.4], [0.75, 0.85], [1, 1]]),
};

/** Preset names. */
export const LOOK_NAMES = Object.freeze(Object.keys(LOOKS));

/**
 * `look`: a preset grade (`name`), `amount` of the way (default 1).
 *
 * @param {import('./index.js').Effect & { kind: 'look' }} fx
 * @returns {string}
 * @throws {TypeError} On an unknown name.
 */
export function look(fx) {
  const name = fx.name ?? 'fade';
  if (!Object.hasOwn(LOOKS, name)) throw new TypeError(`Unknown look "${name}" (${LOOK_NAMES.join(', ')})`);
  const a = fx.amount ?? 1;
  const body = LOOKS[name]();
  if (a >= 1) return body;
  return `${body}<feOffset dx="0" dy="0" result="lk"/><feComposite in="lk" in2="SourceGraphic" operator="arithmetic" k2="${num(a, 3)}" k3="${num(1 - a, 3)}"/>`;
}
