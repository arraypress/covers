/**
 * Small helpers the poster layers share: coordinates in px or `'%'`, the
 * opacity/blend wrapper, and the text of a string-or-object option.
 *
 * @module layers/util
 */

import { attrs, esc } from '@arraypress/image-effects/svg';
import { len } from '@arraypress/image-effects/length';

/**
 * A coordinate: px as a number, `'50%'` of the canvas along `axis`, or a
 * length (`'4vmin'`).
 *
 * @param {unknown} v
 * @param {'x' | 'y'} axis
 * @param {{ width: number, height: number }} canvas
 * @returns {number} px
 */
export function pos(v, axis, canvas) {
  if (typeof v === 'string' && v.trim().endsWith('%')) return (parseFloat(v) / 100) * (axis === 'x' ? canvas.width : canvas.height);
  return len(/** @type {any} */ (v), canvas, 0);
}

/**
 * Opacity and blend-mode attributes shared by every layer.
 *
 * @param {{ opacity?: number, blend?: string }} layer - The layer.
 * @returns {Record<string, string | number | undefined>} Attributes for the layer's group.
 */
export function layerAttrs(layer) {
  return {
    opacity: layer.opacity != null && layer.opacity < 1 ? Math.max(0, layer.opacity) : undefined,
    style: layer.blend && layer.blend !== 'normal' ? `mix-blend-mode:${layer.blend}` : undefined,
  };
}

/**
 * Wrap markup in a group with the layer's `opacity` and `blend` (only when
 * it has them).
 *
 * @param {{ opacity?: number, blend?: string }} layer
 * @param {string} body
 * @returns {string}
 */
export function wrap(layer, body) {
  const a = attrs({ opacity: layer.opacity != null && layer.opacity < 1 ? Math.max(0, layer.opacity) : undefined, style: layer.blend && layer.blend !== 'normal' ? `mix-blend-mode:${esc(layer.blend)}` : undefined });
  return a ? `<g${a}>${body}</g>` : body;
}

/**
 * The text of a string-or-object option (`'Hello'` or `{ content: 'Hello' }`).
 *
 * @param {unknown} v
 * @returns {string | undefined}
 */
export function contentOf(v) {
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (v && typeof v === 'object' && 'content' in v) return /** @type {any} */ (v).content;
  return undefined;
}
