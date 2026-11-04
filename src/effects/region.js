/**
 * Making filters cheap for librsvg (`renderImage`), without changing what
 * they draw:
 *
 * - **Separable morphology.** `feMorphology` is a max/min over a
 *   rectangle, which is the same as a pass along x then one along y;
 *   librsvg does the full rectangle per pixel (O(r²)), the two passes are
 *   O(r). Identical output.
 * - **Content-sized regions.** A filter's region defaults to the canvas
 *   (padded); librsvg works every primitive over all of it. When the
 *   chain's result can only paint where its source does (worked out from
 *   the primitives: floods, turbulence, images and lighting paint
 *   everywhere; `in` composites, blurs and offsets stay with their input),
 *   the region shrinks to the layer's painted box plus the same padding.
 *
 * @module effects/region
 */

import { attrs } from '../svg.js';

/**
 * Split each `feMorphology` into an x pass and a y pass.
 *
 * @param {string} markup
 * @returns {string}
 */
export function separableMorphology(markup) {
  return markup.replace(/<feMorphology\b([^>]*?)\/>/g, (whole, rest) => {
    const r = /\sradius\s*=\s*"([^"]*)"/.exec(rest);
    if (!r) return whole;
    const [rx, ry = rx] = r[1].trim().split(/[\s,]+/).map(Number);
    if (!(rx > 0 && ry > 0)) return whole;
    const result = /\sresult\s*=\s*"([^"]*)"/.exec(rest)?.[1];
    const base = rest.replace(/\s(radius|result)\s*=\s*"[^"]*"/g, '');
    const mid = `${result ?? 'm'}${Math.round(rx * 1000)}x`;
    const second = base.replace(/\sin\s*=\s*"[^"]*"/, '');
    return `<feMorphology${base}${attrs({ radius: `${rx} 0`, result: mid })}/><feMorphology${second}${attrs({ in: mid, radius: `0 ${ry}`, result })}/>`;
  });
}

/** @param {string} svg @param {RegExp} re @returns {number} The largest number a pattern's first group holds. */
function most(svg, re) {
  let m = 0;
  for (const x of svg.matchAll(re)) for (const v of x[1].trim().split(/[\s,]+/)) m = Math.max(m, Math.abs(Number(v)) || 0);
  return m;
}

/**
 * How far filter primitives reach from what they read, in their units:
 * blur (3σ), displacement (half its scale), morphology radius and offsets,
 * added up (an overestimate).
 *
 * @param {string} markup
 * @returns {number}
 */
export function filterReach(markup) {
  return 3 * most(markup, /stdDeviation="([^"]*)"/g)
    + most(markup, /<feDisplacementMap\b[^>]*\sscale="([^"]*)"/g) / 2
    + most(markup, /<feMorphology\b[^>]*\sradius="([^"]*)"/g)
    + most(markup, /<(?:feOffset|feDropShadow)\b[^>]*\sd[xy]="([^"]*)"/g);
}

/** @param {string} s @returns {Record<string, string>} */
const attributesOf = (s) => Object.fromEntries([...s.matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)].map((m) => [m[1], m[2]]));

/**
 * Whether a chain of primitives only paints where its source does (so its
 * region can shrink to the source's box plus padding).
 *
 * @param {string} markup - Filter primitives.
 * @returns {boolean}
 */
export function bounded(markup) {
  /** @type {Map<string, boolean>} */
  const results = new Map([['SourceGraphic', true], ['SourceAlpha', true]]);
  let last = true;
  const input = (/** @type {string | undefined} */ name) => (name == null ? last : results.get(name) ?? false);
  for (const m of markup.matchAll(/<(fe\w+)\b([^>]*?)(\/>|>([\s\S]*?)<\/\1>)/g)) {
    const [, tag, rest, , inner = ''] = m;
    const a = attributesOf(rest);
    let b;
    switch (tag) {
      case 'feFlood': case 'feTurbulence': case 'feImage': case 'feDiffuseLighting': case 'feSpecularLighting': case 'feTile':
        b = false; break;
      case 'feComposite': {
        const i1 = input(a.in);
        const i2 = input(a.in2);
        const op = a.operator ?? 'over';
        if (op === 'in') b = i1 || i2;
        else if (op === 'atop') b = i2;
        else if (op === 'out') b = i1;
        else if (op === 'arithmetic') {
          const k = (/** @type {string} */ n) => Number(a[n] ?? 0);
          b = k('k4') === 0 && (k('k2') === 0 || i1) && (k('k3') === 0 || i2) && (k('k1') === 0 || i1 || i2);
        } else b = i1 && i2;
        break;
      }
      case 'feMerge':
        b = [...inner.matchAll(/<feMergeNode\b([^>]*)\/?>/g)].every((n) => input(attributesOf(n[1]).in));
        break;
      case 'feBlend':
        b = input(a.in) && input(a.in2);
        break;
      case 'feColorMatrix': {
        const v = (a.values ?? '').trim().split(/[\s,]+/).map(Number);
        // A matrix whose alpha row adds a constant can paint where the source is clear.
        b = input(a.in) && !((a.type ?? 'matrix') === 'matrix' && v.length === 20 && v[19] > 0);
        break;
      }
      case 'feComponentTransfer': {
        const fa = /<feFuncA\b([^>]*)\/?>/.exec(inner);
        b = input(a.in) && (!fa || zeroStays(attributesOf(fa[1])));
        break;
      }
      case 'feDisplacementMap':
        b = input(a.in);
        break;
      default:
        // Blur, offset, morphology, convolve: they spread their input (the padding covers it).
        b = input(a.in);
    }
    last = b;
    if (a.result) results.set(a.result, b);
  }
  return last;
}

/** @param {Record<string, string>} f - A feFuncA's attributes. @returns {boolean} Whether alpha 0 stays 0. */
function zeroStays(f) {
  const type = f.type ?? 'identity';
  if (type === 'identity') return true;
  if (type === 'linear') return Number(f.intercept ?? 0) <= 0;
  if (type === 'gamma') return Number(f.offset ?? 0) <= 0;
  const first = Number((f.tableValues ?? '0').trim().split(/[\s,]+/)[0]);
  return first <= 0;
}
