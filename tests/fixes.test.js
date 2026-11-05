// The 1.1 fixes and additions from porting the flyers and release covers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { renderSvg, renderImage, defineRecipe, lint } from '../src/index.js';
import { evaluate } from '../src/layers/expr.js';
import { luma } from '../src/type/auto-color.js';
import { decodeFont } from '../src/fonts.js';

const root = new URL('..', import.meta.url);
const photo = await readFile(new URL('examples/photo.jpg', root));
const grid = (layers, viewBox = [0, 0, 400, 500]) => ({ type: 'group', viewBox, layers });
/** @param {string} svg @returns {{ width: number, height: number }[]} Embedded image sizes. */
const embeds = async (svg) => Promise.all([...svg.matchAll(/href="data:image\/(?:jpeg|png);base64,([^"]+)"/g)].map(async (m) => sharp(Buffer.from(m[1], 'base64')).metadata()));

test('images in a viewBox group resample at output pixels, never past the source', async () => {
  // 1400×875 photo in a 400×500 grid at 3000 wide: drawn 3000 px across, capped at the source.
  const svg = await renderSvg({ width: 3000, height: 3750, layers: [grid([{ type: 'image', src: photo }])] });
  const [m] = await embeds(svg);
  assert.equal(m.format, 'jpeg');
  assert.ok(m.height === 875 && m.width < 1400 && m.width > 650, `${m.width}×${m.height}`);
  // At 600 wide: 600×750 drawn, embedded at that.
  const small = await embeds(await renderSvg({ width: 600, height: 750, layers: [grid([{ type: 'image', src: photo }])] }));
  assert.deepEqual([small[0].width, small[0].height], [600, 750]);
  // A transform's scale counts too.
  const scaled = await embeds(await renderSvg({ width: 400, height: 500, layers: [{ type: 'image', src: photo, width: 100, height: 100, transform: { scale: 4 } }] }));
  assert.equal(scaled[0].width, 400);
});

test('an alpha channel nobody uses embeds as JPEG; real transparency stays PNG', async () => {
  const opaque = await sharp({ create: { width: 64, height: 64, channels: 4, background: { r: 200, g: 40, b: 90, alpha: 1 } } }).png().toBuffer();
  const holed = await sharp({ create: { width: 64, height: 64, channels: 4, background: { r: 200, g: 40, b: 90, alpha: 0.4 } } }).png().toBuffer();
  assert.match(await renderSvg({ width: 200, layers: [{ type: 'image', src: opaque }] }), /data:image\/jpeg/);
  assert.match(await renderSvg({ width: 200, layers: [{ type: 'image', src: holed }] }), /data:image\/png/);
});

test('lint: upscaled images measured through the group scale', async () => {
  const issues = (await lint({ format: 'release', layers: [grid([{ type: 'image', src: photo }], [0, 0, 400, 400])] })).issues.map((i) => i.rule);
  assert.ok(issues.includes('upscaled'), 'a 1400×875 photo across 3000 px is upscaled');
  const fine = (await lint({ width: 1000, height: 1000, layers: [grid([{ type: 'image', src: photo, width: 200, height: 125 }], [0, 0, 400, 400])] }, { size: 1000 })).issues.map((i) => i.rule);
  assert.ok(!fine.includes('upscaled'), fine.join());
});

test('text keeps its opacity and blend on the poster typesetter', async () => {
  const svg = await renderSvg({ width: 400, layers: [{ type: 'text', content: 'Hi', x: 10, y: 100, opacity: 0.5, blend: 'multiply' }] });
  assert.match(svg, /<g opacity="0.5" style="mix-blend-mode:multiply"><path/);
});

test('effects: colorSpace, and a group\'s effects and masks in its own grid', async () => {
  const lin = await renderSvg({ width: 100, layers: [{ type: 'solid', effects: [{ kind: 'blur', colorSpace: 'linearRGB' }] }] });
  assert.match(lin, /color-interpolation-filters="linearRGB"/);
  const svg = await renderSvg({ width: 800, height: 1000, layers: [{ ...grid([{ type: 'solid', color: '#f00' }]), effects: [{ kind: 'xerox' }], clip: [{ type: 'shape', kind: 'circle', cx: 200, cy: 250, r: 100 }] }] });
  // The filter and the mask sit inside the grid's scale, so they're in its units.
  assert.match(svg, /<g transform="translate\(0 0\) scale\(2 2\)"><g mask="url\(#l0cm\)"><g filter="url\(#l0x0\)">/);
  assert.match(svg, /<circle cx="200" cy="250" r="100"/);
});

test('dither: on pixels, nearest-neighbour, and still a dither under a transform', async () => {
  const layers = [{ type: 'linear', colors: ['#000', '#fff'], angle: 90, effects: [{ kind: 'dither', cell: 8 }], transform: { rotate: 12, scale: 1.3 } }];
  const svg = await renderSvg({ width: 400, height: 400, layers });
  assert.match(svg, /<image[^>]*image-rendering="pixelated"/);
  const { data } = await sharp(await renderImage({ width: 400, height: 400, layers }, { format: 'png' })).raw().toBuffer({ resolveWithObject: true });
  const tones = new Set();
  for (let i = 0; i < data.length; i += 4 * 97) tones.add(data[i]);
  assert.ok(tones.size >= 2, 'ink and paper both show');
  const { channels } = await sharp(await renderImage({ width: 400, height: 400, layers }, { format: 'png' })).stats();
  assert.ok(channels[0].stdev > 40, `not a solid colour (stdev ${channels[0].stdev.toFixed(1)})`);
});

test('shape: rotation about a point, path viewBox about its centre, open arches, soft, tiles, presets', async () => {
  const svg = await renderSvg({ width: 400, layers: [{ type: 'shape', items: [
    { kind: 'rect', x: 10, y: 10, width: 40, height: 20, rotate: 30, origin: [10, 10] },
    { kind: 'path', d: 'M0 0H10V10H0Z', viewBox: [0, 0, 10, 10], x: 100, y: 100, width: 50, height: 50, rotate: 45 },
    { kind: 'arch', x: 200, y: 20, width: 60, height: 80, open: true, stroke: '#000' },
    { kind: 'circle', r: 30, soft: 10, fill: { type: 'tile', kind: 'checker', size: 6, colors: ['#fff', '#000'] } },
    { kind: 'rect', width: 50, height: 50, fill: { preset: 'chrome' } },
  ] }] });
  assert.match(svg, /rotate\(30 10 10\)/);
  assert.match(svg, /transform="rotate\(45 125 125\) translate\(100 100\) scale\(5 5\)/, 'turned about the drawn box, before mapping the viewBox');
  assert.match(svg, /V100" fill="none"/, 'an open arch has no Z and no fill');
  assert.match(svg, /<pattern[^>]*patternUnits="userSpaceOnUse"/);
  assert.match(svg, /<feGaussianBlur stdDeviation="10"/);
  assert.match(svg, /stroke="#0b0f18"/, 'chrome brings its keyline');
  const radial = await renderSvg({ width: 200, layers: [{ type: 'shape', kind: 'rect', width: 200, height: 100, fill: { type: 'radial', colors: ['#fff', '#000'], opacities: [1, 0], rx: 0.5, ry: 0.25 } }] });
  assert.match(radial, /gradientTransform="translate\(100 50\) scale\(1 0.25\)/);
  assert.match(radial, /stop-opacity="0"/);
});

test('recipes: anchors are checked when defined', () => {
  assert.throws(() => defineRecipe({ name: 'a', layers: [{ type: 'text', content: 'x', anchor: 'bottom-center' }] }), /unknown anchor "bottom-center"/);
  assert.throws(() => defineRecipe({ name: 'a', layers: [{ type: 'image', src: 'x.png', focus: 'middle' }] }), /unknown anchor "middle"/);
  defineRecipe({ name: 'a', layers: [{ type: 'image', src: 'x.png', focus: 'entropy' }, { type: 'text', content: 'x', anchor: '{opt.where}' }] });
});

test('color "auto": the site\'s luma rule (above 0.72 is dark type)', async () => {
  assert.ok(luma('#ff8fc8') < 0.72, 'a mid pink takes white');
  assert.ok(luma('#f4f1ea') > 0.72);
  const on = async (bg) => (await renderSvg({ width: 300, layers: [{ type: 'solid', color: bg }, { type: 'text', content: 'Hi', x: 10, y: 100, color: 'auto' }] })).match(/<path d="[^"]+" fill="(#[0-9a-f]+)"/)[1];
  assert.equal(await on('#ff8fc8'), '#ffffff');
  assert.equal(await on('#f4f1ea'), '#0b0b0b');
});

test('lint: no false positives from names, per-letter layers or scaled type', async () => {
  const rules = async (layers, meta) => (await lint({ format: 'release', layers }, meta)).issues.map((i) => `${i.rule}:${i.text ?? ''}`);
  const big = { size: 400 };
  const r = await rules([
    { type: 'text', content: 'Tidal Archive', x: 10, y: 600, ...big },
    { type: 'text', content: 'Second Sun', x: 10, y: 1200, ...big },
    { type: 'text', content: 'S', x: 10, y: 1800, ...big },
    { type: 'text', content: 'ROWING', x: 10, y: 2600, size: 60, transform: { scale: 8, origin: [10, 2600] } },
  ], { artist: 'Tidal Archive Rowing', title: 'Second Sun' });
  assert.deepEqual(r, []);
  const flagged = await rules([{ type: 'text', content: 'stream on Tidal · Sat 14', x: 10, y: 600, ...big }]);
  assert.ok(flagged.some((x) => x.startsWith('platform')) && flagged.some((x) => x.startsWith('date')), flagged.join());
});

test('repeat: grids, rings and lines with per-instance expressions; defs and use', async () => {
  assert.equal(evaluate('pick(i, 3, 5) + col * 2', { i: 1, col: 4 }), 13);
  assert.throws(() => evaluate('process.exit()', {}), /Unknown name|Can't read/);
  assert.throws(() => evaluate('constructor', {}), /Unknown name/);
  const svg = await renderSvg({ width: 400, layers: [
    { type: 'repeat', rows: 2, cols: 3, step: [50, 50], layer: { type: 'shape', kind: 'circle', cx: 0, cy: 0, r: '{#5 + col}', fill: '#000' }, odd: { fill: '#f00' }, skip: '{#i == 4}' },
    { type: 'repeat', count: 4, radius: 100, layer: { type: 'shape', kind: 'rect', width: 4, height: 10 } },
    { type: 'defs', layers: [{ id: 'dot', type: 'shape', kind: 'circle', r: 9, cx: 0, cy: 0 }] },
    { type: 'use', ref: 'dot', x: 10, y: 10 }, { type: 'use', ref: 'dot', x: 30, y: 10, scale: 2 },
  ] });
  assert.equal((svg.match(/<circle cx="0" cy="0" r="[5-7]"/g) ?? []).length, 5, 'six cells, one skipped');
  assert.equal((svg.match(/fill="#ff0000"/g) ?? []).length, 3, 'the checkerboard\'s odd cells (the skipped one was even)');
  assert.match(svg, /translate\(300 200\) rotate\(90\)/, 'a ring turns its instances');
  assert.equal((svg.match(/<use href="#l\d+u"/g) ?? []).length, 2, 'one drawing, two uses');
  defineRecipe({ name: 'r', layers: [{ type: 'repeat', count: 3, step: [10, 0], layer: { type: 'text', content: '{#i}', x: '{#i * 2}', y: 10 } }] });
});

test('text: spans, per-glyph control, fallback symbols, pixel type, words and wrap, layout references', async () => {
  const spans = await renderSvg({ width: 400, layers: [{ type: 'text', spans: [{ content: 'Plain ', weight: 400 }, { content: 'red', color: '#f00', scale: 1.5 }], x: 10, y: 100 }] });
  assert.equal((spans.match(/<path d=/g) ?? []).length, 2, 'one path per paint');
  assert.match(spans, /fill="#ff0000"/);
  const glyphs = await renderSvg({ width: 400, layers: [{ type: 'text', content: 'ABC', x: 10, y: 100, glyphs: { color: ['#f00', '#0f0', '#00f'], rotate: [10, 0, -10] } }] });
  assert.equal((glyphs.match(/<path d=/g) ?? []).length, 3);
  const symbols = await renderSvg({ width: 400, layers: [{ type: 'text', content: 'A ✺ ♡ ▶ ★', x: 10, y: 100 }] });
  const plain = await renderSvg({ width: 400, layers: [{ type: 'text', content: 'A', x: 10, y: 100 }] });
  assert.ok(symbols.length > plain.length + 400, 'the symbols are drawn, not .notdef boxes');
  const pixel = await renderSvg({ width: 400, layers: [{ type: 'text', content: 'Hi!', font: 'pixel', x: 10, y: 100, size: 70 }] });
  assert.match(pixel, /<path d="M10 51L17 51L17 58L10 58Z/, 'square cells');
  const words = await renderSvg({ width: 400, layers: [
    { id: 'name', type: 'text', content: 'Pale Orchard', fit: 'words', width: 200, x: 10, y: 60 },
    { type: 'shape', kind: 'line', x1: 10, x2: 210, y1: '{layout.name.bottom + 10}', stroke: '#000' },
  ] });
  const y = Number(words.match(/<path d="M10 ([\d.]+)L210/)[1]);
  assert.ok(y > 120 && y < 220, `the rule sits under two lines (${y})`);
  const wrapped = await renderSvg({ width: 400, layers: [{ type: 'text', content: 'wrap then fill the width', fit: 'wrap', width: 200, maxWidth: 200, x: 10, y: 60 }] });
  assert.ok((wrapped.match(/<path d=/g) ?? []).length === 1);
  const dashed = await renderSvg({ width: 400, layers: [{ type: 'text', content: 'S', x: 10, y: 100, fill: 'none', stroke: '#000', dash: [4, 2] }] });
  assert.match(dashed, /stroke-dasharray="4 2"/);
  const ex = await renderSvg({ width: 400, layers: [{ type: 'text', content: 'X', x: 10, y: 100, extrude: { depth: 10, steps: 5 } }] });
  assert.equal((ex.match(/<use /g) ?? []).length, 6, 'five steps and the face');
});

test('raw svg slots: a mark goes in as shapes, other markup is escaped', async () => {
  const svg = await renderSvg({ width: 200, mark: '<path d="M0 0h10v10z" onclick="x()"/><script>x</script>', recipe: { name: 's', layers: [{ type: 'svg', markup: '<g fill="red">{{mark}}</g><text>{{mark}}</text>' }] } });
  assert.match(svg, /<g fill="red"><path d="M0 0h10v10z"\/>&lt;script&gt;x&lt;\/script&gt;/);
  assert.doesNotMatch(svg, /onclick|<script/);
});

test('print cut: rounded corners from the format, drawn as a shape and the die line', async () => {
  const svg = await renderSvg({ format: 'ticket', dpi: 100, cutLine: true, layers: [{ type: 'shape', kind: 'cut', fill: '#e8541c' }] });
  const d = svg.match(/<path d="(M[^"]+)" fill="#e8541c"/)[1];
  assert.match(d, /C/, 'corners are curves');
  assert.match(svg, /<path d="M[^"]+C[^"]+" fill="none" stroke="#ec008c"[^>]*id="CutContour"/);
});

test('border: shape circle puts a round backing under the layer', async () => {
  const svg = await renderSvg({ width: 400, layers: [{ type: 'shape', kind: 'rect', x: 150, y: 150, width: 100, height: 100, fill: '#f00', effects: [{ kind: 'border', shape: 'circle', width: 10 }] }] });
  const r = Number(svg.match(/<circle cx="200" cy="200" r="([\d.]+)" fill="#ffffff"/)[1]);
  assert.ok(Math.abs(r - (Math.SQRT2 * 50 + 10)) < 3, `radius ${r}`);
});

test('a justification width on baseline text justifies one line; it wraps only with fit: "wrap"', async () => {
  const svg = await renderSvg({ width: 400, layers: [{ type: 'text', content: 'LOW ORBIT', x: 200, y: 300, size: 60, width: 368, align: 'center' }] });
  const xs = [...svg.match(/<path d="([^"]+)"/)[1].matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((m) => +m[1]);
  const ys = [...svg.match(/<path d="([^"]+)"/)[1].matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((m) => +m[2]);
  assert.ok(Math.min(...xs) < 25 && Math.max(...xs) > 375, 'spans the width (less side bearings)');
  assert.ok(Math.max(...ys) <= 301, 'one line');
});

test('fit: words (and width, wrap): only the widest line fills the width; the others keep their natural width', async () => {
  /** Ink extents of each line band, px. @param {any} layer @returns {Promise<number[]>} */
  const widths = async (layer) => {
    const png = await renderImage({ width: 400, height: 700, layers: [{ type: 'solid', color: '#fff' }, { type: 'text', color: '#000', ...layer }] }, { format: 'png', cache: false });
    const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
    const out = [];
    let band = null;
    for (let y = 0; y < info.height; y++) {
      let x0 = Infinity;
      let x1 = -1;
      for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * info.channels] < 128) { x0 = Math.min(x0, x); x1 = x; }
      if (x1 >= 0) band = band ? [Math.min(band[0], x0), Math.max(band[1], x1)] : [x0, x1];
      else if (band) { out.push(band[1] - band[0] + 1); band = null; }
    }
    return out;
  };
  const words = await widths({ content: 'Salt & Iron', fit: 'words', width: 300, x: 20, y: 120, weight: 800 });
  assert.equal(words.length, 3);
  assert.ok(Math.abs(Math.max(...words) - 300) < 20, `widest fills (ink, inside the sidebearings): ${words}`);
  assert.ok(words[1] < 150, `the "&" keeps its own width: ${words}`);
  const fitWidth = await widths({ content: ['WIDE LINE HERE', 'NO'], fit: 'width', width: 300, x: 20, y: 120 });
  assert.ok(fitWidth[1] < 100, `fit: width, the short line stays short: ${fitWidth}`);
  // Without a fit, `width` still justifies every line (documented).
  const just = await widths({ content: ['WIDE LINE HERE', 'NO'], width: 300, x: 20, y: 120 });
  assert.ok(just.every((w) => w > 260 && w <= 302), `width alone justifies every line: ${just}`);
});

test('WOFF2: a rebuilt glyf past 128 KB gets a long loca (digits and "/" drew nothing in Doto); composite digits draw', async () => {
  // Generated by fixtures/composite-digits.py: composite digits and "/" after 120 dense glyphs,
  // so the glyf rebuilt from WOFF2's transform outgrows the font's short loca.
  const w2 = await readFile(new URL('fixtures/composite-digits.woff2', import.meta.url));
  /** Ink box of one character at 100 px (a font unit is 0.1 px). @param {string} ch */
  const ink = async (ch) => {
    const png = await renderImage({ width: 80, height: 100, fonts: [{ name: 'Digits', data: w2 }], layers: [{ type: 'solid', color: '#fff' }, { type: 'text', content: ch, font: 'Digits', weight: 400, size: 100, x: 0, y: 90, color: '#000', letterSpacing: 0 }] }, { format: 'png', cache: false });
    const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
    let x0 = Infinity; let x1 = -1; let y0 = Infinity; let y1 = -1;
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * info.channels] < 128) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    return { w: x1 - x0 + 1, h: y1 - y0 + 1 };
  };
  // "0", "2"–"9": a ring 50 px across (plus a bar); "1" and "/": a bar 5 × 70 px.
  for (const ch of '0123456789/') {
    const { w, h } = await ink(ch);
    if (ch === '1' || ch === '/') assert.ok(Math.abs(w - 5) <= 2 && Math.abs(h - 70) <= 2, `${ch}: ${w}×${h}`);
    else assert.ok(w >= 48 && w <= 54 && h >= 48 && h <= 72, `${ch}: ${w}×${h}`);
  }
  const sfnt = decodeFont(w2);
  const dv = new DataView(sfnt.buffer, sfnt.byteOffset);
  const tables = new Map(Array.from({ length: dv.getUint16(4) }, (_, i) => [String.fromCharCode(...sfnt.subarray(12 + i * 16, 16 + i * 16)), dv.getUint32(12 + i * 16 + 8)]));
  assert.equal(dv.getInt16(/** @type {number} */ (tables.get('head')) + 50), 1, 'head says long loca');
});

test('renderSvg images: "webp" re-encodes embedded photos and pixel effects where smaller; the default is unchanged', async () => {
  const input = { width: 400, height: 250, layers: [{ type: 'image', src: photo }, { type: 'shape', kind: 'circle', cx: 200, cy: 125, r: 60, fill: '#f60', effects: [{ kind: 'pixelate', size: 12 }] }] };
  const plain = await renderSvg(input);
  const webp = await renderSvg(input, { images: 'webp' });
  assert.match(plain, /data:image\/jpeg/);
  assert.doesNotMatch(webp, /data:image\/jpeg/);
  assert.match(webp, /data:image\/webp/);
  assert.ok(webp.length < plain.length, `${webp.length} < ${plain.length}`);
  assert.equal(await renderSvg(input), plain);
  await assert.rejects(renderSvg(input, { images: /** @type {any} */ ('avif') }), /Unknown images "avif"/);
});
