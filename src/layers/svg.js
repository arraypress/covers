/**
 * The `svg` layer: raw markup, sanitised, with render-time tokens.
 *
 * @module layers/svg
 */

import { attrs, esc, num } from '../svg.js';
import { unit } from '../geometry.js';
import { pos, wrap } from './util.js';
import { expandDropShadows } from '../effects/drop-shadow.js';
import { filterReach } from '../effects/region.js';


/**
 * Remove what an SVG fragment must never carry: scripts, foreign objects,
 * event handlers and links out (`href`s other than `#…` and `data:`).
 *
 * @param {string} s
 * @returns {string}
 */
export function sanitize(s) {
  return String(s)
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<script\b[^>]*\/>/gi, '')
    .replace(/<foreignObject\b[\s\S]*?<\/foreignObject\s*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s(xlink:)?href\s*=\s*("|')(?!#|data:)[^"']*\2/gi, '');
}

/** Elements a markup slot may carry (shapes and groups). */
const SHAPES = new Set(['g', 'path', 'circle', 'ellipse', 'rect', 'polygon', 'polyline', 'line']);

/** Attributes a markup slot may carry. */
const SHAPE_ATTRS = new Set(['d', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'width', 'height', 'points', 'x1', 'y1', 'x2', 'y2', 'transform', 'fill', 'stroke', 'stroke-width', 'opacity', 'fill-opacity', 'stroke-opacity', 'fill-rule', 'clip-rule', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset']);

/**
 * Shapes from a slot's markup (a mark's paths): `g`, `path`, `circle`,
 * `ellipse`, `rect`, `polygon`, `polyline` and `line` with their geometry
 * and paint attributes are kept; any other element is escaped (inert
 * text), and other attributes dropped. Paint can't reference anything
 * outside (`url(…)` is dropped).
 *
 * @param {string} markup
 * @returns {string}
 */
export function shapesOnly(markup) {
  return String(markup).replace(/<\/?([a-zA-Z][\w:-]*)([^>]*)>/g, (tag, name, rest) => {
    if (!SHAPES.has(name)) return tag.replace(/[&<>"']/g, (ch) => /** @type {Record<string, string>} */ ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
    if (tag.startsWith('</')) return `</${name}>`;
    const self = /\/\s*$/.test(rest);
    let kept = '';
    for (const m of rest.matchAll(/([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) {
      const value = m[3] ?? m[4];
      if (SHAPE_ATTRS.has(m[1]) && !/url\s*\(|javascript:/i.test(value)) kept += ` ${m[1]}="${esc(value)}"`;
    }
    return `<${name}${kept}${self ? '/' : ''}>`;
  });
}

/**
 * Replace render-time tokens in markup: `{{@accent}}` and the other palette
 * and canvas tokens, `{{id}}` (a prefix unique to this layer, for ids in
 * `defs`), and `{{seed}}` (a seeded number).
 *
 * @param {string} s @param {import('../layers.js').RenderContext} ctx
 * @returns {string}
 */
function tokens(s, ctx) {
  const p = /** @type {any} */ (ctx.palette);
  return s.replace(/\{\{\s*([@\w.]+)\s*\}\}/g, (m, k) => {
    if (k === 'id') return ctx.id;
    if (k === 'seed') return String(ctx.rng.int(1, 9999));
    if (k.startsWith('@')) {
      const [head, idx] = k.slice(1).split('.');
      if (head === 'width' || head === 'height') return num(ctx[head]);
      if (head === 'u') return num(unit(ctx.canvas));
      if (head === 'colors') return esc(p.colors[Number(idx ?? 0) % p.colors.length]);
      if (Object.hasOwn(p, head)) return esc(String(p[head]));
    }
    return m;
  });
}

/**
 * `svg` — raw SVG markup, the escape hatch for anything too bespoke for a
 * layer. `markup` is drawn in the layer's canvas, or from a `viewBox` into
 * a box (`x`, `y`, `width`, `height`, `fit`); `defs` go in the document's
 * defs. Palette and canvas tokens are written `{{@accent}}`, `{{@colors.1}}`,
 * `{{@width}}`; `{{id}}` prefixes ids; in a JSON recipe `{{title}}` and any
 * other option is filled in (escaped) too. Scripts, event handlers and
 * external links are stripped.
 *
 * @param {any} layer
 * @param {import('../layers.js').RenderContext} ctx
 * @returns {import('../layers.js').Markup}
 */
export function svg(layer, ctx) {
  const markup = expandDropShadows(sanitize(tokens(String(layer.markup ?? ''), ctx)));
  const defs = layer.defs ? expandDropShadows(sanitize(tokens(String(layer.defs), ctx))) : '';
  /** @type {any} */ (ctx).noteReach?.(filterReach(defs + markup) * (/** @type {any} */ (ctx).res ?? 1));
  let body = markup;
  if (layer.viewBox) {
    const vb = Array.isArray(layer.viewBox) ? layer.viewBox : String(layer.viewBox).split(/[\s,]+/).map(Number);
    const fit = layer.fit ?? 'contain';
    const par = fit === 'stretch' ? 'none' : `${layer.align ?? 'xMidYMid'} ${fit === 'cover' ? 'slice' : 'meet'}`;
    body = `<svg${attrs({ x: pos(layer.x ?? 0, 'x', ctx.canvas), y: pos(layer.y ?? 0, 'y', ctx.canvas), width: layer.width != null ? pos(layer.width, 'x', ctx.canvas) : ctx.width, height: layer.height != null ? pos(layer.height, 'y', ctx.canvas) : ctx.height, viewBox: vb.map((/** @type {number} */ v) => num(v, 3)).join(' '), preserveAspectRatio: par, overflow: 'visible' })}>${markup}</svg>`;
  }
  return { defs, body: wrap(layer, body) };
}
