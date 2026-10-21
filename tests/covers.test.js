import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import {
  cover, renderSvg, renderImage, coverKey, recipes, palettes, resolvePalette, derivePalette,
  toHex, resolveSize, createRng, hashString, registerIcons, layers,
} from '../src/index.js';
import { layout } from '../src/text.js';
import { harfbuzz, loadFont, bundledFonts, decodeFont } from '../src/fonts.js';
import { contrastRatio, relativeLuminance } from '@arraypress/color-utils';

const photo = await sharp({ create: { width: 64, height: 40, channels: 3, background: '#3366cc' } }).png().toBuffer();

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

test('same seed gives byte-identical SVG', async () => {
  for (const recipe of Object.keys(recipes)) {
    const o = { recipe, seed: 'my-post', title: 'Hello world, again', label: 'Notes', icon: 'lucide:feather', image: photo, palette: 'dusk' };
    assert.equal(await renderSvg(o), await renderSvg(o), recipe);
  }
});

test('different seeds give different SVGs', async () => {
  for (const recipe of ['aurora', 'gridTitle', 'iconTile', 'bigType', 'stripes']) {
    const a = await renderSvg({ recipe, seed: 'post-a', title: 'Same title' });
    const b = await renderSvg({ recipe, seed: 'post-b', title: 'Same title' });
    assert.notEqual(a, b, recipe);
  }
});

test('adding a layer leaves the other layers\' random choices alone', async () => {
  const mesh = { type: 'mesh' };
  const a = await renderSvg({ seed: 's', layers: [mesh] });
  const b = await renderSvg({ seed: 's', layers: [mesh, { type: 'grain' }] });
  const blobs = (svg) => svg.match(/<ellipse[^>]*>/g).join('');
  assert.equal(blobs(a), blobs(b));
});

test('raster output is deterministic too', async () => {
  const o = { recipe: 'gridTitle', seed: 'x', title: 'Pixels', width: 300, height: 200 };
  const a = await renderImage(o, { format: 'png' });
  const b = await renderImage(o, { format: 'png' });
  assert.ok(a.equals(b));
});

test('rng: seeded, in range, independent per seed', () => {
  const a = createRng('abc');
  const b = createRng('abc');
  const xs = Array.from({ length: 50 }, () => a.next());
  assert.deepEqual(xs, Array.from({ length: 50 }, () => b.next()));
  assert.ok(xs.every((x) => x >= 0 && x < 1));
  assert.notEqual(createRng('abd').next(), xs[0]);
  const r = createRng(1);
  for (let i = 0; i < 100; i++) {
    const n = r.int(3, 5);
    assert.ok(n >= 3 && n <= 5 && Number.isInteger(n));
  }
  assert.deepEqual(createRng('q').shuffle([1, 2, 3, 4]).sort(), [1, 2, 3, 4]);
  assert.equal(hashString('x'), hashString('x'));
});

// ---------------------------------------------------------------------------
// Layers
// ---------------------------------------------------------------------------

const every = [
  { type: 'solid', color: 'rgb(10 20 30)' },
  { type: 'linear', angle: 45 },
  { type: 'radial', x: 0.3, y: 0.3 },
  { type: 'mesh', count: 3 },
  { type: 'stripes', widths: 'taper', region: { x: 0.5 } },
  { type: 'stripes', direction: 'diagonal', angle: 30, widths: [1, 2, 3], gap: 4 },
  { type: 'image', src: photo, duotone: true, tint: '#ff0000' },
  { type: 'grain', amount: 0.1 },
  { type: 'pattern', kind: 'grid', fade: 'radial' },
  { type: 'pattern', kind: 'dots', fade: 'bottom' },
  { type: 'pattern', kind: 'lines', angle: 45 },
  { type: 'pattern', kind: 'rings', region: { x: 0, width: 0.5 } },
  { type: 'pattern', kind: 'waves' },
  { type: 'shapes', kind: 'mixed', count: 5 },
  { type: 'shapes', placement: 'row', kind: 'pill', outline: true },
  { type: 'icon', name: 'lucide:feather', tile: true },
  { type: 'icon', name: 'simple-icons:github', anchor: 'top-right' },
  { type: 'icon', svg: '<svg viewBox="0 0 10 10" fill="none" stroke="red"><circle cx="5" cy="5" r="4"/><script>alert(1)</script></svg>' },
  { type: 'icon', path: 'M0 0h24v24H0z' },
  { type: 'text', content: 'Every layer', label: 'Test', background: { color: '#ffffff' } },
  { type: 'frame', radius: 12 },
  { type: 'diagram', nodes: [{ icon: 'lucide:send' }, { icon: 'lucide:cpu' }, {}], arrows: 'loop', grid: true },
  { type: 'diagram', layout: 'hub', nodes: [{ icon: 'lucide:globe' }, { icon: 'lucide:database' }, { icon: 'lucide:database' }] },
  { type: 'diagram', layout: 'square', nodes: [{}, {}, {}, {}, { shape: 'square' }] },
  { type: 'diagram', layout: 'triangle', nodes: [{}, {}, {}], arrows: 'both' },
  { type: 'diagram', layout: 'stack', nodes: [{}, {}, {}] },
  { type: 'paper', count: 5 },
  { type: 'paper', items: [{ kind: 'arch', x: 0.3 }, { kind: 'pill', x: 0.7, width: 80, height: 30 }] },
  { type: 'scribble', icon: 'lucide:compass' },
  { type: 'scribble', graph: { nodes: 5 } },
  { type: 'ink', color: 'riso:blue', shapes: [{ kind: 'circle' }, { kind: 'band' }] },
  { type: 'dither', shape: 'sphere' },
  { type: 'contour', levels: 12 },
  { type: 'waveform', style: 'mirrored' },
  { type: 'tiles', cols: 3 },
  { type: 'rule', y: 0.2 },
];

