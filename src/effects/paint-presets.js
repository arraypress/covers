/**
 * Named paints. `chrome` is Y2K chrome as it's painted by hand: a
 * reflected horizon, not a lighting filter. Sky at the top, a sharp dark
 * horizon a little past the middle, warm ground below it, and a light
 * bounce at the very bottom. Pair it with a light keyline (`strokes`).
 *
 * @module effects/paint-presets
 */

/** Paint presets, by name. A paint `{ preset, …fields }` overrides any of them. */
export const PRESETS = Object.freeze({
  chrome: Object.freeze({
    type: 'linear',
    angle: 180,
    colors: ['#f4f8ff', '#9fc3ef', '#e8f1ff', '#2b3446', '#7a5a3c', '#d9b48a', '#fff6e6'],
    stops: [0, 0.34, 0.545, 0.555, 0.62, 0.86, 1],
  }),
  /** The same horizon, cooler: steel. */
  steel: Object.freeze({
    type: 'linear',
    angle: 180,
    colors: ['#ffffff', '#b9c4d4', '#eef2f7', '#30363f', '#5d6672', '#c7ced8', '#ffffff'],
    stops: [0, 0.34, 0.545, 0.555, 0.62, 0.86, 1],
  }),
  /** Gold leaf: the horizon in warm metal. */
  gold: Object.freeze({
    type: 'linear',
    angle: 180,
    colors: ['#fff6d6', '#e9c46a', '#fff1c2', '#6b4210', '#a8701f', '#f2cf73', '#fff8e0'],
    stops: [0, 0.34, 0.545, 0.555, 0.62, 0.86, 1],
  }),
});

/** The keyline that goes round metal paints: a thin light edge, then a dark one (widest first, under the fill). */
export const KEYLINE = Object.freeze([Object.freeze({ color: '#0b0f18', width: '0.9vmin' }), Object.freeze({ color: '#ffffff', width: '0.35vmin' })]);

/**
 * The keyline a fill brings with it: a preset paint's, unless the paint
 * says `keyline: false` (or gives its own `keyline` list).
 *
 * @param {any} fill
 * @returns {{ color: string, width: string | number }[] | undefined}
 */
export function presetStrokes(fill) {
  if (!fill || typeof fill !== 'object' || fill.preset == null || fill.keyline === false) return undefined;
  return Array.isArray(fill.keyline) ? fill.keyline : [...KEYLINE];
}
