/**
 * Light on the lens and the film, as SVG filters: `vignette` (edges
 * darkened, or lightened, by shape, size, softness and colour),
 * `lightLeak` (warm light fogging the film from an edge) and `lensFlare`
 * (a soft glow at the light, ghosts along the line through the centre,
 * an optional anamorphic streak).
 *
 * Their light is drawn from small greyscale images (a radial falloff
 * computed here) that the filter scales and tints, so they stay smooth at
 * any size and cost no more at 3000 px than at 300.
 *
 * @module effects/optics
 */

import { attrs, num } from '../svg.js';
import { len } from '../geometry.js';
import { encodePng, pngUri } from '../png.js';
import { createRng } from '../rng.js';
import { rgb, mat } from './util.js';
import { fraction, smoothstep } from './buffer.js';

/** @type {Map<string, string>} */
const SPRITES = new Map();

/**
 * A greyscale sprite from a radial profile, cached: `profile(r)` for r
 * from 0 (centre) to 1 (edge of the square).
 *
 * @param {string} key
 * @param {(r: number) => number} profile
 * @param {number} [size=96]
 * @param {number} [aspect=1] - Width over height of the sprite's pixels.
 * @returns {string} A data URI.
 */
function sprite(key, profile, size = 96, aspect = 1) {
  const id = `${key}:${size}:${aspect}`;
  const hit = SPRITES.get(id);
  if (hit) return hit;
  const w = Math.round(size * Math.max(1, aspect));
  const h = Math.round(size / Math.min(1, aspect));
  const px = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const r = Math.hypot(((x + 0.5) / w) * 2 - 1, ((y + 0.5) / h) * 2 - 1);
      px[y * w + x] = Math.round(255 * Math.min(1, Math.max(0, profile(r))));
    }
  }
  const uri = pngUri(encodePng(px, w, h, 1));
  SPRITES.set(id, uri);
  return uri;
}

/** The sprites flares and leaks are drawn from. */
const GLOW = () => sprite('glow', (r) => Math.exp(-6 * r * r) * (1 - smoothstep(0.85, 1, r)));
const GHOST = () => sprite('ghost', (r) => (1 - smoothstep(0.78, 0.96, r)) * (0.55 + 0.45 * smoothstep(0.3, 0.9, r)));
const RING = () => sprite('ring', (r) => Math.exp(-(((r - 0.86) / 0.05) ** 2)));
const SOFT = () => sprite('soft', (r) => 1 - smoothstep(0, 1, r));
const STREAK = () => sprite('streak', (r) => Math.exp(-5 * r * r) * (1 - smoothstep(0.9, 1, r)), 64, 8);

/**
 * One sprite placed and tinted: an feImage over a box, its grey becoming
 * the alpha of a colour (light, for adding up).
 *
 * @param {string} href
 * @param {{ x: number, y: number, width: number, height: number }} box
 * @param {[number, number, number]} c - 0–1 channels.
 * @param {number} o - Opacity.
 * @param {string} result
 * @returns {string}
 */
function light(href, box, c, o, result) {
  return `<feImage${attrs({ href, ...box, preserveAspectRatio: 'none' })}/>`
    + `<feColorMatrix type="matrix" values="${mat([0, 0, 0, 0, c[0], 0, 0, 0, 0, c[1], 0, 0, 0, 0, c[2], o, 0, 0, 0, 0])}" color-interpolation-filters="sRGB" result="${result}"/>`;
}

/**
 * Lights added together, screened over the layer and kept to its shape.
 *
 * @param {string[]} names - Their results.
 * @returns {string}
 */
function screenOn(names) {
  let out = '';
  let acc = names[0];
  for (let i = 1; i < names.length; i++) {
    out += `<feComposite in="${acc}" in2="${names[i]}" operator="arithmetic" k2="1" k3="1" result="la${i}"/>`;
    acc = `la${i}`;
  }
  return `${out}<feBlend in="${acc}" in2="SourceGraphic" mode="screen"/><feComposite in2="SourceAlpha" operator="in"/>`;
}

