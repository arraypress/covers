/**
 * Detail, as SVG filters (their sizes are lengths, so they look the same
 * at every output size): `sharpen` (an unsharp mask), `edges` (difference
 * of Gaussians: dark lines on white, or glowing edges on black),
 * `emboss` (a relief lit from an angle) and `sketch` (a pencil drawing:
 * the image colour-dodged with its own blurred negative).
 *
 * @module effects/detail
 */

import { num } from '../svg.js';
import { len } from '../geometry.js';
import { LUMA, rgb, mat } from './util.js';

/** A greyscale matrix (luma into R, G and B, alpha kept). */
const GREY = mat([...LUMA, 0, 0, ...LUMA, 0, 0, ...LUMA, 0, 0, 0, 0, 0, 1, 0]);

/**
 * `sharpen`: an unsharp mask, `amount` (1 is strong) at `radius`.
 *
 * @param {import('./index.js').Effect & { kind: 'sharpen' }} fx
 * @param {import('../render/context.js').RenderContext} ctx
 * @returns {string}
 */
export function sharpen(fx, ctx) {
  const a = fx.amount ?? 0.8;
  return `<feGaussianBlur in="SourceGraphic" stdDeviation="${num(len(fx.radius, ctx.canvas, '0.12vmin'), 3)}" result="sb"/>`
    + `<feComposite in="SourceGraphic" in2="sb" operator="arithmetic" k2="${num(1 + a, 3)}" k3="${num(-a, 3)}"/>`;
}

/** Invert R, G and B (alpha kept). */
const NEGATIVE = '<feComponentTransfer><feFuncR type="table" tableValues="1 0"/><feFuncG type="table" tableValues="1 0"/><feFuncB type="table" tableValues="1 0"/></feComponentTransfer>';

/**
 * `a − b` centred on mid-grey, opaque: `0.5 + (a − b) / 2`. (An arithmetic
 * composite of `a` and `−b` would take the alphas' difference too.)
 *
 * @param {string} a @param {string} b @param {string} result
 * @returns {string}
 */
const difference = (a, b, result) => `<feOffset in="${b}" dx="0" dy="0"/>${NEGATIVE}<feComposite in="${a}" operator="arithmetic" k2="0.5" k3="0.5" result="${result}"/>`;

/**
 * A transfer on R, G and B from a function of 0–1, as a table.
 *
 * @param {(v: number) => number} f
 * @returns {string}
 */
function curve(f) {
  const t = Array.from({ length: 33 }, (_, i) => num(Math.min(1, Math.max(0, f(i / 32))), 4)).join(' ');
  return `<feComponentTransfer><feFuncR type="table" tableValues="${t}"/><feFuncG type="table" tableValues="${t}"/><feFuncB type="table" tableValues="${t}"/></feComponentTransfer>`;
}

/**
 * `edges`: difference of Gaussians at `radius`, `amount` strong.
 * `style: 'ink'` (default): dark lines on white, in `color`; `'glow'`:
 * the edges in their own colours on black (Photoshop's Glowing Edges).
 * `mono` greys the layer first.
 *
 * @param {import('./index.js').Effect & { kind: 'edges' }} fx
 * @param {import('../render/context.js').RenderContext} ctx
 * @returns {string}
 */
export function edges(fx, ctx) {
  const r = len(fx.radius, ctx.canvas, '0.1vmin');
  const k = 8 * (fx.amount ?? 1);
  const style = fx.style ?? 'ink';
  if (style !== 'ink' && style !== 'glow') throw new TypeError(`Unknown edges style "${style}" (ink, glow)`);
  const src = fx.mono || style === 'ink' ? `<feColorMatrix in="SourceGraphic" type="matrix" values="${GREY}" result="eg"/>` : '<feOffset in="SourceGraphic" dx="0" dy="0" result="eg"/>';
  const dog = `${src}<feGaussianBlur in="eg" stdDeviation="${num(r, 3)}" result="ea"/><feGaussianBlur in="eg" stdDeviation="${num(r * 2.2, 3)}" result="eb"/>${difference('eb', 'ea', 'ed')}`;
  // Both sides of an edge glow; ink draws where the narrow blur is darker (the line).
  if (style === 'glow') return `${dog}${curve((v) => Math.abs(v - 0.5) * 2 * k)}<feComposite in2="SourceAlpha" operator="in"/>`;
  let out = `${dog}${curve((v) => 1 - (v - 0.5) * 2 * k)}`;
  if (fx.color) {
    const [ir, ig, ib] = rgb(fx.color);
    out += `<feColorMatrix type="matrix" values="${mat([1 - ir, 0, 0, 0, ir, 0, 1 - ig, 0, 0, ig, 0, 0, 1 - ib, 0, ib, 0, 0, 0, 1, 0])}"/>`;
  }
  return `${out}<feComposite in2="SourceAlpha" operator="in"/>`;
}

