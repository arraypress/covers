/**
 * Checks for release cover art before it goes to a distributor.
 *
 * Spotify's own requirements (Spotify for Artists, "Cover art
 * requirements"): square (1:1), 640–10000 px on each side, sRGB, and never
 * upscaled. 3000×3000 is the size distributors and the other stores ask
 * for. The content rules come from the distributors that deliver to
 * Spotify (and Apple Music): no URLs, social handles or contact details, no
 * prices or promotional wording ("out now", "free download"), no release
 * dates or other time frames, no store or platform names and logos, no
 * barcodes or QR codes, and text that matches the release's metadata.
 * Those are reported as errors when a distributor would reject the art,
 * warnings when it may.
 *
 * `lint` also renders the cover to measure what it draws, through every
 * group, transform and stretch: text whose smallest capitals are under 4 px
 * tall at a 64 px thumbnail (the size Spotify lists use) is flagged, and so
 * are images drawn larger than their pixels (or embedded smaller than
 * drawn). Store names that are also words ("Tidal Archive") and day
 * names in titles ("Second Sun") need a cue to count; text spelled from
 * the artist and title (a letter per layer, a knocked-out word) matches.
 *
 * @module lint
 */

import { cover, renderReport } from '../render.js';
import { RULES } from './rules.js';
import { imageSize } from './image-size.js';

export { imageSize };

/** Glyphs set narrower than this (justification) read smaller than their cap height. */
const SQUEEZE = 0.6;

/**
 * @typedef {object} LintIssue
 * @property {string} rule
 * @property {'error' | 'warning'} severity
 * @property {string} message
 * @property {string} [layer] - The layer's id, when it has one.
 * @property {string} [text] - The text that tripped the rule.
 */

/**
 * Check a cover against a target's artwork rules.
 *
 * @param {import('../index.js').CoverOptions | import('../index.js').Cover} input
 * @param {{ target?: 'spotify' | 'release', artist?: string, title?: string, size?: number }} [options] - `artist`, `title`: the release metadata the text should match. `size`: the delivery size (default 3000).
 * @returns {Promise<{ ok: boolean, target: string, issues: LintIssue[] }>}
 *
 * @example
 * const { ok, issues } = await lint({ recipe: myCover, format: 'release', title: 'Night Garden' }, { target: 'spotify' });
 */
