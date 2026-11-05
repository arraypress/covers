/**
 * `marquee`: text on a path running along it, one repeat of its words per
 * `duration`, looping seamlessly for as long as it shows (back toward the
 * path's start; `direction: 'reverse'` runs it forward).
 *
 * The text is outlines, so the moving offset can't be a `textPath`
 * attribute. Each glyph is drawn once (in its own frame, centred on the
 * baseline) and placed by copies (`<use>`). Every copy runs the same
 * keyframes, the path sampled as `translate() rotate()` stops, over a track
 * as long as the text; the copies differ only in their delay. So a copy
 * that leaves one end comes back in at the other, a whole number of repeats
 * away, where the same glyph was: the loop never shows a seam. The still
 * (and reduced motion) is each copy's own `transform`.
 *
 * @module animate/marquee
 */

import { num } from '@arraypress/image-effects/svg';
import { NS } from './sheet.js';

/** Most px between two keyframes along the track. */
const STEP = 8;

/**
 * The marquee's part in drawing text on a path.
 *
 * @param {import('./marquee.js').MarqueeMotion} m - The motion (and whether it plays, and the still's time).
 * @param {import('./marquee.js').MarqueeText} o - The laid-out text.
 * @returns {{ shift: number, defs: string, body?: string }} `shift`: px to move the start by for a still; `body`: the playing glyphs.
 * @throws {TypeError} When the text doesn't repeat, or the direction alternates.
 */
export function marquee(m, o) {
  if (m.direction.startsWith('alternate')) throw new TypeError('motion: a marquee runs one way (direction normal or reverse)');
  const glyphs = o.run.glyphs;
  const period = periodOf(glyphs);
  const unit = glyphs[period].x - glyphs[0].x;
  const dir = m.direction === 'reverse' ? 1 : -1;
  const phase = m.t == null ? 0 : (((m.t - m.delay) / m.duration) % 1 + 1) % 1;
  if (!m.live) return { shift: dir * unit * phase, defs: '' };

  const units = Math.ceil(glyphs.length / period);
  const span = units * unit;
  // The track: half a repeat before the first glyph, so no copy starts exactly at its end.
  const from = o.start + o.mids[0] - unit / 2;
  const steps = Math.max(8, Math.min(400, Math.ceil(span / STEP)));
  const place = (/** @type {number} */ s) => {
    const at = o.sampler.at(s);
    return { x: at.x, y: at.y, a: (Math.atan2(at.ty, at.tx) * 180) / Math.PI };
  };
  const frames = Array.from({ length: steps + 1 }, (_, i) => {
    const p = place(from + (span * i) / steps);
    return /** @type {[number, string]} */ ([i / steps, `transform:translate(${num(p.x)}px,${num(p.y)}px) rotate(${num(p.a, 2)}deg)`]);
  });
  const loop = units * m.duration;
  const cls = m.sheet.animation(frames, `${num(loop, 3)}s linear 0s infinite ${dir > 0 ? 'normal' : 'reverse'} both`);

  let defs = '';
  for (let j = 0; j < period; j++) defs += `<g id="${NS}${o.id}q${j}">${o.glyph(j)}</g>`;
  let body = '';
  for (let k = 0; k < units; k++) {
    for (let j = 0; j < period; j++) {
      const s0 = o.start + o.mids[j] + k * unit;
      const f0 = (s0 - from) / span;
      // CSS progress f0 at t = 0, shifted by the motion's own delay; written in (−loop, 0].
      const lead = dir > 0 ? m.delay - f0 * loop : m.delay + f0 * loop;
      const delay = lead - loop * Math.ceil(lead / loop);
      const still = from + ((((s0 - from + dir * unit * phase) % span) + span) % span);
      const p = place(still);
      body += `<use href="#${NS}${o.id}q${j}" class="${cls}" transform="translate(${num(p.x)} ${num(p.y)}) rotate(${num(p.a, 2)})" style="animation-delay:${num(delay, 3)}s"/>`;
    }
  }
  return { shift: 0, defs, body };
}

/**
 * The text's repeat, in glyphs: the shortest run the rest repeats, glyph
 * for glyph and at the same spacing.
 *
 * @param {any[]} glyphs
 * @returns {number}
 * @throws {TypeError} When it doesn't repeat at least twice.
 */
function periodOf(glyphs) {
  const same = (/** @type {any} */ a, /** @type {any} */ b) => a.gid === b.gid && a.face === b.face && a.paint === b.paint;
  // Twice over, give or take a trailing space.
  for (let p = 1; p * 2 <= glyphs.length + 1; p++) {
    const step = glyphs[p].x - glyphs[0].x;
    let ok = true;
    for (let i = 0; ok && i + p < glyphs.length; i++) ok = same(glyphs[i], glyphs[i + p]) && Math.abs(glyphs[i + p].x - glyphs[i].x - step) < 0.01;
    if (ok) return p;
  }
  throw new TypeError('motion: a marquee needs its words repeated along the path (at least twice), so it can loop');
}
