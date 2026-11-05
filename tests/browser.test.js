import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderSvg } from '../src/index.js';
import { serve } from './browser/server.mjs';

// Browser smoke test: the same src/ in headless Chrome (no Node APIs, no
// sharp), driven over the Chrome DevTools Protocol. Skipped when no Chrome
// with remote debugging is listening (COVERS_CDP, default localhost:9334).
const CDP = process.env.COVERS_CDP ?? 'http://localhost:9334';
const available = await fetch(`${CDP}/json/version`).then((r) => r.ok, () => false);

/** Open a tab, run fn, close it. */
async function withTab(fn) {
  const t = await (await fetch(`${CDP}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { const { r, j } = pending.get(m.id); pending.delete(m.id); m.error ? j(new Error(JSON.stringify(m.error))) : r(m.result); }
  };
  const send = (method, params = {}) => new Promise((r, j) => { const i = ++id; pending.set(i, { r, j }); ws.send(JSON.stringify({ id: i, method, params })); });
  const evaluate = async (expression) => {
    const res = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (res.exceptionDetails) throw new Error(JSON.stringify(res.exceptionDetails).slice(0, 1500));
    return res.result.value;
  };
  try {
    await send('Page.enable');
    return await fn({ send, evaluate });
  } finally {
    ws.close();
    await fetch(`${CDP}/json/close/${t.id}`);
  }
}

/** Load the smoke page and run cases in it. */
async function inBrowser(base, cases, opts = {}) {
  return withTab(async ({ send, evaluate }) => {
    await send('Page.navigate', { url: `${base}/tests/browser/page.html` });
    for (let i = 0; i < 100 && !(await evaluate('window.ready === true').catch(() => false)); i++) await new Promise((r) => setTimeout(r, 50));
    return evaluate(`window.smoke(${JSON.stringify(cases)}, ${JSON.stringify(opts)})`);
  });
}

// Covers made only of vectors and text: the browser must draw the same bytes as Node.
const SAME = [
  { recipe: 'gridTitle', seed: 'b1', title: 'Covers in the browser', label: 'Smoke', palette: 'dusk', width: 600 },
  { recipe: 'bigType', seed: 'b2', title: 'Same bytes everywhere', aspect: '4:5', width: 500 },
  { recipe: 'brand', seed: 'b3', format: 'x-header', name: 'Hollow Fern', tagline: 'Field recordings', palette: { accent: '#2f6b4f' }, mark: '<path d="M256 48c-74 64-120 140-120 214a120 120 0 0 0 240 0c0-74-46-150-120-214z"/>' },
  { seed: 'b4', width: 400, height: 500, layers: [
    { type: 'solid', color: '#e5251d' },
    { type: 'group', viewBox: [0, 0, 400, 500], layers: [
      { type: 'text', content: 'Grid,', weight: 800, size: 133, x: 13, y: 294, width: 373, color: '#fff' },
      { type: 'text', content: 'ROUND AND ROUND', size: 18, path: { kind: 'circle', cx: 200, cy: 120, r: 80 }, fitPath: true, color: '#fff' },
      { type: 'table', x: 16, y: 26, size: 9, columns: [{ x: 16, weight: 700 }, { x: 384, align: 'right' }], rows: [['Halls', 'Nº 14'], ['Tue—Sun', 'Exhibition']], color: '#fff' },
      { type: 'shape', kind: 'burst', cx: 320, cy: 420, r: 40, fill: '#ffe800' },
      { type: 'barcode', value: 'SMOKE-1', x: 20, y: 400, width: 120, height: 40, color: '#fff' },
    ] },
    { type: 'solid', color: '#f29ad8', knockout: [{ type: 'text', content: 'MAKE IT', size: 120, x: 14, y: 118, width: 372 }], opacity: 0.9 },
  ] },
];
// Pixel-based layers: PNG bytes differ by compressor (zlib vs CompressionStream); they must still render.
const RENDERS = [
  { recipe: 'riso', seed: 'b5', width: 400 },
  { recipe: 'dither', seed: 'b6', width: 400 },
  { recipe: 'mark', seed: 'b7', icon: 'lucide:feather', width: 400 },
  { seed: 'b8', width: 400, layers: [{ type: 'solid' }, { type: 'shape', kind: 'circle', r: 150, fill: '#888', effects: [{ kind: 'halftone', ink: '#0078bf' }, { kind: 'wear' }] }, { type: 'text', content: 'Live', render: 'live', anchor: 'center', size: 80 }, { type: 'text', content: 'Auto', color: 'auto', anchor: 'top-left' }] },
  // Pixel effects through a canvas: spin, kaleidoscope, a masked lens blur, a layer-masked filter, ASCII.
  { seed: 'b9', width: 300, layers: [
    { type: 'linear', colors: ['#1d3557', '#e63946'] },
    { type: 'shape', kind: 'star', cx: 150, cy: 150, r: 90, fill: '#f1faee', effects: [{ kind: 'spin', angle: 20 }, { kind: 'kaleidoscope', segments: 6 }, { kind: 'lens', radius: 6, mask: { gradient: 'radial', from: 20, to: 80 } }] },
    { type: 'solid', color: '#fff', opacity: 0.3, effects: [{ kind: 'invert', mask: { layers: [{ type: 'shape', kind: 'circle', cx: 150, cy: 150, r: 60, fill: '#fff' }] } }, { kind: 'ascii', cell: 10 }] },
  ] },
];

test('browser: renderSvg draws byte-identical SVG to Node, and the pixel layers render', { skip: !available && 'no Chrome on COVERS_CDP' }, async () => {
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const got = await inBrowser(base, [...SAME, ...RENDERS], { icons: '/node_modules/@iconify-json/{prefix}/icons.json' });
    assert.deepEqual(got.errors, []);
    for (let i = 0; i < SAME.length; i++) assert.equal(got.svgs[i], await renderSvg(SAME[i]), `case ${i} matches Node`);
    for (let i = SAME.length; i < got.svgs.length; i++) assert.match(got.svgs[i], /^<svg xmlns/, `case ${i} renders`);
    assert.match(got.svgs[SAME.length + 3], /<text[^>]*font-family="covers-Inter/, 'live text');
    assert.equal((got.svgs[SAME.length + 4].match(/<image[^>]*href="data:image\/(png|jpeg);base64/g) ?? []).length, 2, 'pixel effects drawn through a canvas');
    assert.equal(got.png.type, 'image/png');
    assert.ok(got.png.size > 1000);
    assert.equal(got.webp.type, 'image/webp');
  } finally {
    server.close();
  }
});

test('browser: HarfBuzz wasm loads from a URL given to configure()', { skip: !available && 'no Chrome on COVERS_CDP' }, async () => {
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const got = await inBrowser(base, [SAME[1]], { wasm: '/node_modules/harfbuzzjs/dist/harfbuzz.wasm' });
    assert.deepEqual(got.errors, []);
    assert.equal(got.svgs[0], await renderSvg(SAME[1]));
  } finally {
    server.close();
  }
});

// Motion plays in Chrome: frames at two times differ where things move and nowhere else; reduced motion stops it.
const MOVING = { width: 400, height: 300, seed: 'moving', layers: [
  { type: 'solid', color: '#101018' },
  { type: 'text', content: 'STILL', size: 40, x: 16, y: 160, color: '#fff' },
  { type: 'shape', kind: 'rect', x: 200, y: 40, width: 40, height: 40, fill: '#ffb31a', motion: 'blink' },
  { type: 'shape', kind: 'rect', x: 250, y: 195, width: 100, height: 10, fill: '#ff2bd6', motion: { preset: 'spin', duration: 4, origin: [300, 200] } },
] };

/** Mean absolute difference of two PNGs inside a box (0–255). */
async function boxDiff(a, b, [x, y, w, h]) {
  const { default: sharp } = await import('sharp');
  const crop = (p) => sharp(p).extract({ left: x, top: y, width: w, height: h }).removeAlpha().raw().toBuffer();
  const [pa, pb] = await Promise.all([crop(a), crop(b)]);
  let d = 0;
  for (let i = 0; i < pa.length; i++) d += Math.abs(pa[i] - pb[i]);
  return d / pa.length;
}

test('browser: motion runs (frames differ where it moves, not elsewhere), in an <img> too, and stops for reduced motion', { skip: !available && 'no Chrome on COVERS_CDP' }, async () => {
  const svg = await renderSvg(MOVING);
  const uri = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  await withTab(async ({ send, evaluate }) => {
    await send('Emulation.setDeviceMetricsOverride', { width: 400, height: 300, deviceScaleFactor: 1, mobile: false });
    const shot = async () => Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64');
    const open = async (url) => {
      await send('Page.navigate', { url });
      for (let i = 0; i < 100 && (await evaluate('document.readyState')) !== 'complete'; i++) await new Promise((r) => setTimeout(r, 30));
    };
    const at = async (t) => { await evaluate(`(() => { for (const a of document.getAnimations()) { a.pause(); a.currentTime = ${t * 1000}; } })()`); return shot(); };
    const STILL = [0, 100, 180, 100];
    const BLINK = [195, 35, 50, 50];
    const SPIN = [240, 140, 120, 120];

    await open(uri);
    assert.equal(await evaluate('document.getAnimations().length'), 2);
    const a = await at(0.25);
    const b = await at(0.75);
    assert.equal(await boxDiff(a, b, STILL), 0, 'still type unchanged');
    assert.ok(await boxDiff(a, b, BLINK) > 20, 'the cursor blinked');
    assert.ok(await boxDiff(a, b, SPIN) > 2, 'the bar turned');

    await open(`data:text/html,<body style="margin:0"><img src="${uri}" width="400" height="300"></body>`);
    const c = await shot();
    await new Promise((r) => setTimeout(r, 700));
    const d = await shot();
    assert.equal(await boxDiff(c, d, STILL), 0);
    assert.ok(await boxDiff(c, d, SPIN) > 1, 'plays in an <img>');

    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await open(uri);
    assert.equal(await evaluate('document.getAnimations().length'), 0, 'no animations under reduced motion');
    const e = await shot();
    await new Promise((r) => setTimeout(r, 700));
    assert.equal(await boxDiff(e, await shot(), [0, 0, 400, 300]), 0, 'stands still');
  });
});
