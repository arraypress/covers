/**
 * Mixed runs in one text layer: `spans`, each with its own font, weight,
 * style, axes, size, colour, tracking and baseline shift, set one after
 * another on the same lines (a `\n` in a span starts a new line).
 *
 * `spans: [{ content, font, weight, style, axes, scale, size, color, letterSpacing, dy }]`;
 * anything a span leaves out comes from the layer. `scale` sizes a span
 * relative to the layer (`size` gives it outright).
 *
 * @module type/spans
 */

import { len } from '../geometry.js';
import { toHex } from '../color.js';
import { faceFor } from './line.js';
import { shapeText } from './fallback.js';

/**
 * @typedef {object} Span
 * @property {string} text
 * @property {import('../fonts.js').LoadedFont} face
 * @property {number} scale - Size relative to the layer's.
 * @property {number} tracking - Em.
 * @property {string | undefined} paint - A colour, or the layer's fill.
 * @property {number} dy - Baseline shift, px at the layer's size (scales with it).
 */

/**
 * Resolve a layer's spans: faces loaded, sizes as multiples of the layer's.
 *
 * @param {any} layer
 * @param {import('../layers.js').RenderContext} ctx
 * @param {number} size - The layer's size, px.
 * @returns {Promise<Span[]>}
 */
export async function loadSpans(layer, ctx, size) {
  const out = [];
  for (const given of layer.spans) {
    const s = typeof given === 'string' ? { content: given } : given;
    const face = await faceFor(ctx, { font: s.font ?? layer.font, weight: s.weight ?? layer.weight, style: s.style ?? layer.style, axes: { ...layer.axes, ...s.axes } });
    const kase = s.transform ?? layer.transform;
    const raw = String(s.content ?? '').replace(/[\t\r ]+/g, ' ');
    out.push({
      text: kase === 'uppercase' ? raw.toUpperCase() : kase === 'lowercase' ? raw.toLowerCase() : raw,
      face,
      scale: s.size != null ? len(s.size, ctx.canvas) / size : s.scale ?? 1,
      tracking: s.letterSpacing ?? layer.letterSpacing ?? -0.02,
      paint: s.color ?? (typeof s.fill === 'string' ? s.fill : undefined) ? toHex(s.color ?? s.fill) : undefined,
      dy: len(s.dy, ctx.canvas, 0) / size,
    });
  }
  return out;
}

/**
 * Spans as lines: split at `\n`, then (with a finite `maxWidth`) wrapped at
 * spaces, greedily, at `size`.
 *
 * @param {Span[]} spans
 * @param {number} size
 * @param {number} maxWidth
 * @param {import('../fonts.js').LoadedFont[]} fallbacks
 * @returns {Span[][]}
 */
export function spanLines(spans, size, maxWidth, fallbacks) {
  /** @type {Span[][]} */
  const lines = [[]];
  for (const s of spans) {
    s.text.split('\n').forEach((part, i) => {
      if (i) lines.push([]);
      if (part) lines[lines.length - 1].push({ ...s, text: part });
    });
  }
  if (!Number.isFinite(maxWidth)) return lines;
  /** @type {Span[][]} */
  const out = [];
  for (const line of lines) {
    /** @type {Span[]} */
    let cur = [];
    let width = 0;
    for (const s of line) {
      for (const word of s.text.split(/(?<= )/)) {
        const piece = { ...s, text: word };
        const w = shapeSpans([piece], size, 0, undefined, fallbacks).width;
        if (cur.length && width + w - trailing(piece, size) > maxWidth) {
          out.push(trim(cur));
          cur = [];
          width = 0;
        }
        cur.push(piece);
        width += w;
      }
    }
    out.push(trim(cur));
  }
  return out;
}

/** @param {Span} s @param {number} size @returns {number} The width of a trailing space, px (it may hang past the line). */
const trailing = (s, size) => (s.text.endsWith(' ') ? size * s.scale * 0.25 : 0);

/** @param {Span[]} line @returns {Span[]} The line with its ends' spaces trimmed. */
function trim(line) {
  if (!line.length) return line;
  const out = line.map((s) => ({ ...s }));
  out[0].text = out[0].text.replace(/^ +/, '');
  out[out.length - 1].text = out[out.length - 1].text.replace(/ +$/, '');
  return out.filter((s) => s.text);
}

/**
 * Shape a line of spans as one run: each span in its face and size, its
 * glyphs carrying them (and their colour as a paint key).
 *
 * @param {Span[]} line
 * @param {number} size - The layer's size, px.
 * @param {number} extra - Tracking added everywhere, px (justification).
 * @param {import('../fonts.js').LoadedFont | undefined} base - The layer's face (its glyphs needn't carry it).
 * @param {import('../fonts.js').LoadedFont[]} fallbacks
 * @returns {import('../text.js').Shaped}
 */
export function shapeSpans(line, size, extra, base, fallbacks) {
  /** @type {import('../text.js').Shaped['glyphs']} */
  const glyphs = [];
  let x = 0;
  let at = 0;
  line.forEach((s, i) => {
    const sz = size * s.scale;
    const run = shapeText(s.face, s.text, sz, s.tracking * sz + extra, fallbacks);
    for (const g of run.glyphs) glyphs.push({ ...g, x: g.x + x, y: g.y - s.dy * size, face: g.face ?? s.face, size: sz, paint: s.paint, cluster: (g.cluster ?? 0) + at });
    x += run.width + (i < line.length - 1 ? s.tracking * sz + extra : 0);
    at += s.text.length;
  });
  return { glyphs, width: x };
}

/** @param {Span[]} line @returns {string} The line's text. */
export const spanText = (line) => line.map((s) => s.text).join('');
