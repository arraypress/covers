import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { cover, renderSvg, renderImage } from '../src/index.js';
import { flattenPath, flattenBody } from '../src/flatten.js';
import { gridPath } from '../src/grid.js';
import { relativeLuminance, contrastRatio } from '@arraypress/color-utils';

const hexAt = (data, i) => '#' + [data[i], data[i + 1], data[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('');

test('flatten: every path command, closed shapes and primitives', () => {
  const [sq] = flattenPath('M0 0H10V10H0Z', 1);
  assert.ok(sq.closed);
  assert.deepEqual(sq.points.at(-1), [0, 0]);
  assert.ok(sq.points.length >= 40);
  const rel = flattenPath('m5 5l5 0v5h-5z', 1)[0].points;
  assert.deepEqual(rel[0], [5, 5]);
  assert.ok(rel.some(([x, y]) => x === 10 && y === 10));
  // A half circle by arc from (0,0) to (10,0) bulges to y = ±5.
  const arc = flattenPath('M0 0A5 5 0 0 1 10 0', 0.5)[0].points;
  const ys = arc.map((p) => p[1]);
  assert.ok(Math.abs(Math.min(...ys) + 5) < 0.05 || Math.abs(Math.max(...ys) - 5) < 0.05);
  const curves = flattenPath('M0 0C0 10 10 10 10 0S20 -10 20 0Q25 5 30 0T40 0', 0.5)[0].points;
  assert.deepEqual(curves.at(-1).map((v) => Math.round(v)), [40, 0]);
  const body = flattenBody('<circle cx="12" cy="12" r="10"/><rect x="2" y="2" width="8" height="6" rx="2"/><line x1="0" y1="0" x2="4" y2="4"/><polyline points="1 1 5 1 5 5"/><polygon points="0,0 3,0 3,3"/>');
  assert.equal(body.lines.length, 5);
  assert.deepEqual(body.closed, [true, true, false, false, true]);
});

test('gridPath breaks lines around gaps', () => {
  const d = gridPath([50], [50], 100, 100, [{ x: 40, y: 40, width: 20, height: 20 }]);
  assert.equal(d, 'M0 50H40M60 50H100M50 0V40M50 60V100');
  assert.equal(gridPath([25], [], 100, 100, []), 'M25 0V100');
});

test('pattern: divisions, dotted, gaps', async () => {
  const svg = await renderSvg({ width: 400, height: 200, layers: [{ type: 'pattern', kind: 'grid', divisions: 4, dash: 'dotted', gaps: [{ x: 0.4, y: 0.4, width: 0.2, height: 0.2 }] }] });
  assert.match(svg, /stroke-dasharray="0 [\d.]+"/);
  assert.match(svg, /stroke-linecap="round"/);
  assert.match(svg, /M0 100H160M240 100H400/);
});

test('diagram: layouts, arrows, grid gaps, knockouts, line weight', async () => {
  const base = { seed: 'd', width: 600, height: 600 };
  const row = await renderSvg({ ...base, layers: [{ type: 'diagram', nodes: [{ icon: 'lucide:send' }, { icon: 'lucide:cpu' }, {}], arrows: 'loop', grid: true }] });
  assert.ok((row.match(/<rect /g) ?? []).length >= 3, 'three square tiles');
  assert.match(row, /Q/, 'the loop has rounded elbows');
  assert.match(row, /stroke-dasharray="0 /, 'a dotted grid');
  // Lucide strokes are rescaled to the tiles' 0.3vmin = 1.8px.
  const sizes = [...row.matchAll(/stroke-width="([\d.]+)"/g)].map((m) => +m[1]);
  assert.ok(sizes.includes(1.8));
  const hub = await renderSvg({ ...base, layers: [{ type: 'diagram', layout: 'hub', nodes: [{ icon: 'lucide:globe' }, { icon: 'lucide:database' }, { icon: 'lucide:database' }] }] });
  assert.match(hub, /<mask[^>]*>.*<circle[^>]*fill="#000"/s, 'the hub is knocked out behind its satellites');
  const square = await renderSvg({ ...base, layers: [{ type: 'diagram', layout: 'square', nodes: [{}, {}, {}, {}, { shape: 'square' }] }] });
  assert.equal((square.match(/<circle /g) ?? []).length, 4, 'four circle nodes');
  assert.match(square, /stroke-dasharray/, 'dotted spokes to the centre');
  for (const layout of ['single', 'triangle', 'stack']) {
    const svg = await renderSvg({ ...base, layers: [{ type: 'diagram', layout, nodes: layout === 'single' ? [{ icon: 'lucide:feather', shape: 'none' }] : [{}, {}, {}], arrows: layout === 'triangle' ? 'both' : true }] });
    assert.doesNotMatch(svg, /NaN|undefined/, layout);
  }
});

test('diagram recipe: white line art over a field it reads on (3:1)', async () => {
  for (const palette of ['paper', 'ink', 'dawn', 'dusk', 'ocean', 'ember', 'moss', 'carbon', 'mono']) {
    const o = { recipe: 'diagram', palette, seed: palette, width: 200, diagram: false, grain: false };
    const { data, info } = await sharp(await renderImage(o, { format: 'png' })).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    let worst = 21;
    for (let i = 0; i < data.length; i += 3 * 37) worst = Math.min(worst, contrastRatio('#ffffff', hexAt(data, i)));
    assert.ok(worst >= 3, `${palette}: white lines at ${worst.toFixed(2)}:1`);
    void info;
  }
  const c = cover({ recipe: 'diagram', seed: 'x', nodes: [{ icon: 'lucide:globe' }], layout: 'hub' });
  assert.equal(c.layers.find((l) => l.type === 'diagram').layout, 'hub');
});

test('paper: hand-cut edges are straight cuts, seeded', async () => {
  const o = { seed: 'p', width: 400, layers: [{ type: 'paper', count: 4 }] };
  const a = await renderSvg(o);
  assert.equal(a, await renderSvg(o));
  assert.notEqual(a, await renderSvg({ ...o, seed: 'q' }));
  const paths = [...a.matchAll(/<path d="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(paths.length, 4);
  for (const d of paths) assert.match(d, /^M[\d. -]+(L[\d. -]+)+Z$/, 'only straight cuts');
  assert.match(a, /fill="#faf9f5"/);
});

test('scribble: an icon re-drawn by hand, and a node graph', async () => {
  const svg = await renderSvg({ seed: 's', width: 400, layers: [{ type: 'scribble', icon: 'lucide:compass' }] });
  const widths = new Set([...svg.matchAll(/stroke-width="([\d.]+)"/g)].map((m) => m[1]));
  assert.ok(widths.size > 3, 'the line width varies');
  assert.match(svg, /stroke-linecap="round"/);
  const graph = await renderSvg({ seed: 's', width: 400, layers: [{ type: 'scribble', graph: { nodes: 5 }, color: '#141413' }] });
  assert.equal((graph.match(/<circle /g) ?? []).length, 5);
});

test('cutout recipe: field, panel, shapes, graph and stroke options', () => {
  const ids = (o) => cover({ recipe: 'cutout', seed: 'c', palette: { accent: '#8b80c9', bg: '#1f1e1d' }, ...o }).layers.map((l) => l.id).join(',');
  assert.equal(ids({}), 'bg,shapes,icon,grain');
  assert.equal(ids({ panel: true }), 'bg,panel,shapes,icon,grain');
  assert.equal(ids({ graph: true }), 'bg,shapes,graph,grain');
  const plain = cover({ recipe: 'cutout', seed: 'c', palette: { accent: '#8b80c9' } });
  assert.equal(plain.layers.find((l) => l.id === 'shapes').count, 3);
  assert.equal(plain.layers.find((l) => l.id === 'icon').color, '#141413', 'dark ink over paper shapes');
  const panel = cover({ recipe: 'cutout', seed: 'c', panel: true, palette: { accent: '#b5694f', bg: '#1f1e1d' } });
  assert.equal(panel.layers.find((l) => l.id === 'bg').color, '#1f1e1d', 'the page colour around the panel');
  assert.equal(panel.layers.find((l) => l.id === 'shapes').count, 0);
  assert.equal(panel.layers.find((l) => l.id === 'icon').color, '#faf9f5', 'light ink on the panel');
  assert.equal(cover({ recipe: 'cutout', seed: 'c', stroke: 'light' }).layers.find((l) => l.id === 'icon').color, '#faf9f5');
  assert.equal(cover({ recipe: 'cutout', seed: 'c', shapes: 0 }).layers.find((l) => l.id === 'icon').color, '#faf9f5');
});

test('renderImage: a mesh reaches the canvas edge without fading (padded render)', async () => {
  // One field far bigger than the canvas: it should be the same colour edge to edge.
  const o = { seed: 'v', width: 300, height: 300, layers: [{ type: 'solid', color: '#000000' }, { type: 'mesh', arrangement: 'ring', base: null, blur: '10vmax', blobs: [{ x: 0.5, y: 0.5, r: 3, squash: 1, color: '#ff0000' }] }] };
  const { data } = await sharp(await renderImage(o, { format: 'png' })).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  for (const [x, y] of [[0, 0], [299, 0], [0, 299], [299, 299], [150, 0], [0, 150]]) {
    assert.ok(data[(y * 300 + x) * 3] >= 250, `edge ${x},${y} is ${data[(y * 300 + x) * 3]}`);
  }
  // librsvg on its own (the plain SVG) fades that edge: the reason for the padding.
  const raw = await sharp(Buffer.from(await renderSvg(o))).removeAlpha().raw().toBuffer();
  assert.ok(raw[0] < 200);
});

test('grain vary: edges heavier than the centre, in both renderers', async () => {
  const layers = [{ type: 'solid', color: '#808080' }, { type: 'grain', amount: 0.1, vary: 'edges' }];
  const buf = await renderImage({ seed: 'g', width: 300, height: 300, layers }, { format: 'png' });
  const st = async (left, top) => (await sharp(await sharp(buf).extract({ left, top, width: 40, height: 40 }).png().toBuffer()).stats()).channels[0].stdev;
  assert.ok((await st(0, 0)) > (await st(130, 130)) * 1.5);
  assert.match(await renderSvg({ seed: 'g', width: 300, height: 300, layers }), /<mask/);
});

test('cutout: the field holds both inks at 3:1 (non-text) on every preset', async () => {
  const { palettes } = await import('../src/index.js');
  for (const palette of [...Object.keys(palettes), { accent: '#8b80c9' }, { accent: '#b5694f' }, { accent: '#c4a052' }]) {
    const field = cover({ recipe: 'cutout', seed: 'c', palette }).layers.find((l) => l.id === 'bg').color;
    for (const ink of ['#141413', '#faf9f5']) {
      assert.ok(contrastRatio(ink, field) >= 3, `${JSON.stringify(palette)}: ${ink} on ${field} = ${contrastRatio(ink, field).toFixed(2)}`);
    }
  }
});
