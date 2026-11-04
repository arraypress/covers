/**
 * Film and paper: `grain` (film grain as a filter, overlaid so it lives in
 * the midtones as real grain does; monochrome or colour), `paper` (the
 * layer printed on paper or canvas: a lit relief overlaid) and `dust`
 * (specks, hairs and scratches, seeded, drawn on pixels).
 *
 * @module effects/film
 */

import { attrs, num } from '../svg.js';
import { len } from '../geometry.js';
import { encodePng, pngUri } from '../png.js';
import { createRng } from '../rng.js';
import { mat, seedOf } from './util.js';
import { px, seedFor } from './buffer.js';

/**
 * `grain`: film grain, `amount` (0–1), `size` (a length: the grain), and
 * `color` (true: each channel its own grain, as colour film; default
 * monochrome). Overlaid, so it's strongest in the midtones.
 *
 * @param {import('./index.js').Effect & { kind: 'grain' }} fx
 * @param {import('../render/context.js').RenderContext} ctx
 * @returns {string}
 */
export function grain(fx, ctx) {
  const size = Math.max(0.05, len(fx.size, ctx.canvas, '0.09vmin'));
  const a = (fx.amount ?? 0.35) * 1.5;
  const mono = !fx.color;
  // Noise centred on mid-grey with its spread set by amount.
  const row = (/** @type {number} */ c) => (mono ? [a, 0, 0, 0, 0.5 - a / 2] : [c === 0 ? a : 0, c === 1 ? a : 0, c === 2 ? a : 0, 0, 0.5 - a / 2]);
  return `<feTurbulence type="fractalNoise" baseFrequency="${num(0.5 / size, 4)}" numOctaves="2" seed="${seedOf(ctx, fx)}" result="gn"/>`
    + `<feColorMatrix in="gn" type="matrix" values="${mat([...row(0), ...row(1), ...row(2), 0, 0, 0, 0, 1])}" result="gc"/>`
    + '<feBlend in="gc" in2="SourceGraphic" mode="overlay"/><feComposite in2="SourceAlpha" operator="in"/>';
}

/** @type {Map<string, string>} */
const WEAVES = new Map();

/**
 * A tile of canvas weave as heights: over-under threads, 2×2 to the tile.
 *
 * @returns {string} A data URI.
 */
function weave() {
  const hit = WEAVES.get('w');
  if (hit) return hit;
  const n = 32;
  const out = new Uint8Array(n * n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const u = (x + 0.5) / n;
      const v = (y + 0.5) / n;
      // Warp and weft threads, each a rounded ridge; which is on top alternates.
      const warp = Math.cos(Math.PI * ((u * 2) % 1 - 0.5)) ** 0.6;
      const weft = Math.cos(Math.PI * ((v * 2) % 1 - 0.5)) ** 0.6;
      const top = (Math.floor(u * 2) + Math.floor(v * 2)) % 2 === 0;
      out[y * n + x] = Math.round(255 * (top ? 0.25 + 0.75 * warp * (0.6 + 0.4 * weft) : 0.25 + 0.75 * weft * (0.6 + 0.4 * warp)));
    }
  }
  const uri = pngUri(encodePng(out, n, n, 1));
  WEAVES.set('w', uri);
  return uri;
}

/**
 * `paper`: printed on a surface. `texture` `'paper'` (fibrous, uneven) or
 * `'canvas'` (a woven tooth), `scale` (a length: the fibres, or a thread
 * pair), `amount` (0–1), lit from `angle`; the lit relief is overlaid.
 *
 * @param {import('./index.js').Effect & { kind: 'paper' }} fx
 * @param {import('../render/context.js').RenderContext} ctx
 * @returns {string}
 */
export function paper(fx, ctx) {
  const texture = fx.texture ?? 'paper';
  if (texture !== 'paper' && texture !== 'canvas') throw new TypeError(`Unknown paper texture "${texture}" (paper, canvas)`);
  const amount = fx.amount ?? 0.5;
  const az = fx.angle ?? 225;
  let relief;
  if (texture === 'canvas') {
    const s = len(fx.scale, ctx.canvas, '0.9vmin');
    relief = `<feImage${attrs({ href: weave(), x: 0, y: 0, width: s, height: s, preserveAspectRatio: 'none', result: 'pt' })}/><feTile in="pt"/>`
      + '<feColorMatrix type="luminanceToAlpha" color-interpolation-filters="sRGB" result="ph"/>';
  } else {
    const s = len(fx.scale, ctx.canvas, '0.45vmin');
    relief = `<feTurbulence type="fractalNoise" baseFrequency="${num(1 / s, 4)} ${num(0.6 / s, 4)}" numOctaves="4" seed="${seedOf(ctx, fx)}"/>`
      + '<feColorMatrix type="luminanceToAlpha" color-interpolation-filters="sRGB" result="ph"/>';
  }
  const depth = texture === 'canvas' ? 3 : 2.5;
  // Lit flat, the surface is sin(elevation) grey; that maps to 0.5 (no change under overlay).
  const elev = 50;
  const flat = Math.sin((elev * Math.PI) / 180);
  const k = (texture === 'canvas' ? 0.8 : 0.7) * amount;
  const row = (/** @type {number} */ c) => [c === 0 ? k / flat : 0, c === 1 ? k / flat : 0, c === 2 ? k / flat : 0, 0, 0.5 - k];
  return relief
    + `<feDiffuseLighting in="ph" surfaceScale="${num(depth, 3)}" diffuseConstant="1" lighting-color="#fff" color-interpolation-filters="sRGB" result="pl"><feDistantLight azimuth="${num(az)}" elevation="${elev}"/></feDiffuseLighting>`
    // Lit ridges lighten, shaded ones darken: the relief overlaid.
    + `<feColorMatrix in="pl" type="matrix" values="${mat([...row(0), ...row(1), ...row(2), 0, 0, 0, 0, 1])}" result="pm"/>`
    + '<feBlend in="pm" in2="SourceGraphic" mode="overlay"/><feComposite in2="SourceAlpha" operator="in"/>';
}

