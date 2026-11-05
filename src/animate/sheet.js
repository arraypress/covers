/**
 * The stylesheet an animated SVG carries: its keyframes and animation
 * rules (each written once, however many elements share it), and a
 * `prefers-reduced-motion` rule that stops them all, so what shows is the
 * SVG's own attributes: the still.
 *
 * Names are written with a placeholder prefix while the cover is drawn and
 * given the document's hash at the end ({@link nameSheet}), so two covers
 * inlined in one page never share a name unless they're the same cover.
 *
 * @module animate/sheet
 */

import { num } from '@logomarks/image-effects/svg';
import { hashString } from '@logomarks/image-effects/rng';

/** The placeholder for the document's prefix (outside base64's alphabet). */
export const NS = '__cv__';

/**
 * A stylesheet to collect animations into.
 *
 * @returns {import('./sheet.js').Sheet}
 */
export function createSheet() {
  /** @type {Map<string, string>} keyframes body → name */
  const keyframes = new Map();
  /** @type {Map<string, string>} animation → class */
  const rules = new Map();
  return {
    animation(frames, timing) {
      const body = frames.map(([p, decl]) => `${num(p * 100, 3)}%{${decl}}`).join('');
      let name = keyframes.get(body);
      if (!name) keyframes.set(body, (name = `${NS}k${keyframes.size}`));
      const anim = `${name} ${timing}`;
      let cls = rules.get(anim);
      if (!cls) rules.set(anim, (cls = `${NS}a${rules.size}`));
      return `${NS} ${cls}`;
    },
    get empty() {
      return rules.size === 0;
    },
    css() {
      let css = `.${NS}{transform-box:view-box;transform-origin:0 0}`;
      for (const [body, name] of keyframes) css += `@keyframes ${name}{${body}}`;
      for (const [anim, cls] of rules) css += `.${cls}{animation:${anim}}`;
      return `${css}@media (prefers-reduced-motion:reduce){.${NS}{animation:none!important}}`;
    },
  };
}

/**
 * Give a finished document's animation names their prefix: `cv` and a hash
 * of the document.
 *
 * @param {string} svg
 * @returns {string}
 */
export function nameSheet(svg) {
  return svg.includes(NS) ? svg.replaceAll(NS, `cv${hashString(svg).toString(36)}`) : svg;
}