export async function lint(input, options = {}) {
  const target = options.target ?? 'spotify';
  if (target !== 'spotify' && target !== 'release') throw new TypeError(`Unknown lint target "${target}" (spotify, release)`);
  const c = cover(input);
  /** @type {LintIssue[]} */
  const issues = [];
  const add = (/** @type {LintIssue} */ i) => issues.push(i);

  // Spotify's requirements.
  if (c.width !== c.height) add({ rule: 'aspect', severity: 'error', message: `Cover art must be square (1:1); this is ${c.width}×${c.height}.` });
  const side = Math.min(c.width, c.height);
  if (side < 640) add({ rule: 'resolution', severity: 'error', message: `Cover art must be at least 640 px on each side; this is ${c.width}×${c.height}.` });
  else if (side < (options.size ?? 3000)) add({ rule: 'resolution', severity: 'warning', message: `Deliver ${options.size ?? 3000}×${options.size ?? 3000} (stores and distributors ask for it); this is ${c.width}×${c.height}. Render with format: 'release'.` });
  if (Math.max(c.width, c.height) > 10000) add({ rule: 'resolution', severity: 'error', message: 'Cover art must be at most 10000 px on each side.' });

  // What's drawn (sizes in canvas px, through every group and transform).
  const { svg, drawn } = await renderReport(c);
  const texts = drawn.filter((d) => d.kind === 'text').map((d) => ({ ...d }));
  // Raw SVG text the layer system didn't set.
  for (const m of svg.matchAll(/<text\b[^>]*>([^<]+)<\/text>/g)) texts.push({ kind: 'text', content: m[1], size: undefined, capHeight: undefined });

  for (const t of texts) {
    const content = String(t.content ?? '');
    for (const [rule, severity, re, what] of RULES) {
      const m = re.exec(content);
      if (m) add({ rule, severity, layer: t.id, text: m[0].trim(), message: `Text contains ${what}: "${m[0].trim()}". Distributors reject cover art with ${what}.` });
    }
    // Legibility at a 64 px thumbnail: the block's smallest capitals as drawn,
    // narrowed by a heavy squeeze (justification scaling glyphs under 60% wide).
    if (t.capHeight != null) {
      const squeeze = (t.squeeze ?? 1) < SQUEEZE ? Math.sqrt(t.squeeze / SQUEEZE) : 1;
      const thumb = (t.capHeight * squeeze * 64) / Math.max(c.width, c.height);
      if (thumb < 4) add({ rule: 'legibility', severity: 'warning', layer: t.id, text: content.slice(0, 40), message: `"${content.slice(0, 40)}${content.length > 40 ? '…' : ''}" is ${thumb.toFixed(1)} px tall (capitals) at a 64 px thumbnail; under 4 px it can't be read.` });
    }
  }

  // Text that isn't the release's metadata. Text that is part of it (a
  // letter, a word knocked out of a shape) passes; so does anything spelled
  // inside the artist and title.
  if (options.artist || options.title) {
    const meta = `${options.artist ?? ''} ${options.title ?? ''}`.toLowerCase();
    const allowed = new Set(meta.split(/[^\p{L}\p{N}]+/u).filter(Boolean));
    const squashed = meta.replace(/[^\p{L}\p{N}]+/gu, '');
    const seen = new Set();
    for (const t of texts) {
      const text = String(t.content ?? '').toLowerCase();
      const letters = text.replace(/[^\p{L}\p{N}]+/gu, '');
      if (!letters || squashed.includes(letters) || seen.has(text)) continue;
      seen.add(text);
      const extra = text.split(/[^\p{L}\p{N}]+/u).filter((w) => w && !allowed.has(w));
      if (extra.length) add({ rule: 'metadata', severity: 'warning', layer: t.id, text: extra.slice(0, 6).join(' '), message: `Text doesn't match the release metadata (${extra.slice(0, 6).join(', ')}${extra.length > 6 ? ', …' : ''}). Stores ask that cover text matches the artist and title.` });
    }
  }

  // Barcodes and QR codes.
  const walk = (/** @type {any[]} */ list, /** @type {(l: any) => void} */ fn) => list.forEach((l) => { fn(l); for (const k of ['layers', 'mask', 'knockout', 'clip']) if (Array.isArray(l[k])) walk(l[k], fn); });
  walk(c.layers, (l) => {
    if (l.type === 'barcode') add({ rule: 'barcode', severity: 'error', layer: l.id, message: 'Cover art can\'t carry a barcode or QR code.' });
  });

  // Images drawn bigger than their pixels (at the delivery size), or
  // embedded at fewer pixels than they're drawn at.
  const delivery = (options.size ?? 3000) / Math.max(c.width, c.height);
  for (const im of drawn.filter((d) => d.kind === 'image' && d.source)) {
    const bw = im.drawn.width * delivery;
    const bh = im.drawn.height * delivery;
    // Output pixels per source pixel: contain fits the whole image, cover fills the box.
    const grow = im.fit === 'contain' ? Math.min(bw / im.source.width, bh / im.source.height) : im.fit === 'stretch' ? Math.max(bw / im.source.width, bh / im.source.height) : Math.max(bw / im.source.width, bh / im.source.height);
    if (grow > 1.05) add({ rule: 'upscaled', severity: 'warning', layer: im.id, message: `An image (${im.source.width}×${im.source.height}) is drawn ${grow.toFixed(1)}× its size at ${options.size ?? 3000}×${options.size ?? 3000}: it will look soft. Spotify asks for art that isn't upscaled.` });
    else if (im.embedded && Math.max(im.embedded.width / im.drawn.width, im.embedded.height / im.drawn.height) < 0.95) add({ rule: 'upscaled', severity: 'warning', layer: im.id, message: `An image is embedded at ${im.embedded.width}×${im.embedded.height} but drawn at ${Math.round(im.drawn.width)}×${Math.round(im.drawn.height)}: it was downsampled and will look soft.` });
  }

  return { ok: !issues.some((i) => i.severity === 'error'), target, issues };
}