test('every layer type renders', async () => {
  assert.deepEqual(new Set(every.map((l) => l.type)), new Set(Object.keys(layers)));
  for (const layer of every) {
    const svg = await renderSvg({ seed: 'layers', width: 400, height: 300, layers: [layer] });
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="400" height="300"/, layer.type);
    assert.ok(svg.length > 120, `${layer.type} drew something`);
    assert.doesNotMatch(svg, /NaN|undefined|Infinity/, layer.type);
  }
  const all = await renderImage({ seed: 'layers', width: 400, height: 300, layers: every }, { format: 'png' });
  assert.equal((await sharp(all).metadata()).width, 400);
});

test('icon SVGs are cleaned and icons resolve aliases', async () => {
  const svg = await renderSvg({ seed: 'i', layers: [every[17]] });
  assert.doesNotMatch(svg, /script/);
  assert.match(svg, /stroke="red"/);
  registerIcons({ prefix: 'test', icons: { dot: { body: '<circle cx="8" cy="8" r="8"/>' } }, aliases: { blob: { parent: 'dot' } }, width: 16, height: 16 });
  assert.match(await renderSvg({ seed: 'i', layers: [{ type: 'icon', name: 'test:blob' }] }), /<circle cx="8"/);
  await assert.rejects(renderSvg({ seed: 'i', layers: [{ type: 'icon', name: 'test:nope' }] }), /not found/);
  await assert.rejects(renderSvg({ seed: 'i', layers: [{ type: 'icon', name: 'nosuchset:x' }] }), /registerIcons/);
});

