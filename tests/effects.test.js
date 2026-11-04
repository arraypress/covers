// The image filters: numeric properties of the pixel effects, the filters
// through librsvg, masks, seeds, validation and the Worker fallback.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { renderSvg, renderImage, defineRecipe, EFFECTS } from '../src/index.js';
import { EFFECT_OPTIONS, applyEffects, isPixel, needsPixels } from '../src/effects/index.js';
import { spin, zoom } from '../src/effects/polar.js';
import { aperture, lens, tilt } from '../src/effects/lens.js';
import { kaleidoscope, twirl, bulge } from '../src/effects/distort.js';
import { sort, stretch } from '../src/effects/sort.js';
import { curveTable } from '../src/effects/grade.js';
import { maskField } from '../src/effects/mask.js';
import { createRng } from '../src/rng.js';

const root = new URL('..', import.meta.url);
const photo = await readFile(new URL('examples/photo.jpg', root));
const ctx = { width: 101, height: 101, canvas: { width: 101, height: 101 }, rng: createRng('t') };

/** Seeded noise pixels, opaque. @param {number} w @param {number} h @returns {import('../src/effects/buffer.js').Pixels} */
function noise(w, h, seed = 'n') {
  const rng = createRng(seed);
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) { data[i] = rng.int(0, 255); data[i + 1] = rng.int(0, 255); data[i + 2] = rng.int(0, 255); data[i + 3] = 255; }
  return { data, width: w, height: h, scale: 1, opaque: true };
}
/** @param {Uint8ClampedArray} d @param {number} w @param {number} x @param {number} y @returns {number[]} */
const at = (d, w, x, y) => Array.from(d.subarray((y * w + x) * 4, (y * w + x) * 4 + 4));
/** Spread of a channel over a set of pixels. @param {number[]} v @returns {number} */
const spread = (v) => { const m = v.reduce((a, b) => a + b, 0) / v.length; return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length); };
/** Raw RGBA of a render. @param {any} input @returns {Promise<{ data: Buffer, width: number, height: number }>} */
async function raw(input) {
  const png = await renderImage(input, { format: 'png', cache: false });
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

test('spin and zoom keep the centre pixel; spin blurs along circles, zoom along rays', () => {
  const img = noise(101, 101);
  const c = at(img.data, 101, 50, 50);
  const s = spin(img, { kind: 'spin', angle: 30 });
  const z = zoom(img, { kind: 'zoom', amount: 0.4 });
  for (const out of [s, z]) at(out, 101, 50, 50).forEach((v, k) => assert.ok(Math.abs(v - c[k]) <= 1, `centre ${v} vs ${c[k]}`));
  // Far from the centre: noise is smoothed (its spread falls), around the circle and along the ray.
  const ring = (/** @type {Uint8ClampedArray} */ d) => Array.from({ length: 64 }, (_, i) => at(d, 101, Math.round(50 + 40 * Math.cos(i / 10)), Math.round(50 + 40 * Math.sin(i / 10)))[0]);
  assert.ok(spread(ring(s)) < spread(ring(img.data)) / 3, 'spin smooths along the circle');
  const ray = (/** @type {Uint8ClampedArray} */ d) => Array.from({ length: 20 }, (_, i) => at(d, 101, 50 + 25 + i, 50)[0]);
  assert.ok(spread(ray(z)) < spread(ray(img.data)) / 3, 'zoom smooths along the ray');
});

test('lens: the aperture has the right area, and a point light becomes a disc of the radius', () => {
  for (const [R, blades, area] of [[12, 0, Math.PI * 144], [12, 6, (3 * Math.sqrt(3) / 2) * 144], [9, 5, (5 / 2) * 81 * Math.sin((2 * Math.PI) / 5)]]) {
    const a = aperture(R, blades, 0).reduce((s, r) => s + (r.r - r.l) * r.wgt, 0);
    assert.ok(Math.abs(a - area) / area < 0.04, `${blades} blades: ${a.toFixed(1)} vs ${area.toFixed(1)}`);
  }
  const w = 121;
  const data = new Uint8ClampedArray(w * w * 4);
  for (let i = 3; i < data.length; i += 4) data[i] = 255;
  data.set([255, 255, 255, 255], (60 * w + 60) * 4);
  const out = lens({ data, width: w, height: w, scale: 1, opaque: true }, { kind: 'lens', radius: 10 }, { canvas: { width: w, height: w } });
  // Lit out to the radius along both axes, and dark past it: a disc, not a Gaussian.
  const lit = (/** @type {number} */ x, /** @type {number} */ y) => at(out, w, x, y)[0];
  assert.ok(lit(60 + 8, 60) > 10 && lit(60, 60 - 8) > 10, 'lit inside the disc');
  assert.ok(lit(60 + 13, 60) < 3 && lit(60, 60 + 13) < 3, 'dark outside it');
  assert.ok(Math.abs(lit(60 + 5, 60) - lit(60 + 1, 60)) < 4, 'flat across the disc (bokeh, not a Gaussian)');
});

test('tilt: the band stays sharp, the blur grows away from it', () => {
  const img = noise(120, 120, 't');
  const out = tilt(img, { kind: 'tilt', width: 10, falloff: 30, radius: 6 }, { canvas: { width: 120, height: 120 } });
  for (let x = 0; x < 120; x += 7) assert.deepEqual(at(out, 120, x, 60), at(img.data, 120, x, 60));
  const row = (/** @type {Uint8ClampedArray} */ d, /** @type {number} */ y) => Array.from({ length: 120 }, (_, x) => at(d, 120, x, y)[1]);
  assert.ok(spread(row(out, 5)) < spread(row(img.data, 5)) / 3, 'far rows blurred');
});

test('distortions: twirl, bulge and the kaleidoscope keep their centre; the kaleidoscope is symmetric', () => {
  const img = noise(101, 101, 'k');
  for (const out of [twirl(img, { kind: 'twirl', angle: 90 }, ctx), bulge(img, { kind: 'bulge', amount: 0.5 }, ctx)]) assert.deepEqual(at(out, 101, 50, 50), at(img.data, 101, 50, 50));
  const k = kaleidoscope(img, { kind: 'kaleidoscope', segments: 6 });
  // Reflected across the wedge's first edge (straight up): left and right of the axis match.
  for (const [dx, dy] of [[5, -20], [12, -30], [3, -8]]) assert.deepEqual(at(k, 101, 50 + dx, 50 + dy), at(k, 101, 50 - dx, 50 + dy));
});

test('pixel sort keeps every pixel of a row and orders the runs; stretch smears one row', () => {
  const img = noise(64, 16, 's');
  const out = sort(img, { kind: 'sort', threshold: [0, 1] }, ctx);
  const u = new Uint32Array(img.data.buffer);
  const v = new Uint32Array(out.buffer);
  for (let y = 0; y < 16; y++) {
    assert.deepEqual([...v.subarray(y * 64, y * 64 + 64)].sort(), [...u.subarray(y * 64, y * 64 + 64)].sort(), `row ${y} keeps its pixels`);
    const l = Array.from({ length: 64 }, (_, x) => { const p = at(out, 64, x, y); return 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]; });
    for (let x = 1; x < 64; x++) assert.ok((l[x] | 0) >= (l[x - 1] | 0), 'sorted light-ward');
  }
  const st = stretch(img, { kind: 'stretch', at: 0.25, direction: 'down' });
  for (let y = 4; y < 16; y++) assert.deepEqual(at(st, 64, 9, y), at(img.data, 64, 9, 4));
});

