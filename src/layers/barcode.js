/**
 * The `barcode` layer.
 *
 * @module layers/barcode
 */

import { attrs, num } from '@arraypress/image-effects/svg';
import { len } from '@arraypress/image-effects/length';
import { toHex } from '@arraypress/image-effects/color';
import { faceFor, setLine } from '../type/line.js';
import { pos, wrap, contentOf } from './util.js';
import { code128 } from './code128.js';

/**
 * `barcode` — a real Code 128 barcode of `value` (scannable at print
 * sizes), or `kind: 'seeded'` decorative bars. `x`, `y`, `width`, `height`
 * in px; `color`; `text: true` (the value under it) or any text; `quiet`
 * zones are left to you.
 *
 * @param {any} layer
 * @param {import('../layers.js').RenderContext} ctx
 * @returns {Promise<import('../layers.js').Markup>}
 */
export async function barcode(layer, ctx) {
  const x = pos(layer.x ?? '10%', 'x', ctx.canvas);
  const y = pos(layer.y ?? '80%', 'y', ctx.canvas);
  const w = layer.width != null ? pos(layer.width, 'x', ctx.canvas) : ctx.width * 0.3;
  const h = layer.height != null ? pos(layer.height, 'y', ctx.canvas) : ctx.height * 0.08;
  const color = layer.color ? toHex(layer.color) : ctx.palette.text;
  /** @type {number[]} */
  let widths;
  if (layer.kind === 'seeded') {
    widths = [];
    let total = 0;
    const target = 100;
    while (total < target) {
      const bar = ctx.rng.pick([0.7, 1.1, 1.6, 2.3]);
      const gap = ctx.rng.pick([0.7, 1.1, 1.7]);
      widths.push(bar, gap);
      total += bar + gap;
    }
    widths.pop();
  } else {
    widths = code128(String(layer.value ?? contentOf(layer.content) ?? '0000'));
  }
  const total = widths.reduce((a, b) => a + b, 0);
  const k = w / total;
  let d = '';
  let at = x;
  widths.forEach((m, i) => {
    if (i % 2 === 0) d += `M${num(at, 3)} ${num(y)}h${num(m * k, 3)}v${num(h)}h${num(-m * k, 3)}Z`;
    at += m * k;
  });
  let body = `<path${attrs({ d, fill: color })}/>`;
  if (layer.text) {
    const label = layer.text === true ? String(layer.value ?? '') : String(layer.text);
    const size = len(layer.size, ctx.canvas, h * 0.18);
    const face = await faceFor(ctx, { font: layer.font, weight: layer.weight ?? 400 });
    const line = setLine({ face, text: label, size, tracking: (layer.letterSpacing ?? 0.1) * size, x: x + w / 2, y: y + h + size * 1.1, align: 'center' });
    body += `<path${attrs({ d: line.d, fill: color })}/>`;
  }
  return { defs: '', body: wrap(layer, body) };
}
