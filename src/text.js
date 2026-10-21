/**
 * Text: shaping, line breaking and outline drawing.
 *
 * A line is shaped by HarfBuzz as a whole (so kerning across spaces and
 * ligatures are right), then every glyph's outline is transformed into
 * canvas pixels and written as one `<path>` per line. The output never
 * references a font, so it renders the same in librsvg, a browser or a
 * design tool.
 *
 * Line breaking is greedy on spaces, then optionally balanced (like CSS
 * `text-wrap: balance`: the narrowest width that keeps the same number of
 * lines, so a headline doesn't end on a lonely word). A word wider than
 * the line is broken between characters. Past `maxLines` the text is cut
 * at a word and given an ellipsis; with `minSize`, the size first steps
 * down until the text fits.
 *
 * Vertical metrics are trimmed to the cap height above the first line and
 * the baseline below the last (CSS `text-box: trim-both cap alphabetic`),
 * so a margin measured to a headline is the margin you see.
 *
 * @module text
 */

import { num } from './svg.js';

/**
 * A shaped run of text.
 *
 * @typedef {object} Shaped
 * @property {{ gid: number, x: number, y: number }[]} glyphs - Glyph ids and pen positions in px (y is the baseline offset).
 * @property {number} width - Advance width in px (no trailing letter-spacing).
 */

/**
 * Shape a run of text.
 *
 * @param {import('./fonts.js').LoadedFont} face - The face.
 * @param {string} text - One line of text.
 * @param {number} size - Font size in px.
 * @param {number} tracking - Letter-spacing in px, added between clusters (0 for none).
 * @param {typeof import('harfbuzzjs')} hb - harfbuzzjs.
 * @returns {Shaped} Positioned glyphs.
 */
export function shape(face, text, size, tracking, hb) {
  const buffer = new hb.Buffer();
  buffer.addText(text);
  buffer.guessSegmentProperties();
  hb.shape(face.font, buffer);
  const infos = buffer.getGlyphInfos();
  const positions = buffer.getGlyphPositions();
  const scale = size / face.upem;
  const glyphs = [];
  let pen = 0;
  for (let i = 0; i < infos.length; i++) {
    const p = positions[i];
    glyphs.push({ gid: infos[i].codepoint, x: pen + p.xOffset * scale, y: -p.yOffset * scale });
    pen += p.xAdvance * scale;
    const nextCluster = infos[i + 1]?.cluster;
    if (tracking && nextCluster !== undefined && nextCluster !== infos[i].cluster) pen += tracking;
  }
  return { glyphs, width: pen };
}

/**
 * A glyph's outline as parsed commands, in font units (y up). Cached on
 * the face.
 *
 * @param {import('./fonts.js').LoadedFont} face
 * @param {number} gid
 * @returns {(string | number)[]} Flat list: command letter followed by its numbers.
 */
function outline(face, gid) {
  let cmds = face.paths.get(gid);
  if (!cmds) {
    cmds = [];
    const d = face.font.glyphToPath(gid);
    for (const m of d.matchAll(/([MLQCZ])([^MLQCZ]*)/gi)) {
      cmds.push(m[1].toUpperCase());
      for (const n of m[2].split(/[\s,]+/).filter(Boolean)) cmds.push(parseFloat(n));
    }
    face.paths.set(gid, cmds);
  }
  return cmds;
}

/**
 * Write shaped glyphs as SVG path data in canvas pixels.
 *
 * @param {import('./fonts.js').LoadedFont} face
 * @param {Shaped} run - Shaped glyphs.
 * @param {number} size - Font size in px.
 * @param {number} x - Left edge of the run.
 * @param {number} baseline - Baseline y.
 * @returns {string} Path data.
 */
export function runPath(face, run, size, x, baseline) {
  const s = size / face.upem;
  const parts = [];
  for (const g of run.glyphs) {
    const ox = x + g.x;
    const oy = baseline + g.y;
    let coords = [];
    for (const c of outline(face, g.gid)) {
      if (typeof c === 'string') {
        if (coords.length) parts.push(coords.join(' '));
        parts.push(c);
        coords = [];
      } else {
        // Coordinates alternate x, y; y flips (font units point up).
        coords.push(num(coords.length % 2 === 0 ? ox + c * s : oy - c * s));
      }
    }
    if (coords.length) parts.push(coords.join(' '));
  }
  return parts.join('');
}

