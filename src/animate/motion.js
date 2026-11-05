/**
 * `motion`: a layer moving in the SVG itself, as CSS keyframes, so a plain
 * `<img>` or inline SVG plays it with no script.
 *
 * ```json
 * { "type": "mesh", "motion": { "translate": ["5vw", "-4vw"], "scale": 1.08, "origin": ["22%", "66%"],
 *                               "duration": 26, "easing": "inOut", "direction": "alternate" } }
 * ```
 *
 * A layer takes one motion or a list (or a preset name: `drift`, `spin`,
 * `breathe`, `blink`, `marquee`). Each moves the whole layer (its effects
 * and masks with it): `translate` or `path`, `rotate`, `scale`, `opacity`
 * (see ./tracks.js), or changes it: `vary` (outlines morph; ./morph.js) and
 * `marquee` (text running along its path; ./marquee.js). Timing is CSS's:
 * `duration`, `delay` (seconds), `easing`, `direction`, `iterations`.
 *
 * Every element keeps its still as plain attributes, which is what shows
 * under `prefers-reduced-motion` and in renderers without CSS animation:
 * the layer at rest, or the cover's `poster` frame.
 *
 * @module animate/motion
 */

import { attrs, esc } from '@arraypress/image-effects/svg';
import { motionList, progress, cssTiming, easing } from './timing.js';
import { tracks, atStops } from './tracks.js';
import { morph } from './morph.js';

/**
 * A layer with its motion: the still at `o.t` (or at rest), and when live,
 * the keyframes that play it.
 *
 * @param {any} layer
 * @param {any} ctx - The layer's render context (its canvas is the layer's grid).
 * @param {import('./motion.js').MotionScope} o
 * @returns {Promise<{ defs: string, body: string }>}
 * @throws {TypeError} On a motion that can't be drawn (see the modules it uses).
 */
export async function renderMotion(layer, ctx, o) {
  const list = motionList(layer.motion);
  const blend = layer.blend && layer.blend !== 'normal' ? layer.blend : undefined;
  // Blend goes on the outermost group (a moving group would otherwise blend only with itself).
  const base = { ...layer, motion: undefined, blend: undefined };
  const varies = list.filter((m) => m.vary != null);
  const runs = list.filter((m) => m.marquee);
  if (varies.length + runs.length > 1) throw new TypeError(`motion: "${layer.id ?? layer.type}" takes one vary or marquee`);
  const markup = varies.length
    ? await morph(base, varies[0], o)
    : runs.length
      ? await o.draw(base, { marquee: { ...runs[0], live: o.live, t: o.t, sheet: o.sheet } })
      : await o.draw(base);
  let body = markup.body;
  for (const m of [...list].reverse()) {
    for (const track of tracks(m, ctx.canvas).reverse()) {
      const still = o.t == null ? null : track.attr(atStops(track.stops, progress(m, o.t), track.sampled ? (x) => x : easing(m.easing)));
      const cls = o.live ? o.sheet.animation(track.stops.map((v, i, all) => [all.length > 1 ? i / (all.length - 1) : 0, track.css(v)]), cssTiming(m, { linear: track.sampled })) : undefined;
      const a = attrs({ class: cls, ...still });
      if (a) body = `<g${a}>${body}</g>`;
    }
  }
  if (blend) body = `<g style="mix-blend-mode:${esc(blend)}">${body}</g>`;
  return { ...markup, body };
}
