/**
 * `vary`: layer options that change over the motion, drawn frame by frame
 * and played as outline morphs.
 *
 * ```json
 * "motion": { "vary": { "axes": { "wdth": [62, 150] } }, "duration": 2.8, "easing": "inOut", "direction": "alternate" }
 * ```
 *
 * Every leaf of `vary` is a list of stops (numbers, colours, same-unit
 * lengths). The layer is drawn at `frames` points per stop (default 12),
 * with the easing applied; the frames must differ only in their outlines
 * (`d`), which become CSS `d: path(…)` keyframes. Outlines interpolate
 * point by point, which is how a variable font interpolates between its
 * masters, so a width axis breathes as the font itself would draw it
 * (exact at every frame, linear between frames a few percent apart).
 *
 * @module animate/morph
 */

import { atStops } from './tracks.js';
import { easing, progress, cssTiming } from './timing.js';

/** A path's `d` attribute, captured. */
const D = / d="([^"]*)"/g;

/**
 * `vary`'s values at progress `p`, merged into the layer.
 *
 * @param {any} layer
 * @param {any} vary
 * @param {number} p
 * @param {(x: number) => number} ease
 * @returns {any}
 */
export function varied(layer, vary, p, ease) {
  const merge = (/** @type {any} */ base, /** @type {any} */ v) => {
    if (Array.isArray(v)) return atStops(v, p, ease);
    if (!v || typeof v !== 'object') throw new TypeError('motion: every value in vary is a list of stops ([from, to, …])');
    const out = { ...(base && typeof base === 'object' ? base : {}) };
    for (const [k, x] of Object.entries(v)) out[k] = merge(out[k], x);
    return out;
  };
  return merge(layer, vary);
}

/**
 * A layer drawn with `vary`: a still at `t`, or (live) the still with each
 * outline that changes keyframed.
 *
 * @param {any} layer - Without its motion.
 * @param {import('./timing.js').ResolvedMotion} m
 * @param {import('./motion.js').MotionScope} o
 * @returns {Promise<{ defs: string, body: string }>}
 * @throws {TypeError} When the frames differ in more than their outlines.
 */
export async function morph(layer, m, o) {
  const ease = easing(m.easing);
  const still = o.t == null ? layer : varied(layer, m.vary, progress(m, o.t), ease);
  if (!o.live) return o.draw(still);
  const stops = Math.max(...leaves(m.vary).map((l) => l.length));
  const count = Math.max(1, Math.round(m.frames ?? 12)) * Math.max(1, stops - 1);
  /** @type {{ p: number, ds: string[] }[]} */
  const frames = [];
  const name = layer.id ?? layer.type;
  /** @type {string | undefined} */
  let shape;
  const check = (/** @type {{ defs: string, body: string }} */ f) => {
    shape ??= strip(f);
    if (strip(f) !== shape) throw new TypeError(`motion: vary on "${name}" changes more than its outlines, so it can't play as a morph`);
  };
  for (let i = 0; i <= count; i++) {
    const p = i / count;
    const f = await o.draw(varied(layer, m.vary, p, ease));
    check(f);
    frames.push({ p, ds: [...f.body.matchAll(D)].map((x) => x[1]) });
  }
  // The still last, so what the layer leaves behind (its layout box, its stream) is the still's.
  const rest = await o.draw(still);
  check(rest);
  let slot = -1;
  const body = rest.body.replace(D, (whole) => {
    slot += 1;
    const ds = frames.map((f) => f.ds[slot]);
    if (ds.every((d) => d === ds[0])) return whole;
    if (ds.some((d) => commands(d) !== commands(ds[0]))) throw new TypeError(`motion: vary on "${name}" changes an outline's shape (not just its points), so it can't morph`);
    const cls = o.sheet.animation(frames.map((f) => [f.p, `d:path("${f.ds[slot]}")`]), cssTiming(m, { linear: true }));
    return ` class="${cls}"${whole}`;
  });
  return { ...rest, body };
}

/** @param {{ defs: string, body: string }} m @returns {string} Markup with every outline blanked. */
const strip = (m) => `${m.defs}\n${m.body}`.replace(D, ' d=""');

/** @param {string} d @returns {string} A path's commands, without their numbers. */
const commands = (d) => d.replace(/[^A-Za-z]/g, '');

/** @param {any} v @returns {any[][]} Every stop list in `vary`. */
const leaves = (v) => (Array.isArray(v) ? [v] : Object.values(v ?? {}).flatMap(leaves));