/**
 * Laid-out text.
 *
 * @typedef {object} Layout
 * @property {{ text: string, run: Shaped }[]} lines - Each line and its shaping.
 * @property {number} size - The size used (may be below the asked size with `minSize`).
 * @property {boolean} truncated - Whether an ellipsis was added.
 * @property {number} width - The widest line.
 */

/**
 * Break text into lines.
 *
 * @param {object} o
 * @param {import('./fonts.js').LoadedFont} o.face - The face.
 * @param {typeof import('harfbuzzjs')} o.hb - harfbuzzjs.
 * @param {string} o.text - The text (`\n` starts a new line).
 * @param {number} o.size - Font size in px.
 * @param {number} [o.minSize] - Smallest size to shrink to before truncating.
 * @param {number} [o.letterSpacing=0] - Tracking in em.
 * @param {number} [o.maxWidth=Infinity] - Line width in px.
 * @param {number} [o.maxLines=Infinity] - Most lines before truncating.
 * @param {string} [o.ellipsis='…'] - Appended to a cut line.
 * @param {boolean} [o.balance=false] - Balance line lengths.
 * @returns {Layout} The layout.
 */
export function layout(o) {
  const maxLines = Math.max(1, o.maxLines ?? Infinity);
  const maxWidth = o.maxWidth ?? Infinity;
  let size = o.size;
  const floor = Math.min(o.minSize ?? size, size);

  for (;;) {
    const attempt = breakLines({ ...o, size, maxWidth, maxLines });
    if ((!attempt.truncated && !attempt.forced) || size <= floor) return attempt;
    size = Math.max(floor, size * 0.94);
  }
}

/**
 * One layout pass at a fixed size.
 *
 * @param {Parameters<typeof layout>[0] & { maxWidth: number, maxLines: number }} o
 * @returns {Layout & { forced: boolean }} The layout; `forced` is true when a word had to be split.
 */
function breakLines(o) {
  const tracking = (o.letterSpacing ?? 0) * o.size;
  const measure = (/** @type {string} */ t) => shape(o.face, t, o.size, tracking, o.hb);
  const ellipsis = o.ellipsis ?? '…';

  /** @param {number} width */
  const wrap = (width) => {
    /** @type {string[]} */
    const lines = [];
    let forced = false;
    for (const para of o.text.split('\n')) {
      const words = para.split(/ +/).filter(Boolean);
      if (!words.length) { lines.push(''); continue; }
      let line = '';
      for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (!line || measure(candidate).width <= width) {
          line = candidate;
        } else {
          lines.push(line);
          line = word;
        }
        // A single word wider than the line: split it between characters.
        while (measure(line).width > width && Array.from(line).length > 1) {
          forced = true;
          const chars = Array.from(line);
          let cut = chars.length - 1;
          while (cut > 1 && measure(chars.slice(0, cut).join('')).width > width) cut--;
          lines.push(chars.slice(0, cut).join(''));
          line = chars.slice(cut).join('');
        }
      }
      lines.push(line);
    }
    return { lines, forced };
  };

  let { lines, forced } = wrap(o.maxWidth);

  if (o.balance && lines.length > 1 && lines.length <= o.maxLines && Number.isFinite(o.maxWidth)) {
    const target = lines.length;
    let lo = o.maxWidth * 0.4;
    let hi = o.maxWidth;
    for (let i = 0; i < 12; i++) {
      const mid = (lo + hi) / 2;
      const w = wrap(mid);
      if (w.lines.length <= target && !w.forced) hi = mid; else lo = mid;
    }
    lines = wrap(hi).lines;
  }

  let truncated = false;
  if (lines.length > o.maxLines) {
    truncated = true;
    const kept = lines.slice(0, o.maxLines);
    let last = kept[o.maxLines - 1];
    const fits = (/** @type {string} */ t) => measure(t + ellipsis).width <= o.maxWidth;
    while (!fits(last) && last.length) {
      const cut = last.lastIndexOf(' ');
      last = cut > 0 ? last.slice(0, cut) : Array.from(last).slice(0, -1).join('');
    }
    kept[o.maxLines - 1] = last.replace(/[\s.,;:!?·—–-]+$/u, '') + ellipsis;
    lines = kept;
  }

  const shaped = lines.map((text) => ({ text, run: measure(text) }));
  return { lines: shaped, size: o.size, truncated, forced, width: Math.max(0, ...shaped.map((l) => l.run.width)) };
}
