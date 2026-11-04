/**
 * `feDropShadow` spelled out as the primitives it stands for, so its `in`
 * is honoured (librsvg ignores `in` on `feDropShadow` and shadows the
 * source graphic, which silently drops whatever the chain built before it).
 *
 * @module effects/drop-shadow
 */

import { attrs } from '../svg.js';

/** @param {string} s @returns {Record<string, string>} An element's attributes. */
function attributes(s) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const m of s.matchAll(/([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) out[m[1]] = m[3] ?? m[4];
  return out;
}

/**
 * Replace every `<feDropShadow>` in filter markup with blur, offset, flood,
 * composite and merge. Without an `in`, it takes the previous result (or
 * the source graphic), exactly as `feDropShadow` does.
 *
 * @param {string} markup - Filter primitives.
 * @returns {string}
 *
 * @example
 * expandDropShadows('<feDropShadow in="felt" dy="2" stdDeviation="1"/>');
 */
export function expandDropShadows(markup) {
  let n = 0;
  return markup.replace(/<feDropShadow\b([^>]*?)\/?>(?:\s*<\/feDropShadow>)?/gi, (_, raw) => {
    const a = attributes(raw);
    const k = `ds${n++}`;
    const shared = { x: a.x, y: a.y, width: a.width, height: a.height, 'color-interpolation-filters': a['color-interpolation-filters'] };
    // An identity offset names the input when none is given (the previous result).
    const input = a.in ?? `${k}i`;
    const pick = a.in ? '' : `<feOffset${attrs({ dx: 0, dy: 0, result: input })}/>`;
    return `${pick}<feGaussianBlur${attrs({ in: input, stdDeviation: a.stdDeviation ?? 2, ...shared })}/>`
      + `<feOffset${attrs({ dx: a.dx ?? 2, dy: a.dy ?? 2, result: `${k}o`, ...shared })}/>`
      + `<feFlood${attrs({ 'flood-color': a['flood-color'] ?? '#000', 'flood-opacity': a['flood-opacity'] ?? 1, ...shared })}/>`
      + `<feComposite${attrs({ in2: `${k}o`, operator: 'in', result: `${k}s`, ...shared })}/>`
      + `<feMerge${attrs({ result: a.result, ...shared })}><feMergeNode in="${k}s"/><feMergeNode in="${input}"/></feMerge>`;
  });
}