test('threshold draws exactly two colours; posterize only its levels', async () => {
  const two = await raw({ width: 240, height: 150, layers: [{ type: 'image', src: photo, effects: [{ kind: 'threshold', level: 0.4, ink: '#101010', paper: '#f4efe6' }] }] });
  const colours = new Set();
  for (let i = 0; i < two.data.length; i += 4) colours.add(two.data.readUInt32BE(i));
  assert.equal(colours.size, 2);
  const post = await raw({ width: 240, height: 150, layers: [{ type: 'image', src: photo, effects: [{ kind: 'posterize', levels: 3 }] }] });
  for (let i = 0; i < post.data.length; i += 4) for (let c = 0; c < 3; c++) assert.ok([0, 128, 255].some((v) => Math.abs(post.data[i + c] - v) <= 1), `${post.data[i + c]}`);
});

test('colour filters: invert twice is the identity; curves through the diagonal change nothing; a gradient map maps black and white to its ends', async () => {
  const base = await raw({ width: 120, height: 80, layers: [{ type: 'image', src: photo }] });
  const twice = await raw({ width: 120, height: 80, layers: [{ type: 'image', src: photo, effects: ['invert', 'invert'] }] });
  const flat = await raw({ width: 120, height: 80, layers: [{ type: 'image', src: photo, effects: [{ kind: 'curves', points: [[0, 0], [0.5, 0.5], [1, 1]] }] }] });
  for (let i = 0; i < base.data.length; i++) {
    assert.ok(Math.abs(base.data[i] - twice.data[i]) <= 2);
    assert.ok(Math.abs(base.data[i] - flat.data[i]) <= 2);
  }
  assert.deepEqual(curveTable([[0, 0], [1, 1]], 5), [0, 0.25, 0.5, 0.75, 1]);
  const map = { kind: 'gradientMap', colors: ['#2040a0', '#f0c030'] };
  const black = await raw({ width: 20, height: 20, layers: [{ type: 'solid', color: '#000', effects: [map] }] });
  const white = await raw({ width: 20, height: 20, layers: [{ type: 'solid', color: '#fff', effects: [map] }] });
  assert.deepEqual([...black.data.subarray(0, 3)], [0x20, 0x40, 0xa0]);
  assert.deepEqual([...white.data.subarray(0, 3)], [0xf0, 0xc0, 0x30]);
});