/**
 * `vignette`: `shape` (`'ellipse'` following the canvas, `'circle'`, or
 * `'rect'`, a soft rounded rectangle), `size` (where it starts, 0–1 of
 * the way to the corners), `softness` (0–1), `amount` (0–1) and `color`
 * (black; white for a faded print), about `center`.
 *
 * @param {import('./index.js').Effect & { kind: 'vignette' }} fx
 * @param {import('../render/context.js').RenderContext} ctx
 * @returns {string}
 */
export function vignette(fx, ctx) {
  const { width: W, height: H } = ctx;
  const shape = fx.shape ?? 'ellipse';
  if (!['ellipse', 'circle', 'rect'].includes(shape)) throw new TypeError(`Unknown vignette shape "${shape}" (ellipse, circle, rect)`);
  const size = fx.size ?? 0.55;
  const soft = Math.max(0.02, fx.softness ?? 0.6);
  const [cx, cy] = fraction(/** @type {any} */ (fx.center), [0.5, 0.5]);
  // The image covers the canvas; distance 1 is a corner (from the centre).
  const n = 128;
  const ax = shape === 'circle' ? Math.max(W, H) / Math.hypot(W, H) * Math.SQRT2 : 1;
  const px = new Uint8Array(n * n);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      let u = ((i + 0.5) / n - cx) * 2;
      let v = ((j + 0.5) / n - cy) * 2;
      if (shape === 'circle') { u *= (W / Math.max(W, H)) * ax; v *= (H / Math.max(W, H)) * ax; }
      const d = shape === 'rect' ? (Math.abs(u) ** 6 + Math.abs(v) ** 6) ** (1 / 6) : Math.hypot(u, v) / Math.SQRT2;
      px[j * n + i] = Math.round(255 * smoothstep(size, size + soft * (1.15 - size) + 0.05, d));
    }
  }
  const [r, g, b] = rgb(fx.color ?? '#000000');
  const a = fx.amount ?? 0.6;
  return `<feImage${attrs({ href: pngUri(encodePng(px, n, n, 1)), x: 0, y: 0, width: W, height: H, preserveAspectRatio: 'none' })}/>`
    + `<feColorMatrix type="matrix" values="${mat([0, 0, 0, 0, r, 0, 0, 0, 0, g, 0, 0, 0, 0, b, a, 0, 0, 0, 0])}" color-interpolation-filters="sRGB" result="vg"/>`
    + '<feComposite in="vg" in2="SourceGraphic" operator="atop"/>';
}

/**
 * `lightLeak`: warm light fogging the film from an `edge` (`'left'`,
 * `'right'`, `'top'`, `'bottom'`, or seeded), a few soft blobs in
 * `colors`, screened on at `intensity`.
 *
 * @param {import('./index.js').Effect & { kind: 'lightLeak' }} fx
 * @param {import('../render/context.js').RenderContext} ctx
 * @returns {string}
 */
