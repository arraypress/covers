/**
 * Motion timing: presets, defaults, easing curves, and where a motion is at
 * any time, with CSS animation semantics (so a still drawn at `t` matches
 * what a browser shows at `t`).
 *
 * @module animate/timing
 */

import { num } from '@logomarks/image-effects/svg';

/** Named motions: each is a motion's defaults, under whatever else you set. */
export const MOTION_PRESETS = Object.freeze({
  drift: Object.freeze({ translate: ['3vmin', '-2vmin'], duration: 20, easing: 'inOut', direction: 'alternate' }),
  spin: Object.freeze({ rotate: 360, duration: 30, easing: 'linear' }),
  breathe: Object.freeze({ scale: 1.06, duration: 3, easing: 'inOut', direction: 'alternate' }),
  blink: Object.freeze({ opacity: [1, 0, 1], duration: 1, easing: 'step' }),
  marquee: Object.freeze({ marquee: true, duration: 10, easing: 'linear' }),
});

/** Timing defaults. */
const DEFAULTS = { duration: 2, delay: 0, easing: 'linear', direction: 'normal', iterations: Infinity };

/** Directions, as CSS names them. */
const DIRECTIONS = ['normal', 'reverse', 'alternate', 'alternate-reverse'];

/** Named easing curves as cubic Béziers (CSS's), and the step. */
const CURVES = /** @type {Record<string, [number, number, number, number]>} */ ({
  linear: [0, 0, 1, 1],
  ease: [0.25, 0.1, 0.25, 1],
  in: [0.42, 0, 1, 1],
  out: [0, 0, 0.58, 1],
  inOut: [0.42, 0, 0.58, 1],
});

/**
 * A layer's `motion` as a list of resolved motions: presets expanded,
 * timing defaults filled in, `iterations: 'infinite'` as `Infinity`.
 *
 * @param {unknown} v - A motion, a preset name, or a list of them.
 * @returns {import('./timing.js').ResolvedMotion[]}
 * @throws {TypeError} On an unknown preset, direction or easing, or a duration that isn't positive.
 */
export function motionList(v) {
  return (Array.isArray(v) ? v : [v]).filter((m) => m != null && m !== false).map((m) => {
    const own = typeof m === 'string' ? { preset: m } : /** @type {any} */ (m);
    const preset = own.preset == null ? {} : MOTION_PRESETS[/** @type {keyof typeof MOTION_PRESETS} */ (own.preset)];
    if (!preset) throw new TypeError(`Unknown motion preset "${own.preset}" (${Object.keys(MOTION_PRESETS).join(', ')})`);
    const r = { ...DEFAULTS, ...preset, ...own };
    if (r.iterations === 'infinite') r.iterations = Infinity;
    if (!(r.duration > 0)) throw new TypeError(`motion: duration must be a positive number of seconds, got ${r.duration}`);
    if (!(r.iterations > 0)) throw new TypeError(`motion: iterations must be positive or "infinite", got ${r.iterations}`);
    if (!DIRECTIONS.includes(r.direction)) throw new TypeError(`motion: unknown direction "${r.direction}" (${DIRECTIONS.join(', ')})`);
    easing(r.easing);
    return r;
  });
}

/**
 * An easing as a function on 0–1.
 *
 * @param {import('./timing.js').Easing} e
 * @returns {(x: number) => number}
 * @throws {TypeError} On an unknown name.
 */
export function easing(e) {
  if (e === 'step') return (x) => (x >= 1 ? 1 : 0);
  const c = Array.isArray(e) ? e : CURVES[/** @type {string} */ (e)];
  if (!c || c.length !== 4) throw new TypeError(`motion: unknown easing ${JSON.stringify(e)} (${[...Object.keys(CURVES), 'step'].join(', ')}, or [x1, y1, x2, y2])`);
  return bezier(c[0], c[1], c[2], c[3]);
}

/**
 * An easing as CSS writes it.
 *
 * @param {import('./timing.js').Easing} e
 * @returns {string}
 */
export function cssEasing(e) {
  if (e === 'step') return 'steps(1,end)';
  if (e === 'linear') return 'linear';
  const [a, b, c, d] = Array.isArray(e) ? e : CURVES[/** @type {string} */ (e)];
  return `cubic-bezier(${[a, b, c, d].map((v) => num(v, 4)).join(',')})`;
}

/**
 * A CSS cubic-bezier timing function, solved for y at x.
 *
 * @param {number} x1 @param {number} y1 @param {number} x2 @param {number} y2
 * @returns {(x: number) => number}
 */
function bezier(x1, y1, x2, y2) {
  const at = (/** @type {number} */ t, /** @type {number} */ a, /** @type {number} */ b) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0;
    let hi = 1;
    let t = x;
    for (let i = 0; i < 40; i++) {
      const v = at(t, x1, x2);
      if (Math.abs(v - x) < 1e-7) break;
      if (v < x) lo = t; else hi = t;
      t = (lo + hi) / 2;
    }
    return at(t, y1, y2);
  };
}

/**
 * How far through its stops a motion is at `t` seconds (0–1, direction
 * applied), as CSS plays it with `animation-fill-mode: both`: before its
 * delay it holds the start, after its last iteration the end.
 *
 * @param {import('./timing.js').ResolvedMotion} m
 * @param {number} t
 * @returns {number}
 */
export function progress(m, t) {
  const local = t - m.delay;
  let iteration = 0;
  let p = 0;
  if (local >= m.duration * m.iterations) {
    iteration = Math.ceil(m.iterations) - 1;
    p = m.iterations - iteration;
  } else if (local > 0) {
    const whole = local / m.duration;
    iteration = Math.floor(whole);
    p = whole - iteration;
  }
  const back = m.direction === 'reverse'
    || (m.direction === 'alternate' && iteration % 2 === 1)
    || (m.direction === 'alternate-reverse' && iteration % 2 === 0);
  return back ? 1 - p : p;
}

/**
 * A motion's CSS `animation` timing (everything but the name).
 *
 * @param {import('./timing.js').ResolvedMotion} m
 * @param {{ linear?: boolean, delay?: number }} [o] - `linear`: the stops were sampled with the easing already applied.
 * @returns {string}
 */
export function cssTiming(m, o = {}) {
  const iterations = m.iterations === Infinity ? 'infinite' : num(m.iterations, 3);
  return `${num(m.duration, 3)}s ${o.linear ? 'linear' : cssEasing(m.easing)} ${num(o.delay ?? m.delay, 3)}s ${iterations} ${m.direction} both`;
}