test('motion at a turned angle blurs along it, not round (renderImage)', async () => {
  for (const angle of [-38, 0, 60]) {
    const img = await raw({ width: 200, height: 200, layers: [{ type: 'solid', color: '#000' }, { type: 'shape', kind: 'circle', cx: 100, cy: 100, r: 4, fill: '#fff', effects: [{ kind: 'motion', angle, length: 18 }] }] });
    // Second moments of the light: the principal axis, and how long it is against how wide.
    let m = 0; let mx = 0; let my = 0;
    for (let y = 0; y < 200; y++) for (let x = 0; x < 200; x++) { const v = img.data[(y * 200 + x) * 4]; m += v; mx += v * x; my += v * y; }
    mx /= m; my /= m;
    let xx = 0; let yy = 0; let xy = 0;
    for (let y = 0; y < 200; y++) for (let x = 0; x < 200; x++) { const v = img.data[(y * 200 + x) * 4]; xx += v * (x - mx) ** 2; yy += v * (y - my) ** 2; xy += v * (x - mx) * (y - my); }
    const theta = (0.5 * Math.atan2(2 * xy, xx - yy) * 180) / Math.PI;
    const d = Math.sqrt(((xx - yy) / 2) ** 2 + xy * xy);
    const ratio = Math.sqrt(((xx + yy) / 2 + d) / ((xx + yy) / 2 - d));
    assert.ok(Math.abs(((theta - angle + 90) % 180 + 180) % 180 - 90) < 4, `axis ${theta.toFixed(1)}° for ${angle}°`);
    assert.ok(ratio > 3, `directional: ${ratio.toFixed(1)}× longer than wide at ${angle}°`);
  }
});

