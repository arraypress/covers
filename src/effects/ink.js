/**
 * Ink and print effects: displacement (rough, warp), riso drum wear,
 * photocopied vector ink, and grit.
 *
 * @module effects/ink
 */

import { num } from '../svg.js';
import { len } from '../geometry.js';
import { mat, seedOf, displace } from './util.js';

/**
 * `rough` (a fine wobble) and `warp` (a melting distortion).
 *
 * @param {import('./index.js').Effect & { kind: 'rough' | 'warp' }} fx
 * @param {import('../layers.js').RenderContext} ctx
 * @returns {string}
 */
export function rough(fx, ctx) {
  const warp = fx.kind === 'warp';
  return displace(fx.frequency ?? (warp ? [0.005, 0.011] : 0.9), fx.octaves ?? 2, seedOf(ctx, fx), len(fx.scale, ctx.canvas, warp ? '8vmin' : '0.26vmin'));
}

/**
 * `wear`: riso drum wear. Edges a touch rough (`rough`), coverage uneven
 * (`uneven`), specks where the drum missed (`specks`).
 *
 * @param {import('./index.js').Effect & { kind: 'wear' }} fx
 * @param {import('../layers.js').RenderContext} ctx
 * @returns {string}
 */
export function wear(fx, ctx) {
  const uneven = fx.uneven ?? 0.4;
  const specks = fx.specks ?? 1;
  const s1 = seedOf(ctx, fx);
  const s2 = ctx.rng.int(1, 9999);
  const s3 = ctx.rng.int(1, 9999);
  return displace(0.9, 2, s1, len(fx.rough, ctx.canvas, '0.26vmin'), 'rough')
    + `<feTurbulence type="fractalNoise" baseFrequency="0.02 0.05" numOctaves="3" seed="${s2}" result="lo"/>`
    + `<feColorMatrix in="lo" type="matrix" values="${mat([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, uneven, 0, 0, 0, 1.16 - uneven])}" result="even"/>`
    + `<feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="1" seed="${s3}" result="sp"/>`
    + `<feColorMatrix in="sp" type="matrix" values="${mat([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -16 * specks, 13.2 + (1 - specks) * 3])}" result="holes"/>`
    + '<feComposite in="even" in2="holes" operator="arithmetic" k1="1" result="cover"/><feComposite in="rough" in2="cover" operator="in"/>';
}

/**
 * `xerox`: photocopied vector ink, a wobble and toner dropout.
 *
 * @param {import('./index.js').Effect & { kind: 'xerox' }} fx
 * @param {import('../layers.js').RenderContext} ctx
 * @returns {string}
 */
export function xerox(fx, ctx) {
  const s1 = seedOf(ctx, fx);
  const s2 = ctx.rng.int(1, 9999);
  return displace(1.1, 2, s1, len(fx.rough, ctx.canvas, '0.32vmin'), 'w')
    + `<feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="1" seed="${s2}" result="d"/><feColorMatrix in="d" type="matrix" values="${mat([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -14, 10.6 + (fx.dropout != null ? (0.5 - fx.dropout) * 4 : 0)])}" result="h"/><feComposite in="w" in2="h" operator="in"/>`;
}

/**
 * `grit`: noise added to the colour (`amount`), kept inside the source.
 *
 * @param {import('./index.js').Effect & { kind: 'grit' }} fx
 * @param {import('../layers.js').RenderContext} ctx
 * @returns {string}
 */
export function grit(fx, ctx) {
  const a = fx.amount ?? 0.14;
  return `<feTurbulence type="fractalNoise" baseFrequency="${num(fx.frequency ?? 0.9, 3)}" numOctaves="1" seed="${seedOf(ctx, fx)}" result="g"/><feComposite in="SourceGraphic" in2="g" operator="arithmetic" k2="1" k3="${num(a, 3)}" k4="${num(-a / 2, 3)}"/><feComposite in2="SourceAlpha" operator="in"/>`;
}