/**
 * `emboss`: a relief, lit from `angle` (degrees, 0 = from the right,
 * default 135: top-left), `amount` deep, at `radius`. Grey, as
 * Photoshop's; `color: true` overlays it on the layer.
 *
 * @param {import('./index.js').Effect & { kind: 'emboss' }} fx
 * @param {import('../render/context.js').RenderContext} ctx
 * @returns {string}
 */
export function emboss(fx, ctx) {
  const r = len(fx.radius, ctx.canvas, '0.12vmin');
  const a = (((fx.angle ?? 135) + 180) * Math.PI) / 180;
  const dx = Math.cos(a) * r;
  const dy = -Math.sin(a) * r;
  const k = 3 * (fx.amount ?? 1);
  const relief = `<feColorMatrix in="SourceGraphic" type="matrix" values="${GREY}"/><feGaussianBlur stdDeviation="${num(r / 2, 3)}" result="mg"/>`
    + `<feOffset in="mg" dx="${num(dx, 3)}" dy="${num(dy, 3)}" result="m1"/><feOffset in="mg" dx="${num(-dx, 3)}" dy="${num(-dy, 3)}" result="m2"/>`
    + difference('m1', 'm2', 'md') + curve((v) => 0.5 + (v - 0.5) * k)
    + '<feComposite in2="SourceAlpha" operator="in" result="mr"/>';
  return fx.color ? `${relief}<feBlend in="mr" in2="SourceGraphic" mode="overlay"/><feComposite in2="SourceAlpha" operator="in"/>` : relief;
}

/**
 * `sketch`: a pencil drawing. The layer greyed, colour-dodged with its
 * own negative blurred to `radius`, darkened by `darkness` (0–1); `color:
 * true` keeps the layer's colours (coloured pencil).
 *
 * @param {import('./index.js').Effect & { kind: 'sketch' }} fx
 * @param {import('../render/context.js').RenderContext} ctx
 * @returns {string}
 */
export function sketch(fx, ctx) {
  const r = len(fx.radius, ctx.canvas, '0.5vmin');
  const g = 1 + 3 * (fx.darkness ?? 0.4);
  // The darks lifted a little, so they draw as tone rather than solid black.
  const lift = '<feComponentTransfer><feFuncR type="linear" slope="0.82" intercept="0.18"/><feFuncG type="linear" slope="0.82" intercept="0.18"/><feFuncB type="linear" slope="0.82" intercept="0.18"/></feComponentTransfer>';
  const grey = `<feColorMatrix in="SourceGraphic" type="matrix" values="${GREY}"/>${lift}<feOffset dx="0" dy="0" result="kn"/>`;
  const base = fx.color ? `<feOffset in="SourceGraphic" dx="0" dy="0"/>${lift}<feOffset dx="0" dy="0" result="kg"/>` : '<feOffset in="kn" dx="0" dy="0" result="kg"/>';
  return `${grey}${base}<feOffset in="kn" dx="0" dy="0"/>${NEGATIVE}`
    + `<feGaussianBlur stdDeviation="${num(r, 3)}" result="ki"/>`
    + '<feBlend in="ki" in2="kg" mode="color-dodge"/>'
    + `<feComponentTransfer><feFuncR type="gamma" exponent="${num(g, 3)}"/><feFuncG type="gamma" exponent="${num(g, 3)}"/><feFuncB type="gamma" exponent="${num(g, 3)}"/></feComponentTransfer>`
    + '<feComposite in2="SourceAlpha" operator="in"/>';
}
