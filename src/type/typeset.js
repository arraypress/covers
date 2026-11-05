/**
 * Typesetting for posters and flyers: what the `text` layer does when it's
 * given any of the 1.1 options (the 1.0 path is untouched, so 1.0 covers
 * render byte-identically).
 *
 * - **Baseline placement**: `x`, `y` put the first baseline where SVG
 *   `<text x y>` would, with `align` acting as `text-anchor`.
 * - **Justified to a width**: `width` sets each line to exactly that width,
 *   like `textLength` (`lengthAdjust: 'spacingAndGlyphs'` scales the glyphs,
 *   the default; `'spacing'` opens the letter-spacing instead).
 * - **Fitting**: `fit: 'width'` sizes the block so its widest line fills
 *   `width` (or `maxWidth`); `fit: 'lines'` sizes every line on its own to
 *   fill it (the stacked full-width headline); `fit: 'shrink'` shrinks to
 *   `minSize` before wrapping further.
 * - **Stretch and slant**: `stretch: [sx, sy]` about the first baseline.
 * - **Variable fonts**: `axes: { wdth: 50, SOFT: 100, WONK: 1 }`.
 * - **Strokes**: `stroke`, `strokeWidth`, `fill: 'none'` (outline type), or
 *   `strokes: [{ color, width }]`, drawn widest first under the fill, for
 *   keylines.
 * - **Text on a path**: `path` (`circle`, `arc`, `ellipse`, `wave`, or any
 *   `d`), `startOffset`, `fitPath` to fill a ring, `dy`.
 * - **Auto contrast**: `color: 'auto'` picks white or near-black (or your
 *   `autoColors`) by contrast against whatever is drawn underneath.
 * - **Live text**: `render: 'live'` writes `<text>` with the font embedded
 *   by `@font-face` (or linked by URL), laid out the same way, for in-browser
 *   speed and selectable text.
 * - **Mixed runs**: `spans`, each with its own font, weight, size, colour.
 * - **Per-glyph control**: `glyphs: { scale, dx, dy, rotate, color }` arrays.
 * - **Fallback**: characters the font lacks come from `fallback`, fonts
 *   registered with `fallback: true`, or the built-in symbols.
 * - **Pixel type**: `font: 'pixel'`, a built-in 5×7 face.
 * - **Layout from data**: `fit: 'words'` (a word a line), `fit: 'wrap'`
 *   (wrap, then fill the width), `split: 'words'`, and the block's box for
 *   later layers as `{layout.<id>.bottom}` and the like.
 *
 * @module type/typeset
 */

import { attrs, esc, num } from '@logomarks/image-effects/svg';
import { len } from '@logomarks/image-effects/length';
import { place, anchorAlign, unit } from '../geometry.js';
import { toHex } from '@logomarks/image-effects/color';
import { layout, caseText } from '../text.js';
import { paint } from '../paint/index.js';
import { pos, wrap } from '../layers/util.js';
import { presetStrokes } from '../paint/presets.js';
import { extrude } from '@logomarks/image-effects/effects/extrude';
import { dashArray } from '../layers/shape.js';
import { faceFor, mappedPath, setLine } from './line.js';
import { textPathD, pathSampler } from './path.js';
import { fontFace } from './live.js';
import { autoColor } from './auto-color.js';
import { fallbackFaces, shapeText } from './fallback.js';
import { controlGlyphs, glyphCount } from './glyphs.js';
import { loadSpans, spanLines, shapeSpans, spanText } from './spans.js';
import { recordLayout } from './layout-ref.js';
import { marquee } from '../animate/marquee.js';

/** Options that switch the text layer onto this typesetter. */
export const TYPE_OPTIONS = ['x', 'y', 'width', 'justify', 'lengthAdjust', 'fit', 'stretch', 'axes', 'stroke', 'strokeWidth', 'strokes', 'fill', 'path', 'startOffset', 'fitPath', 'dy', 'render', 'autoColors', 'lines', 'spans', 'glyphs', 'fallback', 'split', 'dash', 'extrude', 'maxHeight', 'autoThreshold'];