/**
 * Stamp an anti-aliased stroke (a polyline of `[x, y]` points) or speck
 * into a coverage buffer.
 *
 * @param {Float32Array} cov
 * @param {number} w
 * @param {number} h
 * @param {[number, number][]} pts
 * @param {number} r - Half-width, px.
 * @param {number} o - Opacity.
 * @returns {void}
 */
function stroke(cov, w, h, pts, r, o) {
  for (let s = 0; s < pts.length - (pts.length > 1 ? 1 : 0); s++) {
    const [x0, y0] = pts[s];
    const [x1, y1] = pts.length > 1 ? pts[s + 1] : pts[s];
    const dx = x1 - x0;
    const dy = y1 - y0;
    const l2 = dx * dx + dy * dy || 1e-9;
    const bx0 = Math.max(0, Math.floor(Math.min(x0, x1) - r - 1));
    const bx1 = Math.min(w - 1, Math.ceil(Math.max(x0, x1) + r + 1));
    const by0 = Math.max(0, Math.floor(Math.min(y0, y1) - r - 1));
    const by1 = Math.min(h - 1, Math.ceil(Math.max(y0, y1) + r + 1));
    for (let y = by0; y <= by1; y++) {
      for (let x = bx0; x <= bx1; x++) {
        const t = Math.max(0, Math.min(1, ((x + 0.5 - x0) * dx + (y + 0.5 - y0) * dy) / l2));
        const d = Math.hypot(x + 0.5 - x0 - t * dx, y + 0.5 - y0 - t * dy);
        const c = Math.max(0, Math.min(1, r + 0.5 - d)) * o;
        const i = y * w + x;
        if (c > cov[i]) cov[i] = c;
      }
    }
  }
}

/**
 * `dust`: dust and scratches on film, seeded: specks (`amount`, 0–1),
 * curling hairs, and `scratches` running down the frame; `color`
 * `'light'` (dust on a negative prints white), `'dark'`, or `'mixed'`.
 *
 * @param {import('./buffer.js').Pixels} img
 * @param {import('./index.js').Effect & { kind: 'dust' }} fx
 * @param {any} ctx
 * @returns {Uint8ClampedArray}
 */
export function dust(img, fx, ctx) {
  const { data, width: w, height: h } = img;
  const rng = createRng(`dust:${seedFor(fx, ctx)}`);
  const unit = px('0.1vmin', ctx, img, 0);
  const amount = fx.amount ?? 0.5;
  const mode = fx.color ?? 'mixed';
  if (!['light', 'dark', 'mixed'].includes(mode)) throw new TypeError(`Unknown dust color "${mode}" (light, dark, mixed)`);
  const light = new Float32Array(w * h);
  const dark = new Float32Array(w * h);
  const pick = () => (mode === 'light' ? light : mode === 'dark' ? dark : rng.chance(0.7) ? light : dark);
  const specks = Math.round(amount * 260);
  for (let i = 0; i < specks; i++) {
    const x = rng.range(0, w);
    const y = rng.range(0, h);
    const r = unit * rng.range(0.3, 1) * (rng.chance(0.08) ? 3.5 : 1);
    // A clump of two or three dots, so specks aren't perfect circles.
    const buf = pick();
    const o = rng.range(0.35, 0.95);
    for (let k = 0, n = rng.int(1, 3); k < n; k++) stroke(buf, w, h, [[x + rng.range(-r, r), y + rng.range(-r, r)]], r * rng.range(0.5, 1), o);
  }
  const hairs = Math.round(amount * 9);
  for (let i = 0; i < hairs; i++) {
    /** @type {[number, number][]} */
    const pts = [[rng.range(0, w), rng.range(0, h)]];
    let a = rng.range(0, Math.PI * 2);
    const seg = unit * rng.range(3, 7);
    for (let k = 0, n = rng.int(12, 40); k < n; k++) {
      a += rng.range(-0.35, 0.35);
      const [px0, py0] = pts[pts.length - 1];
      pts.push([px0 + Math.cos(a) * seg, py0 + Math.sin(a) * seg]);
    }
    stroke(pick(), w, h, pts, unit * rng.range(0.25, 0.5), rng.range(0.5, 0.9));
  }
  const scratches = fx.scratches ?? Math.round(amount * 4);
  for (let i = 0; i < scratches; i++) {
    let x = rng.range(0, w);
    const y0 = rng.chance(0.5) ? 0 : rng.range(0, h * 0.6);
    const y1 = rng.chance(0.5) ? h : rng.range(y0 + h * 0.2, h);
    /** @type {[number, number][]} */
    const pts = [];
    for (let y = y0; y <= y1; y += h / 24) { pts.push([x, y]); x += rng.range(-0.6, 0.6) * unit; }
    stroke(rng.chance(0.75) ? light : dark, w, h, pts, unit * rng.range(0.15, 0.4), rng.range(0.3, 0.7));
  }
  const out = new Uint8ClampedArray(data);
  for (let p = 0, i = 0; p < light.length; p++, i += 4) {
    const l = light[p];
    const d = dark[p];
    if (!l && !d) continue;
    for (let c = 0; c < 3; c++) {
      let v = out[i + c];
      v += (250 - v) * l;
      v -= (v - 12) * d;
      out[i + c] = v;
    }
  }
  return out;
}