test('masks: a gradient keeps the layer exact where it is 0 and fully affected where it is 1, for filters and pixel effects', async () => {
  for (const fx of [{ kind: 'blur', radius: 6 }, { kind: 'spin', angle: 25 }, { kind: 'invert' }]) {
    const opts = (/** @type {any} */ e) => ({ width: 160, height: 100, layers: [{ type: 'image', src: photo, effects: e ? [e] : undefined }] });
    const [plain, full, half] = await Promise.all([raw(opts(null)), raw(opts(fx)), raw(opts({ ...fx, mask: { gradient: 'linear', from: [0.45, 0.5], to: [0.55, 0.5] } }))]);
    let left = 0; let right = 0; let n = 0;
    for (let y = 10; y < 90; y++) {
      for (let c = 0; c < 3; c++, n++) {
        left += Math.abs(half.data[(y * 160 + 20) * 4 + c] - plain.data[(y * 160 + 20) * 4 + c]);
        right += Math.abs(half.data[(y * 160 + 140) * 4 + c] - full.data[(y * 160 + 140) * 4 + c]);
      }
    }
    // Mean error: a pixel effect is embedded again as JPEG, a few levels off.
    assert.ok(left / n <= 2.5, `${fx.kind}: untouched where the mask is 0 (${(left / n).toFixed(2)})`);
    assert.ok(right / n <= 2.5, `${fx.kind}: full where it is 1 (${(right / n).toFixed(2)})`);
  }
  const f = maskField({ gradient: 'radial', from: 10, to: 20 }, { width: 100, height: 100, canvas: { width: 100, height: 100 } });
  assert.equal(f(50, 50), 0);
  assert.equal(f(50, 90), 1);
  assert.equal(maskField({ gradient: 'band', from: 5, to: 15, invert: true }, { width: 100, height: 100, canvas: { width: 100, height: 100 } })(50, 52), 1);
});

test('masks: layers say where (luminance), on filters and on pixels', async () => {
  const mask = { layers: [{ type: 'shape', kind: 'rect', x: 80, y: 0, width: 80, height: 100, fill: '#fff' }] };
  const opts = (/** @type {any} */ e) => ({ width: 160, height: 100, layers: [{ type: 'image', src: photo, effects: e ? [e] : undefined }] });
  const plain = await raw(opts(null));
  for (const fx of [{ kind: 'invert', mask }, { kind: 'zoom', amount: 0.5, mask }]) {
    const got = await raw(opts(fx));
    let left = 0;
    let right = 0;
    let n = 0;
    for (let y = 5; y < 95; y++) for (let c = 0; c < 3; c++, n++) {
      left += Math.abs(got.data[(y * 160 + 30) * 4 + c] - plain.data[(y * 160 + 30) * 4 + c]);
      right += Math.abs(got.data[(y * 160 + 130) * 4 + c] - plain.data[(y * 160 + 130) * 4 + c]);
    }
    assert.ok(left / n <= 2.5, `${fx.kind}: left untouched (${(left / n).toFixed(2)})`);
    assert.ok(right / n > 15, `${fx.kind}: right changed (${(right / n).toFixed(2)})`);
  }
});

test('seeded effects: the same seed draws the same, another draws differently', async () => {
  for (const kind of ['glitch', 'dust', 'vhs', 'lightLeak', 'lensFlare', 'grain', 'glass']) {
    const svg = (/** @type {number} */ seed) => renderSvg({ width: 120, height: 80, layers: [{ type: 'image', src: photo, effects: [{ kind, seed }] }] });
    assert.equal(await svg(3), await svg(3), `${kind} repeats`);
    assert.notEqual(await svg(3), await svg(4), `${kind} varies`);
  }
});

test('pixel effects embed at the layer\'s pixels: pixelate and ascii as crisp cells, the rest as one image', async () => {
  const px = await renderSvg({ width: 300, height: 200, layers: [{ type: 'image', src: photo, effects: [{ kind: 'pixelate', size: 20 }] }] });
  const m = /href="data:image\/png;base64,([^"]+)"/.exec(px);
  assert.ok(m && /image-rendering="pixelated"/.test(px));
  const meta = await sharp(Buffer.from(/** @type {RegExpExecArray} */ (m)[1], 'base64')).metadata();
  assert.deepEqual([meta.width, meta.height], [15, 10]);
  const ascii = await renderSvg({ width: 300, height: 200, layers: [{ type: 'image', src: photo, effects: [{ kind: 'ascii', cell: 12, color: '#33ff66', background: '#000' }] }] });
  const a = /href="data:image\/png;base64,([^"]+)"/.exec(ascii);
  const { data } = await sharp(Buffer.from(/** @type {RegExpExecArray} */ (a)[1], 'base64')).raw().toBuffer({ resolveWithObject: true });
  const colours = new Set();
  for (let i = 0; i < data.length; i += 3) colours.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
  assert.deepEqual([...colours].sort(), [0, 0x33ff66].sort((x, y) => x - y));
  const spun = await renderSvg({ width: 300, height: 200, layers: [{ type: 'image', src: photo, effects: [{ kind: 'spin' }] }] });
  assert.equal((spun.match(/<image/g) ?? []).length, 1);
  assert.match(spun, /href="data:image\/jpeg/);
});

