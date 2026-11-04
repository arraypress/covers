/**
 * The `texture` layer: paper, creases, concrete, speck, wood, folds, dust.
 *
 * @module layers/texture
 */

import { attrs, num } from '../svg.js';
import { len } from '../geometry.js';
import { toHex } from '../color.js';
import { pos, wrap } from './util.js';


/**
 * `texture` — a surface laid over (or under) the artwork: `paper` (fibres),
 * `creases` (pasted paper lit from the side; soft-light), `concrete`,
 * `speck` (white specks), `wood`, `folds` (straight fold lines with a lit
 * and a shaded side), `dust` (seeded specks of dirt). `color`, `opacity`,
 * `blend`, `frequency`, `octaves` and `region` adjust it.
 *
 * @param {any} layer
 * @param {import('../layers.js').RenderContext} ctx
 * @returns {import('../layers.js').Markup}
 */
export function texture(layer, ctx) {
  const { width: w, height: h, rng } = ctx;
  const kind = layer.kind ?? 'paper';
  const id = `${ctx.id}t`;
  const seed = layer.seed ?? rng.int(1, 9999);
  const rgb = (/** @type {string} */ c) => [1, 3, 5].map((i) => num(parseInt(toHex(c).slice(i, i + 2), 16) / 255, 3));
  const f = (/** @type {any} */ v, /** @type {string} */ d) => (v == null ? d : [].concat(v).map((x) => num(x, 4)).join(' '));
  const rect = (/** @type {string} */ extra = '') => `<rect${attrs({ width: w, height: h, filter: `url(#${id})` })}${extra}/>`;
  const region = `${attrs({ id, x: 0, y: 0, width: w, height: h, filterUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB' })}`;
  let defs = '';
  let body = '';
  let blend = layer.blend;
  let opacity = layer.opacity;
  // Feature sizes are tuned on a 400 px wide sheet; scale with the canvas.
  const k = 400 / Math.min(w, h * 0.8);
  const fq = (/** @type {number[]} */ ...v) => v.map((x) => x * k);
  switch (kind) {
    case 'paper': {
      const [r, g, b] = rgb(layer.color ?? '#73664d');
      defs = `<filter${region}><feTurbulence type="fractalNoise" baseFrequency="${f(layer.frequency, fq(0.55, 0.3).map((x) => num(x, 4)).join(' '))}" numOctaves="${layer.octaves ?? 3}" seed="${seed}"/><feColorMatrix type="matrix" values="0 0 0 0 ${r}  0 0 0 0 ${g}  0 0 0 0 ${b}  0 0 0 -0.9 ${num(0.5 * (layer.amount ?? 1), 3)}"/></filter>`;
      body = rect();
      break;
    }
    case 'creases':
      defs = `<filter${region}><feTurbulence type="turbulence" baseFrequency="${f(layer.frequency, fq(0.006, 0.022).map((x) => num(x, 4)).join(' '))}" numOctaves="${layer.octaves ?? 3}" seed="${seed}" result="t"/><feDiffuseLighting in="t" surfaceScale="${num(layer.depth ?? 3.4, 3)}" lighting-color="#fff" result="lit"><feDistantLight azimuth="${layer.azimuth ?? 225}" elevation="${layer.elevation ?? 38}"/></feDiffuseLighting><feColorMatrix in="lit" type="saturate" values="0"/></filter>`;
      body = rect();
      blend ??= 'soft-light';
      opacity ??= 0.95;
      break;
    case 'concrete': {
      const [r, g, b] = rgb(layer.color ?? '#857f7a');
      defs = `<filter${region}><feTurbulence type="fractalNoise" baseFrequency="${f(layer.frequency, fq(0.035, 0.05).map((x) => num(x, 4)).join(' '))}" numOctaves="${layer.octaves ?? 4}" seed="${seed}"/><feColorMatrix type="matrix" values="0 0 0 0 ${r}  0 0 0 0 ${g}  0 0 0 0 ${b}  0.6 0.6 0.6 0 -0.4"/></filter>`;
      body = rect();
      break;
    }
    case 'speck': {
      const [r, g, b] = rgb(layer.color ?? '#ffffff');
      defs = `<filter${region}><feTurbulence type="fractalNoise" baseFrequency="${f(layer.frequency, num(0.7 * k, 4))}" numOctaves="1" seed="${seed}"/><feColorMatrix type="matrix" values="0 0 0 0 ${r}  0 0 0 0 ${g}  0 0 0 0 ${b}  0 0 0 -12 7.3"/></filter>`;
      body = rect();
      opacity ??= 0.25;
      break;
    }
    case 'wood': {
      const [r, g, b] = rgb(layer.color ?? '#6b4224');
      defs = `<filter${region}><feTurbulence type="fractalNoise" baseFrequency="${f(layer.frequency, fq(0.006, 0.16).map((x) => num(x, 4)).join(' '))}" numOctaves="${layer.octaves ?? 4}" seed="${seed}"/><feColorMatrix type="matrix" values="0 0 0 0 ${r}  0 0 0 0 ${g}  0 0 0 0 ${b}  1.4 0 0 0 -0.45"/></filter>`;
      body = rect();
      break;
    }
    case 'folds': {
      // Straight folds: a lit side and a shaded side either side of each line.
      const xs = layer.x ?? [];
      const ys = layer.y ?? (layer.x ? [] : [0.5]);
      const bw = len(layer.width, ctx.canvas, '1.6vmin');
      const strength = layer.strength ?? 0.35;
      const band = (/** @type {boolean} */ vertical, /** @type {number} */ at, /** @type {number} */ i) => {
        const gid = `${id}${vertical ? 'v' : 'h'}${i}`;
        const p = vertical ? at * w : at * h;
        defs += `<linearGradient${attrs({ id: gid, gradientUnits: 'userSpaceOnUse', x1: vertical ? p - bw : 0, y1: vertical ? 0 : p - bw, x2: vertical ? p + bw : 0, y2: vertical ? 0 : p + bw })}><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="0.48" stop-color="#000" stop-opacity="${num(strength, 3)}"/><stop offset="0.52" stop-color="#fff" stop-opacity="${num(strength * 1.4, 3)}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`;
        body += vertical ? `<rect${attrs({ x: p - bw, y: 0, width: bw * 2, height: h, fill: `url(#${gid})` })}/>` : `<rect${attrs({ x: 0, y: p - bw, width: w, height: bw * 2, fill: `url(#${gid})` })}/>`;
      };
      xs.forEach((/** @type {number} */ x, /** @type {number} */ i) => band(true, x, i));
      ys.forEach((/** @type {number} */ y, /** @type {number} */ i) => band(false, y, i));
      blend ??= 'soft-light';
      break;
    }
    case 'dust': {
      const n = layer.count ?? 70;
      const c = toHex(layer.color ?? ctx.palette.text);
      const [lo, hi] = (layer.size ?? ['0.06vmin', '0.26vmin']).map((/** @type {any} */ v) => len(v, ctx.canvas));
      for (let i = 0; i < n; i++) body += `<circle${attrs({ cx: rng.next() * w, cy: rng.next() * h, r: lo + rng.next() * (hi - lo) })}/>`;
      body = `<g fill="${c}">${body}</g>`;
      break;
    }
    default:
      throw new TypeError(`Unknown texture "${kind}" (paper, creases, concrete, speck, wood, folds, dust)`);
  }
  if (layer.region) {
    const rg = layer.region;
    defs += `<clipPath id="${id}c"><rect${attrs({ x: pos(rg.x ?? 0, 'x', ctx.canvas), y: pos(rg.y ?? 0, 'y', ctx.canvas), width: pos(rg.width ?? '100%', 'x', ctx.canvas), height: pos(rg.height ?? '100%', 'y', ctx.canvas) })}/></clipPath>`;
    body = `<g clip-path="url(#${id}c)">${body}</g>`;
  }
  return { defs, body: wrap({ blend, opacity }, body) };
}
