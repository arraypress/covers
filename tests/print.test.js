import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { cover, renderSvg, renderImage, palettes, resolvePalette, extractPalette, RISO_INKS } from '../src/index.js';
import { formatDuration } from '../src/print.js';
import { encodePng } from '../src/png.js';
import { contrastRatio } from '@arraypress/color-utils';

const hexAt = (d, i) => '#' + [d[i], d[i + 1], d[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('');
const photo = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#2f6fe8' } })
  .composite([{ input: await sharp({ create: { width: 32, height: 64, channels: 3, background: '#f2a93b' } }).png().toBuffer(), left: 32, top: 0 }])
  .png().toBuffer();

test('png: a valid image sharp can read', async () => {
  const png = encodePng(new Uint8Array([0, 255, 255, 0]), 2, 2, 1);
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual([info.width, info.height], [2, 2]);
  assert.deepEqual([...data].filter((_, i) => i % info.channels === 0), [0, 255, 255, 0]);
});

test('ink: multiply, misregistration, textures, riso inks', async () => {
  const svg = await renderSvg({ seed: 'i', width: 400, layers: [{ type: 'ink', color: 'riso:pink', shapes: [{ kind: 'circle' }, { kind: 'band', rotate: 10 }, { kind: 'arch', x: 0.3 }, { kind: 'half' }, { kind: 'ring' }, { kind: 'rect' }] }] });
  assert.match(svg, /mix-blend-mode:multiply/);
  assert.match(svg, /translate\(-?[\d.]+ -?[\d.]+\)/, 'misregistered');
  assert.match(svg, new RegExp(`fill="${RISO_INKS.pink}"`));
  assert.match(svg, /<pattern[^>]*><image/, 'a speckle texture');
  const half = await renderSvg({ seed: 'i', width: 400, layers: [{ type: 'ink', texture: 'halftone', density: [1, 1], offset: { x: 0, y: 0 } }] });
  const tile = +half.match(/<pattern[^>]*width="([\d.]+)"/)[1];
  assert.equal(tile % 12, 0, 'a halftone tile of whole cells');
  assert.doesNotMatch(half, /linearGradient/, 'even density when asked');
  const text = await renderSvg({ seed: 'i', width: 400, layers: [{ type: 'ink', shapes: [{ kind: 'text', content: 'ZINE', size: 90 }] }] });
  assert.match(text, /<path d="M/);
  await assert.rejects(renderSvg({ layers: [{ type: 'ink', color: 'riso:gold' }] }), /Unknown riso ink/);
});

test('dither: crisp 1-bit cells in the given colours', async () => {
  for (const matrix of ['bayer4', 'bayer8', 'noise']) {
    const c = { seed: 'd', width: 300, height: 200, layers: [{ type: 'dither', colors: ['#ffffff', '#112233'], cell: 5, matrix, shape: 'sphere' }] };
    const svg = await renderSvg(c);
    assert.match(svg, /image-rendering:pixelated/);
    const png = Buffer.from(svg.match(/base64,([^"]+)/)[1], 'base64');
    const meta = await sharp(png).metadata();
    assert.deepEqual([meta.width, meta.height], [60, 40], 'one pixel per cell');
    const { data } = await sharp(await renderImage(c, { format: 'png' })).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const seen = new Set();
    for (let i = 0; i < data.length; i += 3) seen.add(hexAt(data, i));
    assert.deepEqual([...seen].sort(), ['#112233', '#ffffff'], `${matrix}: only the two colours (no blur between cells)`);
  }
  const three = await renderSvg({ seed: 'd', width: 100, layers: [{ type: 'dither', colors: ['#ffffff', '#888888', '#000000'] }] });
  assert.match(three, /<image/);
});

test('contour: levels, an accent line, index contours', async () => {
  const p = resolvePalette('paper');
  const svg = await renderSvg({ seed: 'c', width: 400, palette: 'paper', layers: [{ type: 'contour', levels: 15, index: 5 }] });
  const paths = [...svg.matchAll(/<path d="([^"]+)"[^>]*stroke="(#[0-9a-f]+)"[^>]*stroke-width="([\d.]+)"/g)];
  assert.equal(paths.length, 3, 'normal, index and accent');
  assert.ok(paths.some((m) => m[2] === p.accent));
  const widths = paths.map((m) => +m[3]);
  assert.ok(Math.max(...widths) > Math.min(...widths) * 2);
  assert.equal(svg, await renderSvg({ seed: 'c', width: 400, palette: 'paper', layers: [{ type: 'contour', levels: 15, index: 5 }] }));
});

test('waveform: peaks, styles, demo fallback, and real audio decoded at build', async () => {
  const peaks = Array.from({ length: 40 }, (_, i) => Math.abs(Math.sin(i / 3)));
  const bars = await renderSvg({ seed: 'w', width: 400, layers: [{ type: 'waveform', peaks, bars: 40, style: 'bars' }] });
  assert.equal((bars.match(/<rect /g) ?? []).length, 40);
  for (const style of ['mirrored', 'line', 'dots']) assert.doesNotMatch(await renderSvg({ seed: 'w', width: 400, layers: [{ type: 'waveform', style }] }), /NaN/);
  assert.equal(formatDuration(2537), '42:17');
  assert.equal(formatDuration(4000), '1:06:40');

  // A two-second WAV: a tone that swells and fades.
  const rate = 8000;
  const n = rate * 2;
  const wav = Buffer.alloc(44 + n * 2);
  wav.write('RIFF', 0); wav.writeUInt32LE(36 + n * 2, 4); wav.write('WAVE', 8); wav.write('fmt ', 12);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(rate, 24);
  wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) wav.writeInt16LE(Math.round(Math.sin((i / rate) * 2 * Math.PI * 220) * Math.sin((i / n) * Math.PI) * 30000), 44 + i * 2);
  const dir = await mkdtemp(join(tmpdir(), 'covers-wav-'));
  try {
    await writeFile(join(dir, 'tone.wav'), wav);
    const svg = await renderSvg({ seed: 'w', width: 400, layers: [{ type: 'waveform', audio: join(dir, 'tone.wav'), bars: 20, style: 'bars', caption: true }] });
    const heights = [...svg.matchAll(/<rect [^>]*height="([\d.]+)"/g)].map((m) => +m[1]);
    assert.equal(heights.length, 20);
    assert.ok(heights[10] > heights[0] * 2, 'louder in the middle, as the audio is');
    assert.match(svg, /<path d="M/, 'the duration caption (0:02) is drawn');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('tiles: a series shares its rhythm, each cover its own cells', async () => {
  const grid = (seed, series) => cover({ seed, recipe: 'bauhaus', series }).layers.find((l) => l.type === 'tiles');
  assert.equal(grid('a', 's').series, 's');
  const svgA = await renderSvg({ seed: 'a', width: 400, layers: [{ type: 'tiles', series: 'one' }] });
  const svgB = await renderSvg({ seed: 'b', width: 400, layers: [{ type: 'tiles', series: 'one' }] });
  const cells = (svg) => [...svg.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)" fill/g)].map((m) => m.slice(1).join(','));
  assert.deepEqual(cells(svgA), cells(svgB), 'same series: same grid');
  assert.notEqual(svgA, svgB, 'different seeds: different cells');
});

test('photo: a palette from the image, then a field from it', async () => {
  const colors = await extractPalette(photo, { count: 2 });
  assert.equal(colors.length, 2);
  const near = (hex, target) => contrastRatio(hex, target) < 1.3;
  assert.ok(colors.some((c) => near(c, '#2f6fe8')) && colors.some((c) => near(c, '#f2a93b')), `got ${colors}`);
  const svg = await renderSvg({ recipe: 'photo', seed: 'p', image: photo, width: 300 });
  assert.doesNotMatch(svg, /<image/, 'the photo itself is not shown');
  assert.match(await renderSvg({ recipe: 'photo', seed: 'p', image: photo, width: 300, show: 'blur' }), /<image/);
  assert.throws(() => cover({ recipe: 'photo' }), /needs the "image" option/);
});

test('issue: numeral in the accent at 3:1, masthead and date, a hairline', async () => {
  for (const palette of Object.keys(palettes)) {
    const c = cover({ recipe: 'issue', seed: 'i', palette, number: 14, masthead: 'Wren Street', date: 'October 2026' });
    const n = c.layers.find((l) => l.id === 'number');
    assert.equal(n.content, 14);
    assert.ok(contrastRatio(n.color, resolvePalette(palette).bg) >= 3, palette);
    assert.deepEqual(c.layers.map((l) => l.id).slice(0, 5), ['bg', 'masthead', 'date', 'rule', 'no']);
  }
  assert.ok(!cover({ recipe: 'issue', seed: 'i', prefix: false }).layers.some((l) => l.id === 'no'));
  assert.ok(Number.isInteger(cover({ recipe: 'issue', seed: 'x' }).layers.find((l) => l.id === 'number').content));
});

test('new recipes: titles clear 4.5:1 where they sit, on every preset', async () => {
  // [recipe, sample box (fractions) where the title sits, extra options]
  const cases = [
    ['riso', [0, 0.72, 0.7, 1]],
    ['waveform', [0, 0, 0.7, 0.22]],
    ['bauhaus', [0, 0.74, 0.7, 1]],
    ['issue', [0.55, 0.14, 0.95, 0.3]],
  ];
  for (const [recipe, [x0, y0, x1, y1]] of cases) {
    for (const palette of Object.keys(palettes)) {
      for (const seed of ['a', 'b']) {
        const o = { recipe, palette, seed, width: 240, aspect: '16:9', grain: false, title: { content: 'x', opacity: 0 }, label: undefined };
        const c = cover(o);
        const color = c.layers.find((l) => l.id === 'title').color ?? resolvePalette(palette).text;
        const { data, info } = await sharp(Buffer.from(await renderSvg(c))).removeAlpha().raw().toBuffer({ resolveWithObject: true });
        let worst = 21;
        for (let y = Math.floor(info.height * y0); y < Math.floor(info.height * y1); y += 2) {
          for (let x = Math.floor(info.width * x0); x < Math.floor(info.width * x1); x += 2) worst = Math.min(worst, contrastRatio(color, hexAt(data, (y * info.width + x) * 3)));
        }
        assert.ok(worst >= 4.5, `${recipe} ${palette} ${seed}: ${worst.toFixed(2)}`);
      }
    }
  }
  // Panels: dither and contour set the title on a solid block.
  for (const recipe of ['dither', 'contour']) {
    for (const palette of Object.keys(palettes)) {
      const t = cover({ recipe, palette, seed: 'a', title: 'x' }).layers.find((l) => l.id === 'title');
      assert.ok(contrastRatio(t.color ?? resolvePalette(palette).text, t.background.color) >= 4.5, `${recipe} ${palette}`);
    }
  }
});

test('marks clear 3:1: waveform bars on their field', () => {
  for (const palette of Object.keys(palettes)) {
    for (const field of ['flat', 'toned']) {
      const c = cover({ recipe: 'waveform', palette, seed: 'a', field });
      assert.ok(contrastRatio(c.layers.find((l) => l.id === 'wave').color, c.layers[0].color) >= 3, `${palette} ${field}`);
    }
  }
});

test('issue: the numeral stays mostly on the canvas, and never covers "No.", on every aspect', async () => {
  const W = 300;
  for (const aspect of ['16:9', 'og', '1:1', '4:5', '9:16']) {
    for (const [number, title] of [[1], [3], [7], [14], [128], [4077], [7, 'The quiet issue, in two lines of type']]) {
      const c = cover({ recipe: 'issue', seed: 's', palette: 'moss', aspect, width: W, number, title });
      const acc = c.layers.find((l) => l.id === 'number').color;
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(acc.slice(i, i + 2), 16));
      const only = (ids) => ({ ...c, layers: c.layers.filter((l) => ids.includes(l.id)) });
      // Count the numeral's pixels on the canvas, and on a canvas grown 50% each way.
      const count = async (svg, pad) => {
        const big = pad ? svg.replace(/<svg ([^>]*)width="(\d+)" height="(\d+)" viewBox="0 0 (\d+) (\d+)"/, (_, a, w, h) => `<svg ${a}width="${w * 2}" height="${h * 2}" viewBox="${-w / 2} ${-h / 2} ${w * 2} ${h * 2}"`) : svg;
        const { data } = await sharp(Buffer.from(big)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
        let n = 0;
        for (let i = 0; i < data.length; i += 3) if (Math.abs(data[i] - r) + Math.abs(data[i + 1] - g) + Math.abs(data[i + 2] - b) < 30) n++;
        return n;
      };
      const svg = await renderSvg(only(['bg', 'number']));
      const visible = (await count(svg, false)) / (await count(svg, true));
      assert.ok(visible >= 0.7, `${aspect} ${number}: ${(visible * 100).toFixed(0)}% of the numeral visible`);
      // "No." never shares pixels with the numeral (or the title).
      const no = await sharp(Buffer.from(await renderSvg(only(['no'])))).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const ttl = title ? await sharp(Buffer.from(await renderSvg(only(['title'])))).ensureAlpha().raw().toBuffer({ resolveWithObject: true }) : null;
      if (ttl) {
        let clash = 0;
        for (let i = 3; i < no.data.length; i += 4) if (no.data[i] > 40 && ttl.data[i] > 40) clash++;
        assert.equal(clash, 0, `${aspect}: the title covers "No."`);
      }
      const num = await sharp(Buffer.from(svg.replace(/<rect width="\d+" height="\d+" fill="[^"]+"\/>/, ''))).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      let overlap = 0;
      for (let i = 3; i < no.data.length; i += 4) if (no.data[i] > 40 && num.data[i] > 40) overlap++;
      assert.equal(overlap, 0, `${aspect} ${number}: the numeral covers "No."`);
    }
  }
});

test('dither prefers lossless: the default WebP is pixel-exact and tiny', async () => {
  const o = { recipe: 'dither', palette: 'paper', seed: 'a', width: 300 };
  const webp = await renderImage(o);
  const png = await renderImage(o, { format: 'png' });
  const a = await sharp(webp).removeAlpha().raw().toBuffer();
  const b = await sharp(png).removeAlpha().raw().toBuffer();
  assert.ok(a.equals(b), 'exact');
  const lossy = await renderImage(o, { lossless: false });
  assert.ok(webp.length < lossy.length);
  const { defineRecipe } = await import('../src/index.js');
  assert.throws(() => defineRecipe({ output: { quality: 9 }, layers: [{ type: 'solid' }] }), /output: is \{ "lossless"/);
});

test('mesh hueSpan keeps to neighbouring hues', async () => {
  const { toOklch } = await import('../src/index.js');
  for (const palette of Object.keys(palettes)) {
    for (const seed of ['a', 'b', 'c']) {
      const svg = await renderSvg({ seed, palette, width: 200, layers: [{ type: 'mesh', hueSpan: 60, hues: 3, base: null }] });
      const fills = [...new Set([...svg.matchAll(/<ellipse[^>]*fill="(#[0-9a-f]{6})"/g)].map((m) => m[1]))];
      const hues = fills.map((f) => toOklch(f)).filter((o) => o.c >= 0.02).map((o) => o.h);
      for (const h of hues) for (const k of hues) {
        const d = Math.abs((((h - k) % 360) + 540) % 360 - 180);
        assert.ok(d <= 60.5, `${palette} ${seed}: hues ${h.toFixed(0)} and ${k.toFixed(0)} are ${d.toFixed(0)}° apart`);
      }
    }
  }
});

test('the aspect condition', () => {
  const doc = { layers: [{ id: 'w', type: 'solid', when: { aspect: 'wide' } }, { id: 's', type: 'solid', when: { aspect: 'square' } }, { id: 't', type: 'solid', when: { aspect: 'tall' } }] };
  const ids = (aspect) => cover({ recipe: doc, aspect }).layers.map((l) => l.id).join('');
  assert.equal(ids('16:9'), 'w');
  assert.equal(ids('1:1'), 's');
  assert.equal(ids('9:16'), 't');
});