/**
 * Whether a text layer needs this typesetter.
 *
 * @param {any} layer
 * @returns {boolean}
 */
export function wantsType(layer) {
  return TYPE_OPTIONS.some((k) => layer[k] !== undefined) || layer.color === 'auto' || Array.isArray(layer.content) || layer.font === 'pixel';
}

/**
 * A line to set: its text, size, and (with `spans`) its runs.
 *
 * @typedef {{ text: string, size: number, spans?: import('./spans.js').Span[] }} Line
 */

/**
 * The `text` layer with 1.1 options.
 *
 * @param {any} layer
 * @param {import('../layers.js').RenderContext} ctx
 * @returns {Promise<import('../layers.js').Markup>}
 */
export async function typeset(layer, ctx) {
  const rawContent = Array.isArray(layer.content) ? layer.content.join('\n') : layer.content && typeof layer.content === 'object' ? layer.content.content : layer.content;
  const kase = layer.transform === 'uppercase' || layer.transform === 'lowercase' ? layer.transform : undefined;
  let content = layer.spans ? '' : caseText(String(rawContent ?? ''), kase);
  if (!layer.spans && (layer.split === 'words' || layer.fit === 'words')) content = content.split(/\s+/).filter(Boolean).join('\n');
  const p = ctx.palette;
  const u = unit(ctx.canvas);
  const face = await faceFor(ctx, layer);
  const fallbacks = await fallbackFaces(ctx, layer);
  let size = len(layer.size, ctx.canvas, u * 0.06);
  const ls = layer.letterSpacing ?? -0.02;
  const lh = layer.lineHeight ?? 1.12;
  const baseline = layer.x != null || layer.y != null;
  const anchor = layer.anchor ?? 'bottom-left';
  const align = layer.align ?? (baseline ? 'left' : anchorAlign(anchor));
  const margin = len(layer.margin, ctx.canvas, /** @type {any} */ (ctx).inset ?? u * 0.07);
  const target = layer.width != null ? len(layer.width, ctx.canvas) : undefined;
  const maxWidth = layer.maxWidth != null ? len(layer.maxWidth, ctx.canvas) : baseline ? Infinity : ctx.width - 2 * margin;
  const justifyTo = target ?? (layer.justify ? maxWidth : undefined);
  const adjust = layer.lengthAdjust ?? 'spacingAndGlyphs';
  const id = ctx.id;
  const spans = layer.spans ? await loadSpans(layer, ctx, size) : undefined;
  if (spans) content = spans.map((s) => s.text).join('');
  if (!content.trim()) return { defs: '', body: '' };
  let defs = '';

  /** Shape a line at a tracking (px), through fallback, spans and per-glyph control. @type {(l: Line, tracking: number, start: number) => import('../text.js').Shaped} */
  const shapeLine = (l, tracking, start) => {
    const run = l.spans ? shapeSpans(l.spans, l.size, tracking - ls * l.size, face, fallbacks) : shapeText(face, l.text, l.size, tracking, fallbacks);
    return controlGlyphs(run, layer.glyphs, { start, size: l.size, capHeight: (face.capHeight / face.upem) * l.size, canvas: ctx.canvas, text: l.text }).run;
  };
  /** @param {Line} l @returns {number} */
  const natural = (l) => shapeLine(l, ls * l.size, 0).width;

  // ---- Lines and sizes ----
  /** @type {Line[]} */
  let lines;
  if (layer.path) {
    lines = [{ text: content.replace(/\n/g, ' '), size, spans: spans ? spanLines(spans, size, Infinity, fallbacks).flat() : undefined }];
  } else if (spans) {
    const fitting = layer.fit === 'width' || layer.fit === 'lines' || layer.fit === 'words';
    const rows = spanLines(spans, size, fitting ? Infinity : layer.fit === 'wrap' ? justifyTo ?? maxWidth : maxWidth, fallbacks);
    lines = rows.map((r) => ({ text: spanText(r), size, spans: r }));
    lines = fitLines(lines, layer.fit, justifyTo ?? maxWidth, natural);
  } else if (layer.fit === 'width' || layer.fit === 'lines' || layer.fit === 'words') {
    lines = fitLines(content.split('\n').map((t) => ({ text: t, size })), layer.fit, justifyTo ?? maxWidth, natural);
  } else {
    const fitTo = justifyTo ?? maxWidth;
    const set = layout({
      face,
      text: content,
      size,
      minSize: layer.minSize != null ? len(layer.minSize, ctx.canvas) : layer.fit === 'shrink' ? size * 0.5 : undefined,
      letterSpacing: ls,
      // Only `fit: 'wrap'` wraps at the justification width; otherwise `width` justifies what `maxWidth` wrapped.
      maxWidth: layer.fit === 'wrap' ? fitTo : maxWidth,
      maxLines: layer.maxLines ?? (baseline || layer.fit === 'wrap' ? Infinity : 3),
      ellipsis: layer.ellipsis,
      balance: layer.balance ?? !baseline,
    });
    size = set.size;
    lines = set.lines.map((l) => ({ text: l.text, size }));
    // Wrap, then fill: every line at one size, the widest filling the width.
    if (layer.fit === 'wrap') lines = fitLines(lines, 'width', fitTo, natural);
  }
  // A block taller than `maxHeight` shrinks to it.
  if (layer.maxHeight != null && !layer.path) {
    const cap = face.capHeight / face.upem;
    const tall = lines[0].size * cap + lines.slice(1).reduce((h, l) => h + l.size * lh, 0);
    const k = len(layer.maxHeight, ctx.canvas) / tall;
    if (k < 1) lines = lines.map((l) => ({ ...l, size: l.size * k }));
  }

  // ---- Paint ----
  const strokes = layer.strokes ?? (layer.stroke ? [{ color: layer.stroke, width: layer.strokeWidth ?? '0.3vmin', dash: layer.dash }] : presetStrokes(layer.fill) ?? []);
  const live = (layer.render ?? /** @type {any} */ (ctx).textRender) === 'live';

  // ---- Text on a path ----
  if (layer.path) {
    const d = textPathD(layer.path, ctx.canvas);
    const sampler = pathSampler(d);
    const line = lines[0];
    let run = shapeLine(line, ls * size, 0);
    if (layer.fitPath) {
      const gaps = Math.max(1, run.glyphs.length);
      const gap = len(layer.fitPath === true ? 0 : layer.fitPath, ctx.canvas);
      run = shapeLine(line, ls * size + (sampler.length - gap - run.width) / gaps, 0);
    }
    const so = layer.startOffset ?? (layer.fitPath ? 0 : 0.5);
    const offset = typeof so === 'number' && so <= 1 && so >= 0 ? so * sampler.length : pos(so, 'x', ctx.canvas);
    let start = layer.fitPath ? offset : align === 'center' || layer.align == null ? offset - run.width / 2 : align === 'right' ? offset - run.width : offset;
    const dy = len(layer.dy, ctx.canvas, 0);
    const adv = (/** @type {number} */ i) => (i + 1 < run.glyphs.length ? run.glyphs[i + 1].x : run.width) - run.glyphs[i].x;
    const mids = run.glyphs.map((g, i) => g.x + adv(i) / 2);
    const index = new Map(run.glyphs.map((g, i) => [g, i]));
    const along = (/** @type {(g: any) => boolean} */ only) => mappedPath(face, run, size, (gx, gy, g) => {
      const i = /** @type {number} */ (index.get(/** @type {any} */ (g)));
      const at = sampler.at(start + mids[i]);
      const a = gx - mids[i];
      const across = gy + dy;
      return [at.x + at.tx * a - at.ty * across, at.y + at.ty * a + at.tx * across];
    }, only);
    const whole = { x: 0, y: 0, width: ctx.width, height: ctx.height };
    const fill = layer.fill === 'none' ? { defs: '', value: 'none' } : layer.color === 'auto' ? { defs: '', value: await autoColor(layer, ctx, whole) } : paint(layer.fill ?? layer.color, p.text, { id: `${id}f`, box: whole, canvas: ctx.canvas });
    defs += fill.defs;
    // A marquee (motion): the still moves the start; playing, each glyph is drawn once in its own frame and placed by copies.
    const running = /** @type {any} */ (ctx).marquee && marquee(/** @type {any} */ (ctx).marquee, {
      run, mids, start, sampler, id,
      glyph: (i) => drawBuckets({ glyphs: [run.glyphs[i]] }, (only) => mappedPath(face, run, size, (gx, gy) => [gx - mids[i], gy + dy], (g) => g === run.glyphs[i] && only(g)), fill.value, strokes, ctx),
    });
    if (running) {
      start += running.shift;
      defs += running.defs;
    }
    report(ctx, layer, content, size, face, null, { capHeight: (face.capHeight / face.upem) * size });
    const drawn = running?.body ?? drawBuckets(run, along, fill.value, strokes, ctx);
    recordLayout(ctx, layer.id, whole, { x: 0, y: 0, baseline: 0, size, lines: 1 });
    return { defs, body: wrap(layer, finish(drawn, layer, ctx)) };
  }

  // ---- Measure, then place ----
  // `width` justifies every line, except under a fit that sizes the block to
  // its widest line (`width`, `words`, `wrap`): there the widest fills the
  // width and the others keep their natural width.
  const widestOnly = justifyTo != null && (layer.fit === 'width' || layer.fit === 'words' || layer.fit === 'wrap');
  const naturals = widestOnly ? lines.map(natural) : [];
  const widest = widestOnly ? naturals.indexOf(Math.max(...naturals)) : -1;
  const runs = lines.map((l, i) => {
    const fill = justifyTo != null && (!widestOnly || i === widest);
    const w = fill ? /** @type {number} */ (justifyTo) : widestOnly ? naturals[i] : natural(l);
    return { ...l, w, fill, cap: (face.capHeight / face.upem) * l.size };
  });
  const lineStep = (/** @type {number} */ i) => runs[i].size * lh;
  let x0;
  let y0;
  const blockW = Math.max(...runs.map((r) => r.w));
  if (baseline) {
    x0 = pos(layer.x ?? 0, 'x', ctx.canvas);
    y0 = pos(layer.y ?? 0, 'y', ctx.canvas);
  } else {
    let h = runs[0].cap;
    for (let i = 1; i < runs.length; i++) h += lineStep(i);
    const at = place({ width: blockW, height: h, canvas: ctx.canvas, anchor, margin, position: layer.position, offset: layer.offset });
    x0 = align === 'center' ? at.x + blockW / 2 : align === 'right' ? at.x + blockW : at.x;
    y0 = at.y + runs[0].cap;
  }
  const baselines = [y0];
  for (let i = 1; i < runs.length; i++) baselines.push(baselines[i - 1] + lineStep(i));
  const top = y0 - runs[0].cap;
  const left = align === 'center' ? x0 - blockW / 2 : align === 'right' ? x0 - blockW : x0;
  const box = { x: left, y: top, width: blockW, height: baselines[baselines.length - 1] - top };
  const [sx, sy] = layer.stretch ? (Array.isArray(layer.stretch) ? layer.stretch : [1, layer.stretch]) : [1, 1];
  // The block as drawn (stretched about the first baseline), for lint, `color: 'auto'` and later layers.
  const drawnBox = { x: Math.min(x0 + (box.x - x0) * sx, x0 + (box.x + box.width - x0) * sx), y: Math.min(y0 + (box.y - y0) * sy, y0 + (box.y + box.height - y0) * sy), width: box.width * Math.abs(sx), height: box.height * Math.abs(sy) };

  const color = layer.color === 'auto' ? await autoColor(layer, ctx, drawnBox) : undefined;
  const fillPaint = layer.fill === 'none' ? { defs: '', value: 'none' } : paint(color ?? layer.fill ?? layer.color, p.text, { id: `${id}f`, box, canvas: ctx.canvas });
  defs += fillPaint.defs;
  recordLayout(ctx, layer.id, drawnBox, { x: x0, y: y0, baseline: y0 + (baselines[baselines.length - 1] - y0) * sy, size: runs[0].size, lines: runs.length });

  let body;
  /** Narrowest horizontal scale a line was set at (justification squeezes glyphs). */
  let squeeze = 1;
  if (live) {
    const ff = await fontFace(face, ctx);
    if (ff.css) defs += `<style>${ff.css}</style>`;
    const fv = Object.entries(face.variations ?? {}).filter(([t]) => t !== 'wght').map(([t, v]) => `'${t}' ${num(v, 2)}`).join(',');
    const anchorAttr = align === 'center' ? 'middle' : align === 'right' ? 'end' : undefined;
    const strokeAttrs = strokes.length ? { stroke: toHex(strokes[0].color), 'stroke-width': len(strokes[0].width, ctx.canvas), 'paint-order': 'stroke', 'stroke-linejoin': 'round' } : {};
    body = runs.map((r, i) => `<text${attrs({
      x: x0, y: baselines[i], 'font-family': ff.family, 'font-size': r.size,
      'font-weight': layer.weight ?? 600, 'font-style': layer.style && layer.style !== 'normal' ? layer.style : undefined,
      'letter-spacing': ls ? num(ls * r.size, 3) : undefined,
      'text-anchor': anchorAttr,
      textLength: r.fill ? justifyTo : undefined, lengthAdjust: r.fill ? adjust : undefined,
      style: fv ? `font-variation-settings:${fv}` : undefined,
      fill: fillPaint.value, ...strokeAttrs,
    })}>${esc(r.text)}</text>`).join('');
  } else {
    // Each line once; then its glyphs drawn per paint (spans and per-glyph colours).
    let start = 0;
    const set = runs.map((r, i) => {
      const first = start;
      start += glyphCount(r.text);
      const line = setLine({ face, text: r.text, size: r.size, tracking: ls * r.size, x: x0, y: baselines[i], align, width: r.fill ? justifyTo : undefined, adjust, shape: (t) => shapeLine(r, t, first), only: () => false });
      squeeze = Math.min(squeeze, line.scaleX);
      return { ...line, baseline: baselines[i], size: r.size };
    });
    const draw = (/** @type {(g: any) => boolean} */ only) => set.map((l) => mappedPath(face, l.run, l.size, (gx, gy) => [l.left + gx * l.scaleX, l.baseline + gy], only)).join('');
    body = finish(drawBuckets({ glyphs: set.flatMap((l) => l.run.glyphs) }, draw, fillPaint.value, strokes, ctx), layer, ctx);
  }
  // Mirrored (negative) stretch is still that tall.
  report(ctx, layer, content, runs[0].size * Math.abs(sy), face, drawnBox, {
    capHeight: Math.min(...runs.map((r) => r.cap)) * Math.abs(sy),
    squeeze: squeeze * Math.abs(sx),
  });

  if (layer.stretch) body = `<g transform="translate(${num(x0)} ${num(y0)}) scale(${num(sx, 4)} ${num(sy, 4)}) translate(${num(-x0)} ${num(-y0)})">${body}</g>`;
  // Opacity and blend (renderWrapped has already taken them off a wrapped layer).
  return { defs, body: wrap(layer, body) };
}

