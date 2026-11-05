/**
 * A motion's transform and opacity as tracks: each is a list of stops (a
 * value per stop, evenly spaced in time) and how one value is written, as a
 * CSS declaration for keyframes and as SVG attributes for a still.
 *
 * - `translate`: `[x, y]` to move by (from where the layer is), or a list
 *   of points to visit (`[[0, 0], [x, y], …]`); px in the layer's grid, `'%'`
 *   of it, or lengths (`'4vw'`).
 * - `path`: travel a path from where the layer is (`{ d }` or a text-path
 *   kind: `circle`, `ellipse`, `arc`, `wave`); the easing spans the whole path.
 * - `rotate`: degrees to turn to, or a list of angles.
 * - `scale`, `scaleX`, `scaleY`: a factor to grow to, or a list of factors.
 * - `opacity`: 0–1 to fade to (multiplying the layer's own), or a list.
 *
 * Turns and scales are about `origin` (`[x, y]`, default the centre).
 *
 * @module animate/tracks
 */

import { num } from '@arraypress/image-effects/svg';
import { textPathD, pathSampler } from '../type/path.js';
import { pos } from '../layers/util.js';
import { originOf } from '../render/transform.js';
import { interpolate } from './keyframes.js';
import { easing } from './timing.js';

/**
 * A value at progress `p` (0–1) through evenly spaced stops, eased between
 * each pair (as CSS eases between keyframes).
 *
 * @param {any[]} stops
 * @param {number} p
 * @param {(x: number) => number} ease
 * @returns {any}
 */
export function atStops(stops, p, ease) {
  if (stops.length === 1) return stops[0];
  const x = Math.max(0, Math.min(1, p)) * (stops.length - 1);
  const k = Math.min(Math.floor(x), stops.length - 2);
  return interpolate(stops[k], stops[k + 1], ease(x - k));
}

/**
 * A scalar option as stops: a list as given, one value as rest → value.
 *
 * @param {unknown} v @param {number} rest
 * @returns {number[] | undefined}
 */
const scalar = (v, rest) => (v == null ? undefined : Array.isArray(v) ? v.map(Number) : [rest, Number(v)]);

/**
 * A motion's tracks, outermost first: translate (or path), rotate, scale,
 * opacity.
 *
 * @param {import('./timing.js').ResolvedMotion} m
 * @param {{ width: number, height: number }} canvas - The layer's grid.
 * @returns {import('./tracks.js').Track[]}
 * @throws {TypeError} When `translate` and `path` are both set, or scale lists differ in length.
 */
export function tracks(m, canvas) {
  /** @type {import('./tracks.js').Track[]} */
  const out = [];
  const px = (/** @type {any} */ p) => [pos(p[0] ?? 0, 'x', canvas), pos(p[1] ?? 0, 'y', canvas)];
  if (m.translate != null && m.path != null) throw new TypeError('motion: give translate or path, not both');
  if (m.translate != null) {
    const list = Array.isArray(m.translate[0]) ? m.translate : [[0, 0], m.translate];
    out.push(translateTrack(list.map(px), false));
  } else if (m.path != null) {
    out.push(translateTrack(pathStops(m.path, canvas, easing(m.easing)), true));
  }
  const [ox, oy] = originOf(m.origin, canvas);
  const cssAbout = (/** @type {string} */ fn) => `translate(${num(ox)}px,${num(oy)}px) ${fn} translate(${num(-ox)}px,${num(-oy)}px)`;
  const svgAbout = (/** @type {string} */ fn) => `translate(${num(ox)} ${num(oy)}) ${fn} translate(${num(-ox)} ${num(-oy)})`;
  const rotate = scalar(m.rotate, 0);
  if (rotate) {
    out.push({
      stops: rotate,
      css: (a) => `transform:${cssAbout(`rotate(${num(a, 3)}deg)`)}`,
      attr: (a) => (a ? { transform: `rotate(${num(a, 3)} ${num(ox)} ${num(oy)})` } : null),
    });
  }
  const s = scalar(m.scale, 1);
  const sx = scalar(m.scaleX, 1);
  const sy = scalar(m.scaleY, 1);
  if (s || sx || sy) {
    const n = Math.max(s?.length ?? 0, sx?.length ?? 0, sy?.length ?? 0);
    if ([s, sx, sy].some((l) => l && l.length !== n)) throw new TypeError('motion: scale, scaleX and scaleY need the same number of stops');
    const stops = Array.from({ length: n }, (_, i) => [(s?.[i] ?? 1) * (sx?.[i] ?? 1), (s?.[i] ?? 1) * (sy?.[i] ?? 1)]);
    out.push({
      stops,
      css: ([a, b]) => `transform:${cssAbout(`scale(${num(a, 4)},${num(b, 4)})`)}`,
      attr: ([a, b]) => (a === 1 && b === 1 ? null : { transform: svgAbout(`scale(${num(a, 4)} ${num(b, 4)})`) }),
    });
  }
  const opacity = scalar(m.opacity, 1);
  if (opacity) {
    out.push({
      stops: opacity,
      css: (o) => `opacity:${num(o, 3)}`,
      attr: (o) => (o === 1 ? null : { opacity: num(Math.max(0, o), 3) }),
    });
  }
  return out;
}

/**
 * A translate track.
 *
 * @param {[number, number][]} stops - px.
 * @param {boolean} sampled - Stops sampled along a path (eased already).
 * @returns {import('./tracks.js').Track}
 */
function translateTrack(stops, sampled) {
  return {
    stops,
    sampled,
    css: ([x, y]) => `transform:translate(${num(x)}px,${num(y)}px)`,
    attr: ([x, y]) => (x || y ? { transform: `translate(${num(x)} ${num(y)})` } : null),
  };
}

/**
 * Points along a path, relative to its start, sampled evenly in time with
 * the easing applied over the whole path.
 *
 * @param {any} path - `{ d }`, a text-path kind, or path data.
 * @param {{ width: number, height: number }} canvas
 * @param {(x: number) => number} ease
 * @returns {[number, number][]}
 */
function pathStops(path, canvas, ease) {
  const sampler = pathSampler(textPathD(path, canvas));
  const n = Math.max(16, Math.min(240, Math.ceil(sampler.length / 4)));
  const o = sampler.at(0);
  return Array.from({ length: n + 1 }, (_, i) => {
    const at = sampler.at(ease(i / n) * sampler.length);
    return /** @type {[number, number]} */ ([at.x - o.x, at.y - o.y]);
  });
}
