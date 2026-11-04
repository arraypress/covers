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
