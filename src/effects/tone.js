/**
 * Tone and colour: duotone and tritone ramps, greyscale and levels,
 * saturation, a raw colour matrix, a one-ink threshold, and a photo
 * through a copier.
 *
 * @module effects/tone
 */

import { esc, num } from '../svg.js';
import { LUMA, rgb, mat, flood, seedOf } from './util.js';

/**
 * A linear transfer on R, G and B.
 *
 * @param {number} slope @param {number} intercept
 * @returns {string}
 */
const linear = (slope, intercept) => `<feComponentTransfer>${['R', 'G', 'B'].map((ch) => `<feFunc${ch} type="linear" slope="${num(slope, 3)}" intercept="${num(intercept, 3)}"/>`).join('')}</feComponentTransfer>`;

/**
 * `duotone`: greyscale, optional `contrast`, then a tone ramp through two or
 * more `colors` (shadows first).
 *
 * @param {import('./index.js').Effect & { kind: 'duotone' }} fx
 * @returns {string}
 */
export function duotone(fx) {
  const cols = (fx.colors ?? ['#1b0d06', '#f6e6c4']).map(rgb);
  const pre = fx.contrast != null ? linear(fx.contrast, (1 - fx.contrast) / 2) : '';
  return `<feColorMatrix type="saturate" values="0"/>${pre}<feComponentTransfer>${['R', 'G', 'B'].map((ch, i) => `<feFunc${ch} type="table" tableValues="${cols.map((c) => num(c[i], 3)).join(' ')}"/>`).join('')}</feComponentTransfer>`;
}

/**
 * `grayscale` and `levels`: a linear tone curve (`slope`, `intercept`, or
 * `contrast` and `brightness`), greyscale first for `grayscale`.
 *
 * @param {import('./index.js').Effect & { kind: 'grayscale' | 'levels' }} fx
 * @returns {string}
 */
export function levels(fx) {
  const gray = fx.kind === 'grayscale';
  if (fx.black != null || fx.white != null || fx.gamma != null || fx.output != null) return inputLevels(fx, gray);
  const slope = fx.slope ?? fx.contrast ?? (gray ? 1 : 1.25);
  const intercept = fx.intercept ?? (fx.brightness != null ? fx.brightness : fx.contrast != null ? (1 - fx.contrast) / 2 : gray ? 0 : -0.1);
  return `${gray ? '<feColorMatrix type="saturate" values="0"/>' : ''}${slope !== 1 || intercept !== 0 ? linear(slope, intercept) : ''}`;
}

/**
 * Photoshop's Levels: input `black` and `white` points (0–1), `gamma`
 * for the midtones (above 1 lightens), and an `output` range.
 *
 * @param {any} fx
 * @param {boolean} gray
 * @returns {string}
 */
function inputLevels(fx, gray) {
  const b = fx.black ?? 0;
  const w = Math.max(b + 1e-3, fx.white ?? 1);
  const [lo, hi] = fx.output ?? [0, 1];
  const g = Math.max(0.01, fx.gamma ?? 1);
  const funcs = (/** @type {string} */ f) => ['R', 'G', 'B'].map((ch) => `<feFunc${ch} ${f}/>`).join('');
  return `${gray ? '<feColorMatrix type="saturate" values="0"/>' : ''}<feComponentTransfer>${funcs(`type="linear" slope="${num(1 / (w - b), 4)}" intercept="${num(-b / (w - b), 4)}"`)}</feComponentTransfer>`
    + `<feComponentTransfer>${funcs(`type="gamma" amplitude="${num(hi - lo, 4)}" exponent="${num(1 / g, 4)}" offset="${num(lo, 4)}"`)}</feComponentTransfer>`;
}

/**
 * `saturate`.
 *
 * @param {import('./index.js').Effect & { kind: 'saturate' }} fx
 * @returns {string}
 */
export const saturate = (fx) => `<feColorMatrix type="saturate" values="${num(fx.amount ?? 1.4, 3)}"/>`;

/**
 * `matrix`: a raw 4×5 colour matrix.
 *
 * @param {import('./index.js').Effect & { kind: 'matrix' }} fx
 * @returns {string}
 */
export const matrix = (fx) => `<feColorMatrix type="matrix" values="${esc(Array.isArray(fx.values) ? fx.values.join(' ') : String(fx.values))}"/>`;

/**
 * `threshold`: one ink where the image is darker than `level`, on `paper`
 * (or transparent).
 *
 * @param {import('./index.js').Effect & { kind: 'threshold' }} fx
 * @returns {string}
 */
export function threshold(fx) {
  const ink = rgb(fx.ink ?? '#000000');
  const steps = 64;
  const cut = Math.round((fx.level ?? 0.5) * steps);
  const table = (/** @type {number} */ a, /** @type {number} */ b) => Array.from({ length: steps }, (_, k) => num(k < cut ? a : b, 3)).join(' ');
  if (fx.paper && fx.paper !== 'none') {
    const paper = rgb(fx.paper);
    const lum = `<feColorMatrix type="matrix" values="${mat([...LUMA, 0, 0, ...LUMA, 0, 0, ...LUMA, 0, 0, 0, 0, 0, 1, 0])}"/>`;
    return `${lum}<feComponentTransfer>${['R', 'G', 'B'].map((ch, i) => `<feFunc${ch} type="discrete" tableValues="${table(ink[i], paper[i])}"/>`).join('')}</feComponentTransfer><feComposite in2="SourceAlpha" operator="in"/>`;
  }
  return `<feColorMatrix type="matrix" values="${flood(fx.ink ?? '#000000', [...LUMA, 0, 0])}"/><feComponentTransfer><feFuncA type="discrete" tableValues="${table(1, 0)}"/></feComponentTransfer><feComposite in2="SourceAlpha" operator="in"/>`;
}

/**
 * `photocopy`: a photo through a copier, dark becoming solid `ink` with a
 * noisy hard threshold.
 *
 * @param {import('./index.js').Effect & { kind: 'photocopy' }} fx
 * @param {import('../layers.js').RenderContext} ctx
 * @returns {string}
 */
export function photocopy(fx, ctx) {
  const gain = fx.contrast ?? 0.5;
  const noise = fx.noise ?? 0.9;
  return `<feColorMatrix in="SourceGraphic" type="matrix" values="${mat([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -gain, -gain, -gain, 0, 0.75 + gain + (fx.lift ?? 0)])}" result="ink"/>`
    + `<feTurbulence type="fractalNoise" baseFrequency="${num(fx.frequency ?? 0.85, 3)}" seed="${seedOf(ctx, fx)}" result="n"/><feColorMatrix in="n" type="matrix" values="${mat([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, noise, -noise / 2])}" result="nn"/>`
    + '<feComposite in="ink" in2="nn" operator="arithmetic" k2="1" k3="1"/><feComponentTransfer><feFuncA type="discrete" tableValues="0 0 1 1"/></feComponentTransfer>'
    + `<feColorMatrix type="matrix" values="${flood(fx.ink ?? '#16040d')}"/><feComposite in2="SourceAlpha" operator="in"/>`;
}
