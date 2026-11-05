/**
 * Animation, the data side: any layer option can be keyframed against `t`
 * (seconds), and `renderSvg(cover, { t })` draws the frame at that time.
 * Static covers have no keyframes and ignore `t`, so nothing changes for
 * them. Encoding frames to video is a later phase (see the README).
 *
 * ```json
 * { "type": "text", "content": "{name}",
 *   "opacity": { "keyframes": [[0, 0], [0.6, 1]], "ease": "out" },
 *   "transform": { "rotate": { "keyframes": [[0, -4], [2, 4]], "loop": "pingpong" } } }
 * ```
 *
 * Numbers interpolate; colours mix in OKLab; lengths with the same unit
 * (`"4vmin"` → `"9vmin"`) interpolate; anything else holds until the next
 * key. `loop: true` repeats over the cover's `loop` (seconds; or the last key),
 * `'pingpong'` goes back and forth.
 *
 * @module animate
 */

import { mixOklab, toHex } from '@arraypress/image-effects/color';

/** @param {unknown} v @returns {v is { keyframes: any[] }} */
const isKeyed = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v) && Array.isArray(/** @type {any} */ (v).keyframes);

/**
 * Whether a layer has keyframes anywhere in its options.
 *
 * @param {unknown} v
 * @returns {boolean}
 */
export function isAnimated(v) {
  if (isKeyed(v)) return true;
  if (Array.isArray(v)) return v.some(isAnimated);
  if (v && typeof v === 'object' && !(v instanceof Uint8Array)) return Object.values(v).some(isAnimated);
  return false;
}

/** Easing curves on 0–1. */
const EASE = /** @type {Record<string, (x: number) => number>} */ ({
  linear: (x) => x,
  in: (x) => x * x * x,
  out: (x) => 1 - (1 - x) ** 3,
  inOut: (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2),
  step: () => 0,
});

/**
 * Two values `f` of the way between them.
 *
 * @param {any} a @param {any} b @param {number} f
 * @returns {any}
 */
function mix(a, b, f) {
  if (typeof a === 'number' && typeof b === 'number') return a + (b - a) * f;
  if (typeof a === 'string' && typeof b === 'string') {
    const la = /^(-?[\d.]+)(vmin|vmax|vw|vh|px|%)$/.exec(a);
    const lb = /^(-?[\d.]+)(vmin|vmax|vw|vh|px|%)$/.exec(b);
    if (la && lb && la[2] === lb[2]) return `${+la[1] + (+lb[1] - +la[1]) * f}${la[2]}`;
    try {
      return mixOklab(toHex(a), toHex(b), f);
    } catch {
      return f < 1 ? a : b;
    }
  }
  if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) return a.map((x, i) => mix(x, b[i], f));
  if (a && b && typeof a === 'object' && typeof b === 'object') return Object.fromEntries(Object.keys(a).map((k) => [k, k in b ? mix(a[k], b[k], f) : a[k]]));
  return f < 1 ? a : b;
}

/**
 * A keyframed value at time `t`.
 *
 * @param {{ keyframes: any[], ease?: string, loop?: boolean | 'pingpong' }} k
 * @param {number} t
 * @param {number} [duration]
 * @returns {any}
 */
export function valueAt(k, t, duration) {
  const keys = k.keyframes.map((x) => (Array.isArray(x) ? { t: x[0], value: x[1], ease: x[2] } : x)).sort((a, b) => a.t - b.t);
  if (!keys.length) return undefined;
  const end = duration ?? keys[keys.length - 1].t;
  let time = t;
  if (k.loop && end > 0) {
    time = ((t % end) + end) % end;
    if (k.loop === 'pingpong' && Math.floor(t / end) % 2 === 1) time = end - time;
  }
  if (time <= keys[0].t) return keys[0].value;
  for (let i = 1; i < keys.length; i++) {
    if (time <= keys[i].t) {
      const a = keys[i - 1];
      const b = keys[i];
      const ease = EASE[b.ease ?? k.ease ?? 'inOut'] ?? EASE.inOut;
      return mix(a.value, b.value, ease((time - a.t) / Math.max(1e-9, b.t - a.t)));
    }
  }
  return keys[keys.length - 1].value;
}

/**
 * A layer with every keyframed option resolved at `t`.
 *
 * @template T
 * @param {T} v
 * @param {number} t - Seconds.
 * @param {number} [duration] - The cover's `loop` length in seconds (loops wrap at it).
 * @returns {T}
 */
export function animate(v, t, duration) {
  if (isKeyed(v)) return valueAt(v, t, duration);
  if (Array.isArray(v)) return /** @type {any} */ (v.map((x) => animate(x, t, duration)));
  if (v && typeof v === 'object' && !(v instanceof Uint8Array) && isAnimated(v)) {
    return /** @type {any} */ (Object.fromEntries(Object.entries(v).map(([k, x]) => [k, animate(x, t, duration)])));
  }
  return v;
}