test('every effect renders at release size within a few seconds', { skip: !process.env.COVERS_SLOW && 'set COVERS_SLOW=1 (renders each effect at 3000²)' }, async () => {
  // The filters added with these (the earlier riso filters are librsvg's own: see Known limits).
  const earlier = ['blur', 'motion', 'shadow', 'glow', 'border', 'wear', 'rough', 'warp', 'xerox', 'photocopy', 'duotone', 'grayscale', 'levels', 'saturate', 'matrix', 'grit', 'halftone', 'dither', 'threshold', 'filter', 'extrude'];
  for (const kind of EFFECTS) {
    if (earlier.includes(kind) && kind !== 'motion') continue;
    const t = performance.now();
    await renderImage({ format: 'release', layers: [{ type: 'image', src: photo, effects: [{ kind }] }] }, { cache: false });
    const s = (performance.now() - t) / 1000;
    assert.ok(s < 6, `${kind}: ${s.toFixed(1)} s`);
  }
});

test('defineRecipe validates effects: kinds, their options, masks and nested layers', () => {
  const ok = { name: 'fx', layers: [{ type: 'image', src: '{photo}', effects: [{ kind: 'spin', angle: 12, mask: { gradient: 'radial', center: [0.4, 0.3], from: '8vmin', to: '30vmin' } }, 'grain', { kind: 'motion', angle: -20, mask: { layers: [{ type: 'solid', color: '#fff' }] } }, { kind: 'look', name: 'tealOrange', amount: '{opt.amount}' }] }] };
  assert.doesNotThrow(() => defineRecipe(ok));
  const bad = (/** @type {any} */ effects) => () => defineRecipe({ name: 'fx', layers: [{ type: 'solid', effects }] });
  assert.throws(bad([{ kind: 'sparkle' }]), /effects\[0\]\.kind: unknown effect "sparkle"/);
  assert.throws(bad(['sparkle']), /unknown effect "sparkle"/);
  assert.throws(bad([{ kind: 'spin', angel: 10 }]), /"spin" effects have no option "angel"/);
  assert.throws(bad([{ kind: 'blur', mask: { gradient: 'diamond' } }]), /mask\.gradient/);
  assert.throws(bad([{ kind: 'blur', mask: { layers: [{ type: 'nope' }] } }]), /mask\.layers\[0\]\.type: unknown layer type/);
  assert.throws(bad([{ kind: 'displace', map: { layers: [{ type: 'solid', colour: '#fff' }] } }]), /map\.layers\[0\]\.colour/);
  // Every kind's options are listed.
  for (const kind of EFFECTS) assert.ok(EFFECT_OPTIONS[kind], kind);
});

test('where nothing can draw pixels (a Worker), pixel effects fall back to a filter or are left out', () => {
  const c = { width: 100, height: 100, canvas: { width: 100, height: 100 }, id: 'l0', rng: createRng('w') };
  assert.equal(applyEffects('<rect/>', [{ kind: 'spin' }], /** @type {any} */ (c)).body, '<rect/>');
  assert.match(applyEffects('<rect/>', [{ kind: 'lens' }], /** @type {any} */ (c)).defs, /feGaussianBlur/);
  assert.match(applyEffects('<rect/>', [{ kind: 'tilt' }], /** @type {any} */ (c)).defs, /feGaussianBlur.*luminanceToAlpha/);
  assert.ok(isPixel({ kind: 'chromatic', mode: 'radial' }) && !isPixel({ kind: 'chromatic' }));
  assert.ok(isPixel({ kind: 'motion' }, { raster: true }) && !isPixel({ kind: 'motion' }));
  assert.ok(needsPixels('kaleidoscope') && !needsPixels('vignette') && !needsPixels('extrude'));
});