/**
 * Lines sized to a width: `'width'` (one size, the widest line fills it),
 * `'lines'` and `'words'`… `'lines'` sizes each line on its own; `'words'`
 * (a word a line) is sized like `'width'`.
 *
 * @param {Line[]} lines @param {string} mode @param {number} fitTo
 * @param {(l: Line) => number} natural - A line's width at its size.
 * @returns {Line[]}
 */
function fitLines(lines, mode, fitTo, natural) {
  if (mode !== 'width' && mode !== 'lines' && mode !== 'words') return lines;
  if (!Number.isFinite(fitTo)) throw new TypeError('fit needs a width (width or maxWidth)');
  const nat = lines.map(natural);
  if (mode === 'lines') return lines.map((l, i) => ({ ...l, size: (l.size * fitTo) / Math.max(nat[i], 1e-6) }));
  const k = fitTo / Math.max(...nat, 1e-6);
  return lines.map((l) => ({ ...l, size: l.size * k }));
}

/**
 * Draw glyphs by paint: strokes under everything (widest first), then the
 * fill, then each colour bucket (spans, per-glyph colours) on its own path.
 *
 * @param {{ glyphs: any[] }} run - Every glyph drawn (for its paint keys).
 * @param {(only: (g: any) => boolean) => string} draw - Path data for the glyphs a filter keeps.
 * @param {string} fill
 * @param {any[]} strokes
 * @param {import('../layers.js').RenderContext} ctx
 * @returns {string}
 */