test('text is drawn as outlines, never as <text>', async () => {
  const svg = await renderSvg({ recipe: 'bigType', seed: 't', title: 'Outlines only' });
  assert.doesNotMatch(svg, /<text|font-family/);
  assert.match(svg, /<path d="M[\d.]+ [\d.]+[LQC]/);
});

test('the image layer refuses network URLs', async () => {
  await assert.rejects(renderSvg({ layers: [{ type: 'image', src: 'https://example.com/a.jpg' }] }), /never fetch/);
});

test('unknown layer types, recipes and anchors throw', async () => {
  assert.throws(() => cover({ layers: [{ type: 'nope' }] }), /Unknown layer type/);
  assert.throws(() => cover({ recipe: 'nope' }), /Unknown recipe/);
  await assert.rejects(renderSvg({ layers: [{ type: 'text', content: 'x', anchor: 'middle' }] }), /Unknown anchor/);
});

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

async function face() {
  return { face: await loadFont(bundledFonts()[2]), hb: await harfbuzz() };
}

test('text wraps, truncates with an ellipsis at maxLines', async () => {
  const f = await face();
  const text = 'The quick brown fox jumps over the lazy dog and keeps on running far beyond the edge';
  const set = layout({ ...f, text, size: 40, maxWidth: 400, maxLines: 2 });
  assert.equal(set.lines.length, 2);
  assert.ok(set.truncated);
  assert.ok(set.lines[1].text.endsWith('…'));
  assert.ok(set.lines.every((l) => l.run.width <= 400.5));
  assert.doesNotMatch(set.lines[1].text, /[\s,]…$/);
});

test('minSize shrinks before truncating', async () => {
  const f = await face();
  const text = 'A headline that needs a little room';
  const set = layout({ ...f, text, size: 80, minSize: 30, maxWidth: 500, maxLines: 2 });
  assert.ok(!set.truncated);
  assert.ok(set.size < 80 && set.size >= 30);
  assert.ok(set.lines.length <= 2);
});

test('balance evens out line lengths', async () => {
  const f = await face();
  const text = 'Introducing covers: editorial images from a seed';
  const greedy = layout({ ...f, text, size: 40, maxWidth: 700 });
  const balanced = layout({ ...f, text, size: 40, maxWidth: 700, balance: true });
  assert.equal(greedy.lines.length, balanced.lines.length);
  const spread = (s) => Math.max(...s.lines.map((l) => l.run.width)) - Math.min(...s.lines.map((l) => l.run.width));
  assert.ok(spread(balanced) < spread(greedy));
});

test('a word wider than the line breaks between characters', async () => {
  const f = await face();
  const set = layout({ ...f, text: 'Supercalifragilisticexpialidocious', size: 40, maxWidth: 200 });
  assert.ok(set.lines.length > 1);
  assert.equal(set.lines.map((l) => l.text).join(''), 'Supercalifragilisticexpialidocious');
});

test('kerning comes from the font (GPOS)', async () => {
  const { face: fc, hb } = await face();
  const { shape } = await import('../src/text.js');
  const av = shape(fc, 'AV', 100, 0, hb).width;
  const sum = shape(fc, 'A', 100, 0, hb).width + shape(fc, 'V', 100, 0, hb).width;
  assert.ok(av < sum - 1, `AV ${av} should be kerned tighter than ${sum}`);
});

test('fonts: WOFF decodes to sfnt, WOFF2 is refused', () => {
  const sfnt = decodeFont(bundledFonts()[0].data);
  assert.equal(new DataView(sfnt.buffer, sfnt.byteOffset).getUint32(0), 0x00010000);
  assert.throws(() => decodeFont(new Uint8Array([0x77, 0x4f, 0x46, 0x32, 0, 0, 0, 0, 0, 0, 0, 0])), /WOFF2/);
});

// ---------------------------------------------------------------------------
// Palettes and size
// ---------------------------------------------------------------------------

test('palette inputs resolve', () => {
  assert.equal(resolvePalette('dusk').mode, 'dark');
  assert.equal(resolvePalette('paper').mode, 'light');
  const arr = resolvePalette(['#0b0b0f', '#ff6a3d', '#3d5afe']);
  assert.equal(arr.bg, '#0b0b0f');
  assert.deepEqual([...arr.colors], ['#ff6a3d', '#3d5afe']);
  assert.ok(contrastRatio(arr.text, arr.bg) >= 7);
  assert.equal(resolvePalette({ bg: '#fff', colors: ['#f00'] }).accent, '#ff0000');
  assert.throws(() => resolvePalette('not-a-palette'), /Unknown palette/);
  for (const name of Object.keys(palettes)) {
    const p = resolvePalette(name);
    assert.ok(contrastRatio(p.text, p.bg) >= 7, `${name} text contrast`);
  }
});

test('derivePalette builds a palette from theme tokens', () => {
  const light = derivePalette({ accent: 'rgb(37, 99, 235)', bg: '#fdfdfd', text: '#1d1d1f' });
  assert.equal(light.mode, 'light');
  assert.equal(light.text, '#1d1d1f');
  assert.equal(light.colors.length, 4);
  assert.ok(light.colors.every((c) => /^#[0-9a-f]{6}$/.test(c)));
  const dark = derivePalette({ accent: '#d1fe17', mode: 'dark' });
  assert.equal(dark.mode, 'dark');
  assert.ok(contrastRatio(dark.text, dark.bg) >= 7);
  assert.equal(resolvePalette('#2563eb').accent, '#2563eb');
  assert.equal(resolvePalette({ accent: '#2563eb' }).mode, 'light');
});

test('colour parsing', () => {
  assert.equal(toHex('#FA0'), '#ffaa00');
  assert.equal(toHex('#11223344'), '#112233');
  assert.equal(toHex('rgb(37 99 235)'), '#2563eb');
  assert.equal(toHex('rgba(37, 99, 235, 0.5)'), '#2563eb');
  assert.equal(toHex('hsl(0 100% 50%)'), '#ff0000');
  assert.throws(() => toHex('blue'), /Unrecognised/);
});

test('sizes and aspects', () => {
  assert.deepEqual(resolveSize({}), { width: 1200, height: 1200 });
  assert.deepEqual(resolveSize({ aspect: 'og' }), { width: 1200, height: 630 });
  assert.deepEqual(resolveSize({ aspect: '16:9' }), { width: 1200, height: 675 });
  assert.deepEqual(resolveSize({ width: 800, aspect: '4:5' }), { width: 800, height: 1000 });
  assert.deepEqual(resolveSize({ height: 800, aspect: '3:2' }), { width: 1200, height: 800 });
  assert.deepEqual(resolveSize({ width: 300, height: 200 }), { width: 300, height: 200 });
  assert.throws(() => resolveSize({ aspect: 'wide' }), /Invalid aspect/);
});

// ---------------------------------------------------------------------------
// Recipes and overrides
// ---------------------------------------------------------------------------

test('recipes expose layer ids; overrides merge, replace content or remove', () => {
  const base = cover({ recipe: 'gridTitle', seed: 'r', title: 'Hi' });
  assert.deepEqual(base.layers.map((l) => l.id), ['bg', 'mesh', 'grid', 'grain', 'title']);
  const custom = cover({ recipe: 'gridTitle', seed: 'r', title: { content: 'Hi', size: 99 }, mesh: { blur: 40 }, grain: false, layers: [{ type: 'frame' }] });
  assert.deepEqual(custom.layers.map((l) => l.id ?? l.type), ['bg', 'mesh', 'grid', 'title', 'frame']);
  assert.equal(custom.layers[1].blur, 40);
  assert.equal(custom.layers[3].size, 99);
  assert.equal(custom.layers[3].type, 'text');
});

test('every recipe renders at every aspect', async () => {
  for (const recipe of Object.keys(recipes)) {
    for (const aspect of ['1:1', '16:9', '4:5', 'og']) {
      const svg = await renderSvg({ recipe, aspect, seed: 'a', title: 'A title', image: photo, width: 400 });
      assert.match(svg, /<svg/, `${recipe} ${aspect}`);
    }
  }
  assert.throws(() => cover({ recipe: 'duotone' }), /needs the "image" option/);
});

test('a custom recipe function works', async () => {
  const svg = await renderSvg({ recipe: (o, c) => [{ type: 'solid', color: c.palette.accent }], palette: { bg: '#000', colors: ['#123456'] } });
  assert.match(svg, /fill="#123456"/);
});

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

test('renderImage: formats, sizes and MIME signatures', async () => {
  const o = { recipe: 'aurora', seed: 'f', aspect: '16:9', width: 640 };
  for (const [format, check] of [
    ['webp', (b) => b.subarray(8, 12).toString() === 'WEBP'],
    ['png', (b) => b[0] === 0x89],
    ['jpeg', (b) => b[0] === 0xff && b[1] === 0xd8],
    ['avif', (b) => b.subarray(4, 12).toString().startsWith('ftypavi')],
  ]) {
    const buf = await renderImage(o, { format });
    assert.ok(check(buf), format);
    const meta = await sharp(buf).metadata();
    assert.equal(meta.width, 640, format);
    assert.equal(meta.height, 360, format);
  }
  await assert.rejects(renderImage(o, { format: 'gif' }), /Unknown format/);
});

test('raster grain matches its amount (and the SVG grain roughly)', async () => {
  const layersFor = (amount) => [{ type: 'solid', color: '#808080' }, { type: 'grain', amount }];
  const stdev = async (buf) => (await sharp(buf).stats()).channels[0].stdev;
  const raster = await stdev(await renderImage({ seed: 'g', width: 200, height: 200, layers: layersFor(0.08) }, { format: 'png' }));
  const vector = await stdev(Buffer.from(await renderSvg({ seed: 'g', width: 200, height: 200, layers: layersFor(0.08) })));
  assert.ok(raster > 2.5 && raster < 7, `raster grain σ ${raster}`);
  assert.ok(vector > 2 && vector < 7, `svg grain σ ${vector}`);
  assert.equal(await stdev(await renderImage({ seed: 'g', width: 200, height: 200, layers: layersFor(0) }, { format: 'png' })), 0);
});

test('radius clips the corners transparent', async () => {
  const buf = await renderImage({ seed: 'r', width: 200, height: 200, radius: 40, layers: [{ type: 'solid', color: '#ff0000' }] }, { format: 'png' });
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  assert.equal(data[3], 0, 'corner is transparent');
  assert.equal(data[(100 * info.width + 100) * 4 + 3], 255, 'centre is opaque');
});

test('cache: same cover → same key and a cached read', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'covers-'));
  try {
    const o = { recipe: 'bigType', seed: 'c', title: 'Cached', width: 300 };
    const k1 = await coverKey(o, { format: 'webp' });
    assert.equal(k1, await coverKey({ ...o }, { format: 'webp' }));
    assert.notEqual(k1, await coverKey({ ...o, seed: 'd' }, { format: 'webp' }));
    assert.notEqual(k1, await coverKey(o, { format: 'png' }));
    const a = await renderImage(o, { cache: dir });
    assert.deepEqual(await readdir(dir), [`${k1}.webp`]);
    const b = await renderImage(o, { cache: dir });
    assert.ok(a.equals(b));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('performance: a 1200×1200 WebP renders in under 300ms', async () => {
  const o = { recipe: 'gridTitle', seed: 'perf', title: 'How fast is a cover?', label: 'Benchmark', palette: 'dusk' };
  await renderImage(o); // warm up (WASM, fonts, sharp)
  const times = [];
  for (let i = 0; i < 5; i++) {
    const t = performance.now();
    await renderImage({ ...o, seed: `perf-${i}` });
    times.push(performance.now() - t);
  }
  times.sort((a, b) => a - b);
  const median = times[2];
  console.log(`  1200×1200 gridTitle WebP: median ${median.toFixed(0)}ms (min ${times[0].toFixed(0)}, max ${times[4].toFixed(0)})`);
  assert.ok(median < 300, `median ${median.toFixed(0)}ms`);
});

test('custom fonts: picked by family and weight; ArrayBuffer data hashes', async () => {
  const src = bundledFonts()[3].data; // Inter 700, registered under another name
  const ab = src.buffer.slice(src.byteOffset, src.byteOffset + src.byteLength);
  const o = { seed: 'f', width: 400, height: 200, fonts: [{ name: 'Display', data: ab, weight: 700 }], layers: [{ type: 'text', content: 'Display', font: 'Display', weight: 700 }] };
  const custom = await renderSvg(o);
  const inter700 = await renderSvg({ ...o, fonts: [], layers: [{ type: 'text', content: 'Display', weight: 700 }] });
  assert.equal(custom, inter700);
  assert.match(await coverKey(o), /^[0-9a-f]{40}$/);
});

test('mesh recipes: the title reads (4.5:1) on every preset, and colour reaches the edges', async () => {
  const hex = (d, i) => '#' + [d[i], d[i + 1], d[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('');
  for (const recipe of ['gridTitle', 'aurora']) {
    for (const palette of Object.keys(palettes)) {
      for (const seed of ['a', 'b', 'c']) {
        const o = { recipe, palette, seed, width: 240, aspect: '16:9', grid: false, grain: false, title: { content: 'x', opacity: 0 } };
        const { data, info } = await sharp(Buffer.from(await renderSvg(o))).removeAlpha().raw().toBuffer({ resolveWithObject: true });
        const text = resolvePalette(palette).text;
        let worst = 21;
        // The title's box: the lower-left two thirds, bottom third.
        for (let y = Math.floor(info.height * 0.62); y < info.height; y += 3) {
          for (let x = 0; x < Math.floor(info.width * 0.7); x += 3) worst = Math.min(worst, contrastRatio(text, hex(data, (y * info.width + x) * 3)));
        }
        assert.ok(worst >= 4.5, `${recipe} ${palette} ${seed}: title contrast ${worst.toFixed(2)}`);
        // No vignette: the corners are as bright as the middle, give or take.
        const lum = (x, y) => relativeLuminance(hex(data, (y * info.width + x) * 3));
        const mid = lum(info.width >> 1, info.height >> 1);
        const corners = [lum(0, 0), lum(info.width - 1, 0), lum(0, info.height - 1), lum(info.width - 1, info.height - 1)];
        const bg = relativeLuminance(resolvePalette(palette).bg);
        for (const c of corners) assert.ok(Math.abs(c - bg) > 0.02 || Math.abs(mid - bg) < 0.02, `${recipe} ${palette} ${seed}: a corner shows the page colour`);
      }
    }
  }
});
