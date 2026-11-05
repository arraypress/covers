import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import sharp from 'sharp';
import {
  cover, renderSvg, renderImage, renderPages, defineRecipe, loadRecipe, configure, registerFont, FORMATS, lint, kit, KIT_FORMATS, safeBox, EFFECTS, valueAt,
} from '../src/index.js';
import { code128 } from '../src/layers/code128.js';
import { RASTER_EFFECTS } from '@arraypress/image-effects';
import { parseSfnt } from '../src/type/sfnt.js';
import { decodeFont, bundledFonts, loadFont } from '../src/fonts.js';
import { generated } from '../scripts/generate.mjs';
import { imageSize } from '../src/lint/image-size.js';

const root = new URL('..', import.meta.url);
/** Markup without its embedded data URIs (base64 can spell anything). */
const bare = (svg) => svg.replace(/data:[^"')]+/g, '');
const photo = await readFile(new URL('examples/photo.jpg', root));
const MARK = '<path fill-rule="evenodd" d="M256 48c-74 64-120 140-120 214a120 120 0 0 0 240 0c0-74-46-150-120-214zm0 100c30 32 50 66 50 100a50 50 0 0 1-100 0c0-34 20-68 50-100z"/>';
const lum = async (svg) => {
  const { data } = await sharp(Buffer.from(svg)).resize(1, 1).raw().toBuffer({ resolveWithObject: true });
  return (data[0] + data[1] + data[2]) / 3;
};
/** The x-extent of an outline's path data. */
const xExtent = (d) => {
  const xs = [...d.matchAll(/([MLQC])([^MLQCZ]*)/g)].flatMap((m) => m[2].trim().split(/[\s,]+/).filter((_, i) => i % 2 === 0).map(Number));
  return [Math.min(...xs), Math.max(...xs)];
};

// ---------------------------------------------------------------------------
// Isomorphic
// ---------------------------------------------------------------------------

test('no node: imports outside the ./node entry, and generated modules are current', async () => {
  for (const f of await readdir(new URL('src/', root))) {
    if (!f.endsWith('.js') || f === 'node.js') continue;
    const text = await readFile(new URL(`src/${f}`, root), 'utf8');
    assert.doesNotMatch(text, /from ['"]node:|import\(['"]node:|require\(/, f);
  }
  for (const [file, text] of Object.entries(generated())) assert.equal(await readFile(new URL(file, root), 'utf8'), text, `${file}: run npm run generate`);
});

test('loading: data URIs and bytes work; http(s) is refused in Node unless allowed', async () => {
  const uri = `data:image/jpeg;base64,${photo.toString('base64')}`;
  const svg = await renderSvg({ width: 200, layers: [{ type: 'image', src: uri }] });
  assert.match(svg, /<image/);
  await assert.rejects(renderSvg({ layers: [{ type: 'image', src: 'https://example.com/a.jpg' }] }), /never fetch/);
  let asked;
  configure({ load: (src) => { asked = src; return photo; } });
  try {
    assert.match(await renderSvg({ width: 200, layers: [{ type: 'image', src: 'https://cdn.example/a.jpg' }] }), /<image/);
    assert.equal(asked, 'https://cdn.example/a.jpg');
  } finally {
    configure({ load: undefined });
  }
});

test('the JavaScript outliner reads Inter like HarfBuzz does', async () => {
  const sfnt = decodeFont(bundledFonts()[2].data);
  const js = parseSfnt(sfnt);
  const hb = await loadFont(bundledFonts()[2]);
  const text = 'AVATAR Typeset, kerned.';
  const a = js.shape(text).map((g) => [g.gid, g.advance]);
  const b = hb.shapeRun(text).map((g) => [g.gid, g.xAdvance]);
  assert.deepEqual(a, b, 'same glyphs and kerned advances');
  const gid = a[0][0];
  const pts = (d) => d.match(/-?[\d.]+/g).map(Number);
  assert.deepEqual(pts(js.glyphToPath(gid)), pts(hb.glyphToPath(gid)), 'same outline points');
  assert.throws(() => parseSfnt(new Uint8Array([0x4f, 0x54, 0x54, 0x4f, 0, 0, 0, 0, 0, 0, 0, 0])), /CFF/);
});

test('fonts: registered by src or bytes, variable weights pick an instance', async () => {
  // Inter's bundled 400 under another name, by path.
  registerFont({ name: 'Paper Sans', src: new URL('fonts/inter-latin-400.woff', root).pathname, weight: 400 });
  const a = await renderSvg({ width: 400, layers: [{ type: 'text', content: 'Hello', font: 'Paper Sans', weight: 400 }] });
  const b = await renderSvg({ width: 400, layers: [{ type: 'text', content: 'Hello', weight: 400 }] });
  assert.equal(a, b, 'the same face, by path');
  // Damaged WOFF2 is refused with a clear error (real WOFF2 decodes: covers.test.js).
  await assert.rejects(renderSvg({ width: 200, fonts: [{ name: 'W2', data: new Uint8Array([0x77, 0x4f, 0x46, 0x32, 0, 0, 0, 0, 0, 0, 0, 0]) }], layers: [{ type: 'text', content: 'x', font: 'W2', x: 0, y: 50 }] }), /WOFF2/);
});

// ---------------------------------------------------------------------------
// Type
// ---------------------------------------------------------------------------

test('text: baseline placement and justification to a width (textLength)', async () => {
  const svg = await renderSvg({ width: 400, height: 500, layers: [{ type: 'text', content: 'Grid,', weight: 800, size: 133, x: 13, y: 294, width: 373 }] });
  const d = svg.match(/<path d="([^"]+)"/)[1];
  const [x0, x1] = xExtent(d);
  assert.ok(Math.abs(x0 - 13) < 14 && Math.abs(x1 - 386) < 14, `${x0}–${x1} spans 13–386`);
  const spacing = await renderSvg({ width: 400, height: 500, layers: [{ type: 'text', content: 'Grid,', size: 60, x: 13, y: 100, width: 373, lengthAdjust: 'spacing' }] });
  const [s0, s1] = xExtent(spacing.match(/<path d="([^"]+)"/)[1]);
  assert.ok(s1 - s0 > 340, 'spacing opens the letters to the width');
});

test('text: fit to width, per-line fit, stretch, strokes, outline type', async () => {
  const lines = await renderSvg({ width: 400, height: 500, layers: [{ type: 'text', content: 'Grid,\nRest,\nRhythm.', fit: 'lines', x: 13, y: 150, width: 373, weight: 800 }] });
  assert.match(lines, /<path d="M/);
  const stretched = await renderSvg({ width: 400, height: 500, layers: [{ type: 'text', content: 'OXYDE', x: 14, y: 238, size: 98, stretch: [1, 2.5] }] });
  assert.match(stretched, /scale\(1 2\.5\)/);
  const keyline = await renderSvg({ width: 400, layers: [{ type: 'text', content: 'NORTH', x: 20, y: 200, size: 80, color: '#b8322a', strokes: [{ color: '#1c2747', width: 13 }, { color: '#f1e8d3', width: 6.5 }] }] });
  const order = [...keyline.matchAll(/stroke-width="([\d.]+)"/g)].map((m) => +m[1]);
  assert.deepEqual(order, [13, 6.5], 'widest keyline first');
  const outline = await renderSvg({ width: 400, layers: [{ type: 'text', content: 'SYSTEM', x: 20, y: 200, size: 40, fill: 'none', stroke: '#fff', strokeWidth: 1.1 }] });
  assert.match(outline, /fill="none" stroke="#ffffff"/);
  assert.doesNotMatch(outline, /<path d="[^"]+" fill="#/);
});

test('text: on a path (circle, arc, wave, d), filling a ring', async () => {
  for (const path of [{ kind: 'circle', cx: 200, cy: 200, r: 120 }, { kind: 'arc', cx: 200, cy: 330, r: 186, start: -90, end: 90 }, { kind: 'wave', y: 300, amplitude: 9, wavelength: 200 }, { d: 'M92 352Q200 374 308 352' }]) {
    const svg = await renderSvg({ width: 400, layers: [{ type: 'text', content: 'ROWING CLUB', size: 20, path }] });
    assert.match(svg, /<path d="M/, JSON.stringify(path));
    assert.doesNotMatch(svg, /NaN/);
  }
  const ring = await renderSvg({ width: 400, layers: [{ type: 'text', content: 'ALL DAY ALL NIGHT', size: 19, path: { kind: 'circle', cx: 200, cy: 200, r: 120 }, fitPath: 4 }] });
  assert.match(ring, /<path d="M/);
});

test('text: live <text> with an embedded @font-face', async () => {
  const svg = await renderSvg({ width: 400, layers: [{ type: 'text', content: 'Live type', render: 'live', x: 20, y: 100, size: 40, width: 300, axes: { wdth: 80 } }] });
  assert.match(svg, /<style>@font-face\{font-family:"covers-Inter-600-normal";src:url\("data:font\/woff;base64,/);
  assert.match(svg, /<text[^>]*textLength="300" lengthAdjust="spacingAndGlyphs"[^>]*>Live type<\/text>/);
  const both = await renderSvg({ width: 400, textRender: 'live', layers: [{ type: 'text', content: 'A', x: 0, y: 50 }, { type: 'text', content: 'B', x: 0, y: 90 }] });
  assert.equal(both.match(/@font-face/g).length, 1, 'one @font-face per face per document');
});

test('text: color "auto" picks white over a dark photo and black over a light one', async () => {
  const dark = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#101010' } }).png().toBuffer();
  const light = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#f2f2f2' } }).png().toBuffer();
  const fill = async (src) => (await renderSvg({ width: 300, layers: [{ type: 'image', src }, { type: 'text', content: 'Auto ink', color: 'auto', anchor: 'center' }] })).match(/<path d="[^"]+" fill="(#\w+)"/)[1];
  assert.equal(await fill(dark), '#ffffff');
  assert.equal(await fill(light), '#0b0b0b');
});

// ---------------------------------------------------------------------------
// Layers, effects, masks
// ---------------------------------------------------------------------------

test('effects: every kind compiles to a filter, in order, innermost first', async () => {
  for (const kind of EFFECTS) {
    const fx = kind === 'filter' ? { kind, markup: '<feGaussianBlur stdDeviation="{{seed}}"/>' } : kind === 'matrix' ? { kind, values: '1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0' } : { kind };
    const svg = await renderSvg({ width: 300, layers: [{ type: 'shape', kind: 'circle', r: 80, fill: '#888', effects: [fx] }] });
    // dither is computed on pixels (sharp is here); extrude is copies of the markup.
    if (kind === 'dither') assert.match(svg, /<image[^>]*image-rendering="pixelated"/, kind);
    else if (kind === 'extrude') assert.match(svg, /<use href="#l0x0s"\/>/, kind);
    // Copies of the markup, and effects computed on pixels (embedded as an image).
    else if (kind === 'mirror') assert.match(svg, /<use href="#l0x0s"/, kind);
    else if (RASTER_EFFECTS.includes(kind)) assert.match(svg, /<image[^>]*href="data:image\/(png|jpeg);base64/, kind);
    else assert.match(svg, /<filter id="l0x0"/, kind);
    assert.doesNotMatch(bare(svg), /NaN|undefined/, kind);
  }
  const motion = await renderSvg({ width: 300, layers: [{ type: 'solid', effects: [{ kind: 'motion', angle: 10, length: 26 }] }] });
  assert.match(motion, /rotate\(10 150 150\)"><g filter="url\(#l0x0\)"><g transform="rotate\(-10 150 150\)">/);
  assert.match(motion, /stdDeviation="26 0"/);
  await assert.rejects(renderSvg({ layers: [{ type: 'solid', effects: [{ kind: 'sparkle' }] }] }), /Unknown effect "sparkle"/);
  const ht = await renderSvg({ width: 200, layers: [{ type: 'image', src: photo, effects: [{ kind: 'halftone', ink: '#0078bf', cell: 5.2, angle: 15 }] }] });
  assert.match(ht, /<feImage[^>]*href="data:image\/png;base64/, 'a PNG screen librsvg can load');
  const raster = await renderImage({ width: 200, layers: [{ type: 'image', src: photo, effects: [{ kind: 'halftone' }, { kind: 'wear' }] }] }, { format: 'png' });
  assert.ok((await sharp(raster).metadata()).width === 200);
});

test('knockout, clip and mask: sub-stacks as luminance masks; blend stays outermost', async () => {
  const svg = await renderSvg({ width: 400, height: 500, layers: [
    { type: 'image', src: photo },
    { type: 'solid', color: '#f29ad8', opacity: 0.94, blend: 'multiply', knockout: [{ type: 'text', content: 'MAKE IT', size: 120, x: 14, y: 118, width: 372 }, { type: 'icon', markup: MARK, x: 130, y: 128, size: 120 }] },
  ] });
  assert.match(svg, /<mask id="l1km"[^>]*><rect[^>]*fill="#fff"\/><g filter="url\(#l1kf\)">/);
  assert.match(svg, /<g opacity="0.94" style="mix-blend-mode:multiply"><g mask="url\(#l1km\)"><rect/);
  const clip = await renderSvg({ width: 300, layers: [{ type: 'image', src: photo, clip: [{ type: 'shape', kind: 'circle', r: 100 }] }] });
  assert.match(clip, /values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"/, 'clip paints its shapes white');
  const fade = await renderSvg({ width: 300, layers: [{ type: 'image', src: photo, mask: [{ type: 'linear', angle: 180, colors: ['#fff', '#000'] }] }] });
  assert.match(fade, /<mask id="l0mm"/);
  const px = await renderImage({ width: 400, height: 500, layers: [{ type: 'solid', color: '#000' }, { type: 'solid', color: '#ffffff', knockout: [{ type: 'shape', kind: 'rect', x: 0, y: 0, width: 200, height: 500 }] }] }, { format: 'png' });
  const { data, info } = await sharp(px).raw().toBuffer({ resolveWithObject: true });
  assert.ok(data[0] < 10 && data[(250 * 400 + 300) * info.channels] > 245, 'cut on the left, kept on the right');
});

test('group: a design grid (viewBox) fitted to any canvas, transforms and areas', async () => {
  const layers = [{ type: 'group', viewBox: [0, 0, 400, 500], layers: [{ type: 'shape', kind: 'rect', x: 16, y: 16, width: 368, height: 300, fill: '#ff6c2f' }] }];
  assert.match(await renderSvg({ width: 400, height: 500, layers }), /<rect x="16" y="16" width="368"/);
  assert.match(await renderSvg({ width: 1600, height: 2000, layers }), /scale\(4 4\)/);
  assert.match(await renderSvg({ width: 3000, height: 3000, layers }), /translate\(300 0\) scale\(6 6\)/, 'contained, centred');
  const t = await renderSvg({ width: 400, layers: [{ type: 'solid', transform: { translate: [1.8, -1.3], rotate: 0.25, origin: [200, 250] } }] });
  assert.match(t, /transform="translate\(1.8 -1.3\) translate\(200 250\) rotate\(0.25\) translate\(-200 -250\)"/);
  const mirror = await renderSvg({ width: 400, layers: [{ type: 'text', content: 'ARC', x: 0, y: 100, transform: { mirror: 'y', origin: [0, 104] } }] });
  assert.match(mirror, /scale\(1 -1\)/);
  assert.match(await renderSvg({ width: 400, layers: [{ type: 'text', content: 'case', transform: 'uppercase' }] }), /<path/, 'a case keyword is still the case');
});

test('shapes, svg, table, barcode, perforation, tear and texture', async () => {
  const kinds = ['rect', 'circle', 'ellipse', 'line', 'polygon', 'polyline', 'star', 'burst', 'scallop', 'rays', 'ring', 'sector', 'arch', 'wave', 'path'];
  const items = kinds.map((kind) => ({ kind, points: kind.startsWith('poly') ? [[0, 0], [40, 40], [80, 0]] : undefined, d: 'M0 0L10 10', stroke: '#000' }));
  const s = await renderSvg({ width: 400, layers: [{ type: 'shape', items }, { type: 'shape', kind: 'rect', x: 20, y: 20, width: 200, height: 100, edge: { kind: 'deckle', sides: ['top', 'bottom'] }, fill: { type: 'linear', colors: ['#ff9fd8', '#ffe28a', '#8fd6ff'], angle: 45, spread: 'reflect', length: 60 } }] });
  assert.doesNotMatch(s, /NaN|undefined/);
  assert.match(s, /spreadMethod="reflect"/);
  await assert.rejects(renderSvg({ layers: [{ type: 'shape', kind: 'blob' }] }), /Unknown shape kind/);

  const raw = await renderSvg({ width: 400, palette: 'dusk', layers: [{ type: 'svg', markup: '<circle r="10" fill="{{@accent}}" id="{{id}}c" onclick="x()"/><script>alert(1)</script><image href="https://evil.example/x.png"/>' }] });
  assert.match(raw, new RegExp(`fill="${cover({ palette: 'dusk' }).palette.accent}" id="l0c"`));
  assert.doesNotMatch(raw, /script|onclick|evil/);

  const tab = await renderSvg({ width: 400, layers: [{ type: 'table', y: 26, size: 9, columns: [{ x: 16, weight: 700 }, { x: 384, align: 'right' }], rows: [['Doors', '7 pm'], [{ content: 'Entry', color: '#ff0000' }, 'Free']], rules: { at: 'between' } }] });
  assert.match(tab, /fill="#ff0000"/);
  assert.match(tab, /stroke-width/);

  const widths = code128('HF-0042');
  assert.equal(widths.reduce((a, b) => a + b, 0), 11 * ('HF-0042'.length + 3) + 2, 'start, data, check symbol and stop modules');
  assert.deepEqual(widths.slice(0, 6), [2, 1, 1, 2, 1, 4], 'start B');
  assert.deepEqual(widths.slice(-7), [2, 3, 3, 1, 1, 1, 2], 'stop');
  assert.throws(() => code128('é'), /can't encode/);

  const perf = await renderSvg({ width: 400, layers: [{ type: 'perforation', x: 232, kind: 'holes' }, { type: 'perforation', y1: 300, y2: 300, x1: 0, x2: 400, kind: 'dashes' }] });
  assert.ok(perf.match(/<circle/g).length > 10);

  const sheet = await renderSvg({ width: 400, height: 500, seed: 't', layers: [{ type: 'tear', seed: 'rip', color: '#f29ad8', rip: false, fibres: false }] });
  const edge = await renderSvg({ width: 400, height: 500, seed: 't', layers: [{ type: 'tear', seed: 'rip', color: 'none' }] });
  const line = edge.match(/<path d="(M[^"]+)" stroke="#fff6fb" stroke-width="[\d.]+" fill="none" opacity="0.9"/)[1];
  assert.ok(sheet.includes(line.replace(/^M/, 'L').slice(0, 40)), 'the sheet and the edge follow one tear');

  for (const kind of ['paper', 'creases', 'concrete', 'speck', 'wood', 'folds', 'dust']) {
    assert.doesNotMatch(await renderSvg({ width: 300, layers: [{ type: 'texture', kind }] }), /NaN|undefined/, kind);
  }
});

test('icon: a mark as bare path markup on a 512 grid, placed by its corner', async () => {
  const svg = await renderSvg({ width: 400, height: 500, layers: [{ type: 'icon', markup: MARK, x: 330, y: 22, size: 50, color: '#ff48b0' }] });
  assert.match(svg, /<svg x="330" y="22" width="50" height="50" viewBox="0 0 512 512"[^>]*color="#ff48b0"><g fill="currentColor"><path fill-rule="evenodd"/);
});

// ---------------------------------------------------------------------------
// Formats, print, pages
// ---------------------------------------------------------------------------

test('formats: screen sizes, and print sizes with bleed at a dpi', () => {
  assert.deepEqual([cover({ format: 'release' }).width, cover({ format: 'release' }).height], [3000, 3000]);
  for (const [name, w, h] of [['instagram-post', 1080, 1350], ['instagram-story', 1080, 1920], ['youtube-thumbnail', 1280, 720], ['spotify-canvas', 1080, 1920], ['bandcamp-header', 975, 180], ['x-header', 1500, 500], ['youtube-banner', 2560, 1440], ['linkedin-banner', 1584, 396], ['pinterest', 1000, 1500], ['twitch-banner', 1200, 480]]) {
    const c = cover({ format: name });
    assert.deepEqual([c.width, c.height], [w, h], name);
  }
  // 85×55 mm at 300 dpi = 1004×650 px trim, + 3 mm (35 px) bleed each side.
  const card = cover({ format: 'business-card' });
  assert.deepEqual([card.width, card.height], [1004 + 70, 650 + 70]);
  assert.equal(card.print.bleed, 35);
  const us = cover({ format: 'business-card-us', dpi: 600, bleed: false });
  assert.deepEqual([us.width, us.height], [2100, 1200]);
  assert.deepEqual([cover({ format: 'instagram-post', width: 540 }).height, cover({ format: 'instagram-post', width: 540 }).zones.safe[1]], [675, 68]);
  assert.throws(() => cover({ format: 'imax' }), /Unknown format "imax"/);
  for (const [name, f] of Object.entries(FORMATS)) {
    if (!f.zones) continue;
    const [x, y, w, h] = f.zones.safe;
    assert.ok(x >= 0 && y >= 0 && x + w <= f.width && y + h <= f.height, `${name}: the safe zone is inside the canvas`);
  }
});

test('safe zones: anchored type and marks land inside them; the overlay draws them', async () => {
  for (const format of ['instagram-story', 'x-header', 'youtube-banner', 'tiktok-cover', 'avatar']) {
    const c = cover({ format, layers: [{ type: 'solid' }, { type: 'text', content: 'Hollow Fern', anchor: 'bottom-left', id: 't' }, { type: 'text', content: 'Top', anchor: 'top-right' }] });
    const sb = safeBox(c);
    const svg = await renderSvg(c);
    for (const m of svg.matchAll(/<g transform="translate\(([\d.]+) ([\d.]+)\)"><path d="([^"]+)"/g)) {
      const [x0, x1] = xExtent(m[3]).map((v) => v + Number(m[1]));
      assert.ok(x0 >= sb.x - 1 && x1 <= sb.x + sb.width + 1, `${format}: text inside the safe zone horizontally`);
    }
    assert.match(svg, /<g transform="translate\(/, `${format}: laid out in the safe box`);
  }
  const preview = await renderSvg({ format: 'youtube-banner', overlay: true, layers: [{ type: 'solid' }] });
  assert.match(preview, /stroke="#18e05a"/);
  assert.doesNotMatch(await renderSvg({ format: 'youtube-banner', layers: [{ type: 'solid' }] }), /#18e05a/);
});

test('print: crop marks, a die line, the dpi in the image', async () => {
  const c = { format: 'business-card', cropMarks: true, cutLine: true, layers: [{ type: 'solid', color: '#2f6b4f' }] };
  const svg = await renderSvg(c);
  const card = cover(c);
  const s = card.print.slug;
  assert.match(svg, new RegExp(`width="${card.width + 2 * s}" height="${card.height + 2 * s}"`));
  assert.match(svg, /clip-path="url\(#bleed\)"/);
  assert.match(svg, /id="CutContour"/);
  const png = await renderImage(c, { format: 'png' });
  const meta = await sharp(png).metadata();
  assert.equal(meta.width, card.width + 2 * s);
  assert.equal(Math.round(meta.density), 300);
});

test('pages: one call renders the front and the back', async () => {
  const card = defineRecipe({ name: 'card', pages: ['front', 'back'], layers: [
    { type: 'solid', color: '@accent', when: { page: 'front' } },
    { type: 'solid', color: '@bg', when: { page: 'back' } },
    { type: 'text', content: '{name}', when: { page: 'front' } },
    { type: 'table', rows: '{lines}', y: '60%', columns: [{ x: '@safeX' }], when: { all: ['lines', { page: 'back' }] } },
  ] });
  const { front, back } = await renderPages({ recipe: card, format: 'business-card', name: 'Hollow Fern', lines: ['hello@hollowfern.example', '12 Kiln Yard'] });
  assert.notEqual(front, back);
  assert.match(back, /<path d="M/);
  const all = await renderPages({ recipe: 'brand', format: 'business-card', name: 'Hollow Fern', mark: MARK, person: 'Mira Okafor', lines: ['a', 'b'] });
  assert.deepEqual(Object.keys(all), ['front', 'back']);
});

test('kit: a brand on every format in one call', async () => {
  const files = await kit({ name: 'Hollow Fern', tagline: 'Field recordings', palette: { accent: '#2f6b4f' }, mark: MARK, lines: ['hello@hollowfern.example'], person: 'Mira Okafor' }, { formats: ['avatar', 'x-header', 'instagram-story', 'business-card', 'letterhead'] });
  assert.deepEqual(Object.keys(files), ['avatar', 'x-header', 'instagram-story', 'business-card', 'letterhead']);
  assert.match(files['x-header'], /width="1500" height="500"/);
  assert.ok(files['business-card'].front && files['business-card'].back);
  assert.ok(KIT_FORMATS.social.length >= 15 && KIT_FORMATS.print.includes('business-card'));
});

// ---------------------------------------------------------------------------
// lint
// ---------------------------------------------------------------------------

test('lint (spotify): size, square, and text a distributor would reject', async () => {
  const clean = await lint({ recipe: 'bigType', seed: 'l', title: 'Night Garden', format: 'release' }, { target: 'spotify', title: 'Night Garden' });
  assert.equal(clean.ok, true, JSON.stringify(clean.issues));
  const rules = async (o, opts) => (await lint(o, opts)).issues.map((i) => i.rule);
  assert.ok((await rules({ recipe: 'bigType', seed: 'l', title: 'x', format: 'instagram-post' })).includes('aspect'));
  assert.ok((await rules({ recipe: 'bigType', seed: 'l', title: 'x', width: 500, height: 500 })).includes('resolution'));
  const bad = await rules({ seed: 'l', format: 'release', layers: [
    { type: 'text', content: 'Out now — £9.99 at hollowfern.com', anchor: 'top-left' },
    { type: 'text', content: 'follow @hollowfern', anchor: 'center' },
    { type: 'text', content: 'Sat 14 March', anchor: 'bottom-left', size: 20 },
    { type: 'barcode', value: '123' },
  ] });
  for (const r of ['promo', 'price', 'url', 'handle', 'date', 'legibility', 'barcode']) assert.ok(bad.includes(r), `${r} in ${bad}`);
  const small = await sharp({ create: { width: 300, height: 300, channels: 3, background: '#335' } }).jpeg().toBuffer();
  assert.ok((await rules({ format: 'release', layers: [{ type: 'image', src: small }] })).includes('upscaled'));
  assert.ok((await rules({ recipe: 'bigType', seed: 'l', title: 'Night Garden Deluxe', format: 'release' }, { title: 'Night Garden' })).includes('metadata'));
  assert.deepEqual(imageSize(small), { width: 300, height: 300 });
});

// ---------------------------------------------------------------------------
// Animation
// ---------------------------------------------------------------------------

test('animation: keyframed options are drawn at t; static covers ignore t', async () => {
  assert.equal(valueAt({ keyframes: [[0, 0], [2, 10]], ease: 'linear' }, 1), 5);
  assert.equal(valueAt({ keyframes: [[0, '#000000'], [1, '#ffffff']], ease: 'linear' }, 0.5).length, 7);
  assert.equal(valueAt({ keyframes: [[0, '2vmin'], [1, '6vmin']], ease: 'linear' }, 0.5), '4vmin');
  assert.equal(valueAt({ keyframes: [[0, 0], [1, 10]], ease: 'linear', loop: 'pingpong' }, 1.25), 7.5);
  const c = { width: 300, layers: [{ type: 'solid', opacity: { keyframes: [[0, 0.2], [1, 0.8]], ease: 'linear' } }] };
  assert.match(await renderSvg(c, { t: 0.5 }), /opacity="0.5"/);
  assert.match(await renderSvg(c), /opacity="0.2"/, 'no t: the first frame');
  const still = { recipe: 'aurora', seed: 's', width: 300 };
  assert.equal(await renderSvg(still, { t: 3 }), await renderSvg(still));
});

// ---------------------------------------------------------------------------
// JSON recipes
// ---------------------------------------------------------------------------

test('JSON: nested layers validated, {{slots}} in raw svg, list operators, paths into options', async () => {
  assert.throws(() => defineRecipe({ name: 'n', layers: [{ type: 'solid', knockout: [{ type: 'text', sizee: 3 }] }] }), /layers\[0\]\.knockout\[0\]\.sizee: "text" layers have no option "sizee"/);
  assert.throws(() => defineRecipe({ name: 'n', layers: [{ type: 'svg', markup: '<text>{{nope}}</text>' }] }), /unknown param "nope"/);
  const r = defineRecipe({ name: 'slots', params: { venue: 'The Kiln' }, layers: [
    { type: 'svg', markup: '<text>{{venue}} · {{name}}</text><rect fill="{{@accent}}"/>' },
    { type: 'text', content: { join: ['{lineup}', ' / '] }, x: 10, y: 50 },
    { type: 'text', content: { upper: '{lineup.1}' }, x: 10, y: 90 },
  ] });
  const c = cover({ recipe: r, name: 'Fern & <Co>', lineup: ['Ama', 'Bo', 'Cy'] });
  assert.equal(c.layers[0].markup, '<text>The Kiln · Fern &amp; &lt;Co&gt;</text><rect fill="{{@accent}}"/>');
  assert.equal(c.layers[1].content, 'Ama / Bo / Cy');
  assert.equal(c.layers[2].content, 'BO');
  assert.match(await renderSvg(c), new RegExp(`fill="${c.palette.accent}"`));
});

test('the published flyers (recipes/flyers) validate and render at 4:5 and 3000×3000', async () => {
  for (const f of ['bloomfall', 'grid-rest-rhythm', 'wheatpaste-torn']) {
    const recipe = loadRecipe(new URL(`recipes/flyers/${f}.json`, root));
    for (const format of ['flyer', 'release']) {
      const svg = await renderSvg({ recipe, seed: f, format, mark: MARK, photo, cutout: photo });
      assert.match(svg, format === 'flyer' ? /width="1600" height="2000"/ : /width="3000" height="3000"/, `${f} ${format}`);
      assert.doesNotMatch(bare(svg), /NaN|undefined/, f);
    }
  }
});