function drawBuckets(run, draw, fill, strokes, ctx) {
  const paints = [...new Set(run.glyphs.map((g) => g.paint).filter(Boolean))];
  if (!paints.length) return drawPaths([draw(() => true)], fill, strokes, ctx);
  let out = strokes.length ? drawPaths([draw(() => true)], 'none', strokes, ctx) : '';
  const plain = draw((g) => !g.paint);
  if (plain && fill !== 'none') out += `<path${attrs({ d: plain, fill })}/>`;
  for (const c of paints) out += `<path${attrs({ d: draw((g) => g.paint === c), fill: c })}/>`;
  return out;
}

/**
 * The text's extrusion (`extrude: { depth, angle, color, to, steps }` or a depth).
 *
 * @param {string} body @param {any} layer @param {import('../layers.js').RenderContext} ctx
 * @returns {string}
 */
function finish(body, layer, ctx) {
  if (!layer.extrude) return body;
  const fx = typeof layer.extrude === 'object' ? layer.extrude : { depth: layer.extrude };
  const out = extrude({ kind: 'extrude', ...fx }, { defs: '', body }, ctx, `${ctx.id}t`);
  return `<defs>${out.defs}</defs>${out.body}`;
}

/**
 * Stroke copies widest first, then the fill.
 *
 * @param {string[]} ds @param {string} fill @param {any[]} strokes @param {import('../layers.js').RenderContext} ctx
 * @returns {string}
 */
