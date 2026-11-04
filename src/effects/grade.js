/**
 * Colour grading, as SVG filters: `curves` (a smooth tone curve through
 * points, per channel too), `gradientMap` (tones mapped through a
 * gradient of any number of stops), `posterize`, `invert`, `hue` (hue,
 * saturation and lightness), `colorBalance` (shadows, midtones and
 * highlights pushed toward a colour), `channelMixer` and `sepia`; and
 * `vibrance` on pixels (it weighs each pixel by how saturated it already
 * is, which no colour matrix can).
 *
 * @module effects/grade
 */

import { num } from '../svg.js';
import { mixOklab, toHex } from '../color.js';
import { LUMA, rgb, mat } from './util.js';

/** Entries in a tone table (the filter interpolates between them). */
const TABLE = 128;

/**
 * A monotone cubic through points (Fritsch–Carlson), sampled as a table.
 *
 * @param {[number, number][]} points - `[input, output]`, 0–1.
 * @param {number} [n=TABLE]
 * @returns {number[]}
 */
export function curveTable(points, n = TABLE) {
  const p = [...points].map(([x, y]) => [Number(x), Number(y)]).sort((a, b) => a[0] - b[0]);
  if (p.length === 0) return Array.from({ length: n }, (_, i) => i / (n - 1));
  if (p.length === 1) return Array.from({ length: n }, () => p[0][1]);
  const k = p.length;
  const d = [];
  for (let i = 0; i < k - 1; i++) d.push((p[i + 1][1] - p[i][1]) / (p[i + 1][0] - p[i][0] || 1e-9));
  const m = [d[0]];
  for (let i = 1; i < k - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2);
  m.push(d[k - 2]);
  for (let i = 0; i < k - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return Array.from({ length: n }, (_, j) => {
    const x = j / (n - 1);
    if (x <= p[0][0]) return clamp(p[0][1]);
    if (x >= p[k - 1][0]) return clamp(p[k - 1][1]);
    let i = 0;
    while (x > p[i + 1][0]) i++;
    const h = p[i + 1][0] - p[i][0];
    const t = (x - p[i][0]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return clamp((2 * t3 - 3 * t2 + 1) * p[i][1] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * p[i + 1][1] + (t3 - t2) * h * m[i + 1]);
  });
}

/** @param {number} v @returns {number} */
const clamp = (v) => Math.min(1, Math.max(0, v));

/**
 * A component transfer from three tables (R, G, B), alpha untouched.
 *
 * @param {number[][]} tables
 * @returns {string}
 */
export const transfer = (tables) => `<feComponentTransfer>${['R', 'G', 'B'].map((ch, i) => `<feFunc${ch} type="table" tableValues="${tables[i].map((v) => num(v, 4)).join(' ')}"/>`).join('')}</feComponentTransfer>`;

/**
 * `curves`: `points` for all three channels (`[[0, 0], [0.25, 0.2],
 * [0.75, 0.82], [1, 1]]` is an S-curve), and `red`, `green`, `blue` on
 * top of it, each `[input, output]` pairs, 0–1.
 *
 * @param {import('./index.js').Effect & { kind: 'curves' }} fx
 * @returns {string}
 */
export function curves(fx) {
  const master = curveTable(fx.points ?? [[0, 0], [1, 1]]);
  const chan = [fx.red, fx.green, fx.blue].map((pts) => (pts ? curveTable(pts) : null));
  return transfer(chan.map((c) => (c ? master.map((v) => c[Math.round(v * (TABLE - 1))]) : master)));
}

/**
 * `gradientMap`: luminance mapped through a gradient: `colors` (shadows
 * first), at `stops` (0–1, even by default), mixed in `space`
 * (`'srgb'` like Photoshop, or `'oklab'`).
 *
 * @param {import('./index.js').Effect & { kind: 'gradientMap' }} fx
 * @returns {string}
 */
export function gradientMap(fx) {
  const colors = (fx.colors ?? ['#120c2b', '#d6336c', '#ffe9a8']).map((c) => toHex(c));
  const stops = fx.stops ?? colors.map((_, i) => i / Math.max(1, colors.length - 1));
  const lum = `<feColorMatrix type="matrix" values="${mat([...LUMA, 0, 0, ...LUMA, 0, 0, ...LUMA, 0, 0, 0, 0, 0, 1, 0])}"/>`;
  const n = 64;
  const samples = Array.from({ length: n }, (_, j) => sampleGradient(colors, stops, j / (n - 1), fx.space ?? 'srgb'));
  return lum + transfer([0, 1, 2].map((c) => samples.map((s) => s[c])));
}

/**
 * A gradient's colour at `t`, as 0–1 channels.
 *
 * @param {string[]} colors
 * @param {number[]} stops
 * @param {number} t
 * @param {'srgb' | 'oklab'} space
 * @returns {[number, number, number]}
 */
export function sampleGradient(colors, stops, t, space) {
  if (t <= stops[0]) return rgb(colors[0]);
  for (let i = 0; i < colors.length - 1; i++) {
    if (t <= stops[i + 1]) {
      const k = (t - stops[i]) / (stops[i + 1] - stops[i] || 1);
      if (space === 'oklab') return rgb(mixOklab(colors[i], colors[i + 1], k));
      const a = rgb(colors[i]);
      const b = rgb(colors[i + 1]);
      return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
    }
  }
  return rgb(colors[colors.length - 1]);
}

/**
 * `posterize`: `levels` tones per channel.
 *
 * @param {import('./index.js').Effect & { kind: 'posterize' }} fx
 * @returns {string}
 */
export function posterize(fx) {
  const n = Math.max(2, Math.round(fx.levels ?? 4));
  const t = Array.from({ length: n }, (_, i) => num(i / (n - 1), 4)).join(' ');
  return `<feComponentTransfer>${['R', 'G', 'B'].map((ch) => `<feFunc${ch} type="discrete" tableValues="${t}"/>`).join('')}</feComponentTransfer>`;
}

/**
 * `invert`: a negative, `amount` of the way (default 1).
 *
 * @param {import('./index.js').Effect & { kind: 'invert' }} fx
 * @returns {string}
 */
export function invert(fx) {
  const a = fx.amount ?? 1;
  return `<feComponentTransfer>${['R', 'G', 'B'].map((ch) => `<feFunc${ch} type="table" tableValues="${num(a, 4)} ${num(1 - a, 4)}"/>`).join('')}</feComponentTransfer>`;
}

/**
 * `hue`: turn hues by `angle` degrees, `saturation` (-1 grey to 1 double)
 * and `lightness` (-1 black to 1 white), as Photoshop's Hue/Saturation.
 *
 * @param {import('./index.js').Effect & { kind: 'hue' }} fx
 * @returns {string}
 */
export function hue(fx) {
  let out = '';
  if (fx.angle) out += `<feColorMatrix type="hueRotate" values="${num(fx.angle, 3)}"/>`;
  if (fx.saturation) out += `<feColorMatrix type="saturate" values="${num(Math.max(0, 1 + fx.saturation), 4)}"/>`;
  const l = fx.lightness ?? 0;
  if (l) {
    const slope = l > 0 ? 1 - l : 1 + l;
    const icpt = l > 0 ? l : 0;
    out += `<feComponentTransfer>${['R', 'G', 'B'].map((ch) => `<feFunc${ch} type="linear" slope="${num(slope, 4)}" intercept="${num(icpt, 4)}"/>`).join('')}</feComponentTransfer>`;
  }
  return out || '<feOffset dx="0" dy="0"/>';
}

/**
 * How much a tone (0–1) belongs to the shadows, midtones and highlights
 * (GIMP's colour-balance weights).
 *
 * @param {number} v
 * @returns {[number, number, number]}
 */
function zones(v) {
  const a = 0.25;
  const b = 0.333;
  const s = 0.7;
  const shadows = clamp((v - b) / -a + 0.5) * s;
  const mids = clamp((v - b) / a + 0.5) * clamp((v + b - 1) / -a + 0.5) * s;
  const highs = clamp((v + b - 1) / a + 0.5) * s;
  return [shadows, mids, highs];
}

/**
 * The tables of a colour balance: each zone's `[red, green, blue]` push
 * (-1–1; `[0.1, 0, -0.1]` is warmer), per channel.
 *
 * @param {{ shadows?: number[], midtones?: number[], highlights?: number[] }} fx
 * @returns {number[][]}
 */
export function balanceTables(fx) {
  const z = [fx.shadows ?? [0, 0, 0], fx.midtones ?? [0, 0, 0], fx.highlights ?? [0, 0, 0]];
  const n = 64;
  return [0, 1, 2].map((c) => Array.from({ length: n }, (_, j) => {
    const v = j / (n - 1);
    const w = zones(v);
    return clamp(v + 0.5 * (w[0] * (z[0][c] ?? 0) + w[1] * (z[1][c] ?? 0) + w[2] * (z[2][c] ?? 0)));
  }));
}

/**
 * `colorBalance`: `shadows`, `midtones` and `highlights`, each a
 * `[red, green, blue]` push, -1–1 (Photoshop's sliders over 100).
 *
 * @param {import('./index.js').Effect & { kind: 'colorBalance' }} fx
 * @returns {string}
 */
export const colorBalance = (fx) => transfer(balanceTables(fx));

/**
 * `channelMixer`: each output channel as a mix of the inputs, `red`,
 * `green`, `blue` (`[r, g, b]` or `[r, g, b, constant]`); `monochrome`
 * mixes one grey from `gray` (default Rec. 709).
 *
 * @param {import('./index.js').Effect & { kind: 'channelMixer' }} fx
 * @returns {string}
 */
export function channelMixer(fx) {
  const row = (/** @type {number[] | undefined} */ r, /** @type {number[]} */ d) => {
    const v = r ?? d;
    return [v[0] ?? 0, v[1] ?? 0, v[2] ?? 0, 0, v[3] ?? 0];
  };
  if (fx.monochrome) {
    const g = row(fx.gray, LUMA);
    return `<feColorMatrix type="matrix" values="${mat([...g, ...g, ...g, 0, 0, 0, 1, 0])}"/>`;
  }
  return `<feColorMatrix type="matrix" values="${mat([...row(fx.red, [1, 0, 0]), ...row(fx.green, [0, 1, 0]), ...row(fx.blue, [0, 0, 1]), 0, 0, 0, 1, 0])}"/>`;
}

/**
 * `sepia`: the classic brown tone, `amount` of the way (default 1).
 *
 * @param {import('./index.js').Effect & { kind: 'sepia' }} fx
 * @returns {string}
 */
export function sepia(fx) {
  const a = Math.min(1, Math.max(0, fx.amount ?? 1));
  const s = [0.393, 0.769, 0.189, 0.349, 0.686, 0.168, 0.272, 0.534, 0.131];
  const id = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const m = s.map((v, i) => id[i] + (v - id[i]) * a);
  return `<feColorMatrix type="matrix" values="${mat([m[0], m[1], m[2], 0, 0, m[3], m[4], m[5], 0, 0, m[6], m[7], m[8], 0, 0, 0, 0, 0, 1, 0])}"/>`;
}

/**
 * `vibrance` on pixels: saturation raised most where it's lowest (muted
 * colours come up, saturated ones and skin hold), `amount` -1–1, then
 * `saturation` evenly, as Lightroom's pair.
 *
 * @param {import('./buffer.js').Pixels} img
 * @param {import('./index.js').Effect & { kind: 'vibrance' }} fx
 * @returns {Uint8ClampedArray}
 */
export function vibrance(img, fx) {
  const d = img.data;
  const v = fx.amount ?? 0.5;
  const s = 1 + (fx.saturation ?? 0);
  const out = new Uint8ClampedArray(d.length);
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = (max - min) / 255;
    // Skin (red above green above blue) is held back.
    const skin = r > g && g > b ? 0.5 : 1;
    const k = s * (1 + v * (1 - sat) * (v > 0 ? skin : 1));
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    out[i] = l + (r - l) * k;
    out[i + 1] = l + (g - l) * k;
    out[i + 2] = l + (b - l) * k;
    out[i + 3] = d[i + 3];
  }
  return out;
}