export function lightLeak(fx, ctx) {
  const { width: W, height: H } = ctx;
  const rng = createRng(`leak:${fx.seed ?? ctx.rng.int(1, 9999)}`);
  const edge = fx.edge ?? rng.pick(['left', 'right', 'top', 'bottom']);
  if (!['left', 'right', 'top', 'bottom'].includes(edge)) throw new TypeError(`Unknown lightLeak edge "${edge}" (left, right, top, bottom)`);
  const colors = (fx.colors ?? ['#ff4d1a', '#ff9a2e', '#ffd36b', '#ff2a5c']).map(rgb);
  const k = fx.intensity ?? 0.85;
  const across = edge === 'left' || edge === 'right';
  const long = across ? H : W;
  const short = across ? W : H;
  const count = 3 + rng.int(0, 2);
  let out = '';
  const names = [];
  for (let i = 0; i < count; i++) {
    const along = rng.range(-0.1, 1.1) * long;
    const depth = rng.range(-0.18, 0.12) * short;
    const rl = rng.range(0.35, 0.75) * long;
    const rs = rng.range(0.25, 0.55) * short * (i === 0 ? 1.4 : 1);
    const x = across ? (edge === 'left' ? depth : W - depth) : along;
    const y = across ? along : (edge === 'top' ? depth : H - depth);
    const box = across ? { x: x - rs, y: y - rl, width: 2 * rs, height: 2 * rl } : { x: x - rl, y: y - rs, width: 2 * rl, height: 2 * rs };
    out += light(SOFT(), box, colors[i % colors.length], k * rng.range(0.55, 1), `lk${i}`);
    names.push(`lk${i}`);
  }
  // The hot core at the very edge.
  const core = across ? { x: (edge === 'left' ? 0 : W) - short * 0.12, y: rng.range(0.1, 0.6) * H, width: short * 0.24, height: H * 0.5 } : { x: rng.range(0.1, 0.6) * W, y: (edge === 'top' ? 0 : H) - short * 0.12, width: W * 0.5, height: short * 0.24 };
  out += light(GLOW(), core, [1, 0.85, 0.62], k * 0.55, 'lkc');
  names.push('lkc');
  return out + screenOn(names);
}

/**
 * `lensFlare`: a light at `at` (fractions), its glow (`size`), a faint
 * halo ring, ghosts along the line through the centre (seeded sizes and
 * tints), an anamorphic `streak` when asked, all at `intensity` and
 * tinted toward `color`.
 *
 * @param {import('./index.js').Effect & { kind: 'lensFlare' }} fx
 * @param {import('../render/context.js').RenderContext} ctx
 * @returns {string}
 */
export function lensFlare(fx, ctx) {
  const { width: W, height: H } = ctx;
  const rng = createRng(`flare:${fx.seed ?? ctx.rng.int(1, 9999)}`);
  const [fx0, fy0] = fraction(/** @type {any} */ (fx.at), [0.78, 0.22]);
  const sx = fx0 * W;
  const sy = fy0 * H;
  const size = len(fx.size, ctx.canvas, '22vmin');
  const k = fx.intensity ?? 0.8;
  const tint = rgb(fx.color ?? '#ffd9a8');
  /** @param {number} r @returns {[number, number, number]} A tint nudged toward a hue. */
  const nudge = (r) => /** @type {[number, number, number]} */ (tint.map((v, i) => Math.min(1, v * (0.7 + 0.6 * [r, 1 - r, 0.5 + r / 2][i]))));
  const box = (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ r) => ({ x: x - r, y: y - r, width: 2 * r, height: 2 * r });
  let out = light(GLOW(), box(sx, sy, size), tint, k, 'f0');
  const names = ['f0'];
  out += light(GLOW(), box(sx, sy, size * 0.22), [1, 1, 1], k, 'f1');
  names.push('f1');
  out += light(RING(), box(sx, sy, size * 1.6), nudge(0.7), k * 0.12, 'f2');
  names.push('f2');
  // Ghosts: along the line from the light through the centre and beyond.
  const dx = W / 2 - sx;
  const dy = H / 2 - sy;
  const ghosts = fx.ghosts ?? 6;
  for (let i = 0; i < ghosts; i++) {
    const t = [0.35, 0.62, 0.9, 1.25, 1.55, 1.9, 2.2, 0.15][i % 8] + rng.range(-0.05, 0.05);
    const r = size * rng.range(0.07, 0.32);
    out += light(GHOST(), box(sx + dx * t, sy + dy * t, r), nudge(rng.next()), k * rng.range(0.05, 0.16), `g${i}`);
    names.push(`g${i}`);
  }
  if (fx.streak) {
    const s = typeof fx.streak === 'number' ? fx.streak : 1;
    out += light(STREAK(), { x: sx - W * 0.7 * s, y: sy - size * 0.06, width: W * 1.4 * s, height: size * 0.12 }, [0.75, 0.85, 1], k * 0.7, 'fs');
    names.push('fs');
  }
  return out + screenOn(names);
}