function drawPaths(ds, fill, strokes, ctx) {
  const d = ds.join('');
  const sorted = [...strokes].sort((a, b) => len(b.width, ctx.canvas) - len(a.width, ctx.canvas));
  let out = sorted.map((s) => `<path${attrs({ d, fill: s.fill ? toHex(s.fill) : 'none', stroke: toHex(s.color), 'stroke-width': len(s.width, ctx.canvas), 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'stroke-dasharray': s.dash ? dashArray(s.dash, len(s.width, ctx.canvas), ctx) : undefined })}/>`).join('');
  if (fill !== 'none' || !strokes.length) out += `<path${attrs({ d, fill })}/>`;
  return out;
}

/**
 * Note a text block for `lint`: the whole block as drawn (every line,
 * stretched), its smallest capitals, how far justification squeezed it.
 *
 * @param {import('../layers.js').RenderContext} ctx @param {any} layer @param {string} content @param {number} size
 * @param {import('../fonts.js').LoadedFont} face @param {{ x: number, y: number, width: number, height: number } | null} box
 * @param {{ capHeight: number, squeeze?: number }} drawn
 */
function report(ctx, layer, content, size, face, box, drawn) {
  /** @type {any} */ (ctx).report?.({ kind: 'text', id: layer.id, content, size, capHeight: drawn.capHeight, box, squeeze: drawn.squeeze ?? 1 });
}
