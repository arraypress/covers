import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderSvg, loadRecipe, defineRecipe, cover } from '../src/index.js';
import { renderReport } from '../src/render.js';
import { lineSpans } from '../src/type/spans.js';
import { sheetGrid } from '../src/layers/marks.js';
import { markGeometry } from '../src/layers/mark-geometry.js';
import { SYMBOLS } from '../src/type/symbols.js';
import { isolines } from '../src/layers/isolines.js';
import { markGuides } from '../src/layers/guides.js';

const root = new URL('..', import.meta.url);
const photo = await readFile(new URL('examples/photo.jpg', root));
const recipe = (name) => loadRecipe(new URL(`recipes/flyers/${name}.json`, root));
const MARK = '<path fill-rule="evenodd" d="M256 48c-74 64-120 140-120 214a120 120 0 0 0 240 0c0-74-46-150-120-214zm0 100c30 32 50 66 50 100a50 50 0 0 1-100 0c0-34 20-68 50-100z"/>';
const WIDE = '<path d="M64 200h384v112H64z"/>';
const RING = '<path fill-rule="evenodd" d="M256 96a160 160 0 1 1 0 320a160 160 0 1 1 0-320zm0 24a136 136 0 1 0 0 272a136 136 0 1 0 0-272z"/>';
/** Canvas sizes on the recipes' 400-wide design grid (drawn at scale 1, so reported boxes are grid units). */
const SIZES = { '4:5': [400, 500], '1:1': [400, 400], '9:16': [400, 711] };

/** Render, collecting what the renderer reports (text blocks with their boxes). */
async function rendered(options) {
  const { svg, drawn } = await renderReport(options);
  return { svg, text: Object.fromEntries(drawn.filter((e) => e.kind === 'text' && e.id).map((e) => [e.id, e.box])) };
}

/** Whether box a lies inside box b (a hair of slack for outlines). */
const inside = (a, b, slack = 0.6) => a.x >= b.x - slack && a.y >= b.y - slack && a.x + a.width <= b.x + b.width + slack && a.y + a.height <= b.y + b.height + slack;

/** The nested `<svg x y width height viewBox>` elements in markup. */
const svgBoxes = (svg, viewBox) => [...svg.matchAll(/<svg x="([-\d.]+)" y="([-\d.]+)" width="([\d.]+)" height="([\d.]+)" viewBox="([^"]+)"/g)]
  .filter((m) => !viewBox || m[5] === viewBox)
  .map((m) => ({ x: +m[1], y: +m[2], width: +m[3], height: +m[4] }));

// ---------------------------------------------------------------------------
// Library pieces the posters stand on
// ---------------------------------------------------------------------------

test('JSON: round, floor and ceil', () => {
  const r = defineRecipe({ name: 'ops', vars: { a: { round: { div: ['@height', 62.5] } }, b: { floor: 3.7 }, c: { ceil: [3.2] } }, layers: [{ type: 'text', content: '{opt.x}', x: '$a', y: '$b', size: '$c' }] });
  const [layer] = cover({ recipe: r, width: 400, height: 711, x: 'x' }).layers;
  assert.deepEqual([layer.x, layer.y, layer.size], [11, 3, 4]);
  assert.throws(() => defineRecipe({ name: 'bad', layers: [{ type: 'solid', opacity: { round: [1, 2] } }] }), /round: takes 1 argument/);
});

test('pattern: divisions as [cols, rows] draws a design grid', async () => {
  const svg = await renderSvg({ width: 400, height: 500, layers: [{ type: 'pattern', divisions: [5, 8], stroke: 1 }] });
  const d = svg.match(/<path d="([^"]+)" fill="none"/)[1];
  assert.equal((d.match(/M/g) ?? []).length, 4 + 7, '4 inner columns and 7 inner rows');
  assert.match(d, /M80 0/);
  assert.match(d, /M0 62.5/);
});

test('text: content lines as spans, bold at boldWeight; the built-in ≠', async () => {
  assert.deepEqual(lineSpans([{ content: 'Signal', bold: true }, 'over']), [{ content: 'Signal\n', bold: true }, { content: 'over' }]);
  assert.equal(lineSpans(['a', 'b']), undefined, 'plain lines stay content');
  const fonts = [{ name: 'Inter', src: new URL('fonts/inter-latin-400.woff', root).pathname, weight: 400 }, { name: 'Inter', src: new URL('fonts/inter-latin-700.woff', root).pathname, weight: 700 }];
  const draw = (content) => renderSvg({ width: 400, fonts, layers: [{ type: 'text', content, x: 10, y: 100, size: 40, weight: 400, boldWeight: 700 }] });
  const mixed = await draw([{ content: 'AB', bold: true }, 'AB']);
  const light = await draw(['AB', 'AB']);
  assert.notEqual(mixed, light, 'the bold line is set in another face');
  assert.equal(mixed.match(/<path d="M/g).length, light.match(/<path d="M/g).length);
  assert.ok(SYMBOLS.includes('≠'));
  const ne = await renderSvg({ width: 400, layers: [{ type: 'text', content: '≠', x: 10, y: 100, size: 40 }] });
  assert.match(ne, /<path d="M[\d.]+/, '≠ draws from the built-in symbols');
});

// ---------------------------------------------------------------------------
// grid-poster
// ---------------------------------------------------------------------------

const GRID = { mark: MARK, name: 'Kestrel', seed: 'g' };

test('grid-poster: the same options draw the same bytes; photo or field', async () => {
  const r = recipe('grid-poster');
  for (const extra of [{}, { photo }]) {
    const a = await renderSvg({ recipe: r, ...GRID, ...extra, format: 'instagram-post' });
    assert.equal(a, await renderSvg({ recipe: r, ...GRID, ...extra, format: 'instagram-post' }));
    assert.doesNotMatch(a.replace(/data:[^"')]+/g, ''), /NaN|undefined/);
    assert.match(a, extra.photo ? /<image/ : /radialGradient/);
  }
});

test('grid-poster: rows follow the aspect, every text field sits in its cell, the mark in its tile', async () => {
  const r = recipe('grid-poster');
  for (const [aspect, [w, h]] of Object.entries(SIZES)) {
    const rows = Math.max(4, Math.round(h / 62.5));
    assert.equal(rows, { '4:5': 8, '1:1': 6, '9:16': 11 }[aspect], aspect);
    const rowH = h / rows;
    const mid = Math.floor((rows - 1) / 2);
    const cells = (c0, c1, r0, r1 = r0) => ({ x: c0 * 80, y: r0 * rowH, width: (c1 - c0 + 1) * 80, height: (r1 - r0 + 1) * rowH });
    const where = {
      series: cells(0, 0, 0), handle: cells(2, 2, 0), year: cells(4, 4, 0),
      label: cells(0, 0, mid), code: cells(1, 1, mid), coords: cells(4, 4, mid),
      headline: cells(1, 4, mid + 1, rows - 2),
      credit: cells(0, 0, rows - 1), sub: cells(1, 3, rows - 1), save: cells(4, 4, rows - 1),
    };
    const { svg, text } = await rendered({ recipe: r, ...GRID, width: w, height: h, headline: [{ content: 'Visibility', bold: true }, 'is not', { content: 'clarity', bold: true }] });
    for (const [id, cell] of Object.entries(where)) {
      assert.ok(text[id], `${aspect}: ${id} drawn`);
      assert.ok(inside(text[id], cell), `${aspect}: ${id} ${JSON.stringify(text[id])} inside ${JSON.stringify(cell)}`);
    }
    // The grid: 4 column lines and rows − 1 row lines.
    const grid = svg.match(/<path d="([^"]+)" fill="none" stroke="#ffffff"/)[1];
    assert.equal(grid.match(/M/g).length, 4 + rows - 1, `${aspect}: ${rows} rows`);
    // The mark on its tile, the tile in cell (0, 1).
    const [mark] = svgBoxes(svg, '0 0 512 512');
    const tile = cells(0, 0, 1);
    assert.ok(inside(mark, tile, 0), `${aspect}: mark ${JSON.stringify(mark)} inside ${JSON.stringify(tile)}`);
    const rect = svg.match(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)" fill="#ffffff"/);
    assert.ok(inside({ x: +rect[1], y: +rect[2], width: +rect[3], height: +rect[4] }, tile, 0), `${aspect}: tile inside its cell`);
    assert.ok(inside(mark, { x: +rect[1], y: +rect[2], width: +rect[3], height: +rect[4] }, 0), `${aspect}: mark on the tile`);
  }
});

test('grid-poster: a long headline shrinks to its rows and stays in its columns', async () => {
  const { text } = await rendered({ recipe: recipe('grid-poster'), ...GRID, width: 400, height: 400, headline: ['One', { content: 'two three four', bold: true }, 'five', 'six', 'seven'] });
  assert.ok(inside(text.headline, { x: 80, y: 3 * 400 / 6, width: 320, height: 2 * 400 / 6 }), JSON.stringify(text.headline));
});

// ---------------------------------------------------------------------------
// logofolio
// ---------------------------------------------------------------------------

test('logofolio: marks drawn small or large on their grid come out the same size', async () => {
  const small = '<path d="M216 216h80v80h-80z"/>';
  const large = '<path d="M64 64h384v384H64z"/>';
  const { svg } = await rendered({ recipe: recipe('logofolio'), seed: 'l', marks: [small, large, small], width: 400, height: 500 });
  const [a, b, c] = svgBoxes(svg).filter((x) => x.width < 200);
  assert.equal(a.width, b.width);
  assert.equal(a.width, c.width);
});

test('logofolio: a sheet from 3 × 3 to 10 × 7, columns and rows from the count', () => {
  assert.deepEqual(sheetGrid(4, 1), { cols: 3, rows: 3 });
  assert.deepEqual(sheetGrid(25, 1.64), { cols: 5, rows: 5 });
  assert.deepEqual(sheetGrid(70, 0.8), { cols: 10, rows: 7 });
  assert.deepEqual(sheetGrid(90, 0.8), { cols: 10, rows: 7 }, 'past 70 are left out');
  assert.deepEqual(sheetGrid(12, 1, 6), { cols: 6, rows: 2 });
});

test('logofolio: deterministic; every mark in its own cell, optically the same size, the text in the margins', async () => {
  const r = recipe('logofolio');
  const marks = Array.from({ length: 12 }, (_, i) => [MARK, WIDE, RING][i % 3]);
  for (const [aspect, [w, h]] of Object.entries({ '4:5': SIZES['4:5'], '1:1': SIZES['1:1'], a4: [400, 566] })) {
    const o = { recipe: r, seed: 'l', marks, width: w, height: h, footer: 'logomarks.ai' };
    const { svg, text } = await rendered(o);
    assert.equal(svg, await renderSvg(o), `${aspect}: deterministic`);
    const box = { x: 16, y: 128, width: 368, height: h - 176 };
    const { cols, rows } = sheetGrid(12, box.width / box.height);
    const cell = Math.min(box.width / cols, box.height / rows);
    const ox = box.x + (box.width - cols * cell) / 2;
    const oy = box.y + (box.height - rows * cell) / 2;
    const drawn = svgBoxes(svg).filter((b) => b.width < cell);
    assert.equal(drawn.length, 12, aspect);
    drawn.forEach((b, i) => {
      const c = { x: ox + (i % cols) * cell, y: oy + Math.floor(i / cols) * cell, width: cell, height: cell };
      assert.ok(inside(b, c, 0), `${aspect}: mark ${i} in its cell`);
    });
    // Optical size: by the marks' real bounds, not their 512 grid; a mark that inks less is drawn no smaller; a wide one is held to its cell.
    const [drop, wide, ring] = drawn;
    assert.ok(ring.width >= drop.height * 0.98, `${aspect}: the ring (inking less) no smaller than the drop`);
    assert.ok(wide.width <= cell * 0.86 + 0.01 && wide.height < drop.height, `${aspect}: the wide bar held to its cell`);
    for (const id of ['subtitle', 'meta', 'title']) assert.ok(text[id].y + text[id].height <= box.y, `${aspect}: ${id} above the sheet`);
    for (const id of ['footer', 'count']) assert.ok(text[id].y >= box.y + box.height, `${aspect}: ${id} below the sheet`);
  }
});

// ---------------------------------------------------------------------------
// pixel-mosaic
// ---------------------------------------------------------------------------

/** The mosaic's cells (its path's squares), as boxes. */
const mosaicCells = (svg, color = '#c8ff2e') => {
  const d = svg.match(new RegExp(`<path d="([^"]+)" fill="${color}"`))[1];
  return [...d.matchAll(/M([\d.]+) ([\d.]+)h([\d.]+)/g)].map((m) => ({ x: +m[1], y: +m[2], width: +m[3], height: +m[3] }));
};

test('pixel-mosaic: the cells follow the mark, drop out by seed, and stay deterministic', async () => {
  const r = recipe('pixel-mosaic');
  const a = await renderSvg({ recipe: r, seed: 'one', mark: MARK, width: 400, height: 500 });
  assert.equal(a, await renderSvg({ recipe: r, seed: 'one', mark: MARK, width: 400, height: 500 }), 'deterministic');
  const b = await renderSvg({ recipe: r, seed: 'two', mark: MARK, width: 400, height: 500 });
  const [ca, cb] = [mosaicCells(a), mosaicCells(b)];
  assert.notDeepEqual(ca, cb, 'another seed drops other cells');
  const all = mosaicCells(await renderSvg({ recipe: r, seed: 'one', mark: MARK, width: 400, height: 500, drop: 0 }));
  assert.ok(ca.length < all.length && ca.length > all.length * 0.7, `${ca.length} of ${all.length} kept`);
  // Every kept cell is one of the full mosaic's (dropping only removes).
  const key = (c) => `${c.x},${c.y}`;
  const full = new Set(all.map(key));
  assert.ok(ca.every((c) => full.has(key(c))));
  // A solid square fills its whole grid: the mosaic follows the mark's own shape.
  const square = mosaicCells(await renderSvg({ recipe: r, seed: 's', mark: '<path d="M96 96h320v320H96z"/>', width: 400, height: 500, drop: 0, cells: 10, accent: false }));
  assert.equal(square.length, 100);
});

test('pixel-mosaic: about 80% of the width at 4:5, inside its box at every aspect, the type in the foot', async () => {
  const r = recipe('pixel-mosaic');
  for (const [aspect, [w, h]] of Object.entries(SIZES)) {
    const { svg, text } = await rendered({ recipe: r, seed: 'm', mark: '<path d="M96 96h320v320H96z"/>', photo, width: w, height: h, cells: 10 });
    const cells = mosaicCells(svg);
    const x0 = Math.min(...cells.map((c) => c.x));
    const x1 = Math.max(...cells.map((c) => c.x + c.width));
    const y1 = Math.max(...cells.map((c) => c.y + c.height));
    assert.ok(x0 >= 40 - 0.5 && x1 <= 360 + 0.5, `${aspect}: within the mosaic's columns`);
    if (aspect !== '1:1') assert.ok(x1 - x0 > 0.6 * 400, `${aspect}: ${Math.round(((x1 - x0) / 400) * 100)}% of the width`);
    assert.ok(y1 <= text.title.y, `${aspect}: above the title`);
    assert.ok(text.title.x >= 15 && text.title.x + text.title.width <= 385, `${aspect}: the title fits the width`);
    for (const id of ['badge', 'label1', 'label2', 'volume']) assert.ok(text[id].y >= text.title.y + text.title.height && text[id].y + text[id].height <= h, `${aspect}: ${id} under the title`);
    const drop = await renderSvg({ recipe: r, seed: 'm', mark: MARK, width: w, height: h });
    assert.equal(drop.match(/fill="#c8ff2e"/g).length, 2, `${aspect}: the cells, and the accent asterisk beside them`);
  }
});

test('mark geometry: real bounds and ink density', () => {
  const g = markGeometry('<path d="M96 96h320v320H96z"/>');
  assert.deepEqual(g.box, { x: 96, y: 96, width: 320, height: 320 });
  assert.ok(g.density > 0.95);
  assert.ok(markGeometry(RING).density < 0.4);
  assert.equal(markGeometry(''), null);
});

// ---------------------------------------------------------------------------
// 1.5: the layers construction and series-card stand on
// ---------------------------------------------------------------------------

const SQUARE = '<path d="M96 96h320v320H96z"/>';
const TRIANGLE = '<path d="M256 48 464 464H48z"/>';
/** A circle of radius 200 drawn as four cubics, as most marks draw their curves. */
const BEZIER_CIRCLE = (() => {
  const k = 200 * 0.5523;
  return `<path d="M256 56C${256 + k} 56 456 ${256 - k} 456 256C456 ${256 + k} ${256 + k} 456 256 456C${256 - k} 456 56 ${256 + k} 56 256C56 ${256 - k} ${256 - k} 56 256 56Z"/>`;
})();

/** The subpaths of path data, each as its box (from its coordinate pairs: lines and curves, not arcs). */
const ringBoxes = (d) => d.split('M').filter(Boolean).map((part) => {
  const pts = [...part.matchAll(/(-?[\d.]+)[ ,](-?[\d.]+)/g)].map((m) => [+m[1], +m[2]]);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
});
/** The box round several boxes. */
const union = (boxes) => {
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  return { x, y, width: Math.max(...boxes.map((b) => b.x + b.width)) - x, height: Math.max(...boxes.map((b) => b.y + b.height)) - y };
};
/** Whether two boxes overlap. */
const overlaps = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

test('isolines: a closed line where the field crosses the level, joined exactly', () => {
  const f = Array.from({ length: 81 }, (_, i) => Math.hypot((i % 9) - 4, Math.floor(i / 9) - 4));
  const lines = isolines(f, 9, 9, 2.5);
  assert.equal(lines.length, 1);
  const [ring] = lines;
  assert.deepEqual(ring[0], ring.at(-1), 'closed');
  for (const [x, y] of ring) assert.ok(Math.abs(Math.hypot(x - 4, y - 4) - 2.5) < 0.2, `${x},${y} on the circle`);
  assert.deepEqual(isolines(f, 9, 9, 99), [], 'nothing crosses');
});

test('outline: the outline and offsets a gap apart, the whole fitted in its box; solid with lines: 0; deterministic', async () => {
  const draw = (o) => renderSvg({ width: 400, height: 400, layers: [{ type: 'outline', markup: SQUARE, width: 400, height: 400, color: '#112233', ...o }] });
  const svg = await draw({ lines: 4, gap: 0.05 });
  assert.equal(svg, await draw({ lines: 4, gap: 0.05 }), 'deterministic');
  const rings = ringBoxes(svg.match(/<path d="([^"]+)" fill="none" stroke="#112233"/)[1]).sort((a, b) => a.width - b.width);
  assert.equal(rings.length, 4, 'the outline and three more');
  // The set is 320 + 2 × 3 × 16 = 416 mark units across, fitted to 400.
  const k = 400 / 416;
  rings.forEach((r, i) => {
    assert.ok(Math.abs(r.width - (320 + 2 * i * 16) * k) < 1.5, `line ${i}: ${r.width}`);
    assert.ok(Math.abs(r.x + r.width / 2 - 200) < 0.5 && Math.abs(r.y + r.height / 2 - 200) < 0.5, `line ${i} centred`);
  });
  const inward = ringBoxes((await draw({ lines: 3, direction: 'in' })).match(/<path d="([^"]+)" fill="none" stroke="#112233"/)[1]);
  assert.equal(inward.length, 3);
  assert.ok(inward.every((r) => r.width <= 400.5), 'inward lines stay in the outline');
  const solid = await draw({ lines: 0 });
  assert.match(solid, /<g fill="#112233"><path d="M0 0L400 0L400 400L0 400Z"\/><\/g>/, 'solid, fitted by its real bounds');
});

test('mark guides: circles from arcs and Béziers, lines from straight edges, not the box sides or corner rounds', () => {
  const [c] = markGuides(BEZIER_CIRCLE).circles;
  assert.ok(Math.abs(c.cx - 256) < 0.5 && Math.abs(c.cy - 256) < 0.5 && Math.abs(c.r - 200) < 1, JSON.stringify(c));
  assert.ok(c.sweep > 6.2, 'all of it');
  const ring = markGuides(RING).circles.map((x) => Math.round(x.r)).sort();
  assert.deepEqual(ring, [136, 160]);
  assert.ok(markGuides(MARK).circles.some((x) => Math.abs(x.r - 120) < 1 && Math.abs(x.cy - 262) < 1), 'the drop\'s round');
  const tri = markGuides(TRIANGLE);
  assert.equal(tri.circles.length, 0);
  assert.equal(tri.lines.length, 2, 'the two slanted sides; the base is the box');
  assert.ok(tri.lines.every((l) => Math.abs(Math.abs(Math.tan(l.angle)) - 416 / 208) < 0.01));
  assert.equal(markGuides('<rect x="96" y="96" width="320" height="320" rx="10"/>').circles.length, 0, 'corner rounds are left out');
  assert.equal(markGuides(SQUARE).inscribed, 160);
  assert.ok(Math.abs(markGuides(SQUARE).circumscribed - 160 * Math.SQRT2) < 0.5);
  assert.equal(markGuides(''), null);
});

// ---------------------------------------------------------------------------
// construction
// ---------------------------------------------------------------------------

test('construction: deterministic; the mark centred in the sheet over its guides, meta in the corners, at every aspect', async () => {
  const r = recipe('construction');
  for (const [aspect, [w, h]] of Object.entries({ ...SIZES, a4: [400, 566] })) {
    const o = { recipe: r, seed: 'c', mark: TRIANGLE, name: 'Kestrel', width: w, height: h };
    const { svg, text } = await rendered(o);
    assert.equal(svg, await renderSvg(o), `${aspect}: deterministic`);
    assert.doesNotMatch(svg, /NaN|undefined/);
    const field = { x: 16, y: 40, width: 368, height: h - 80 };
    // The mark: 58% of the field's shorter side, centred in it.
    const mark = union(ringBoxes(svg.match(/<g fill="#f2f1ec"><path d="([^"]+)"/)[1]));
    assert.ok(Math.abs(mark.width - 0.58 * Math.min(368, h - 80)) < 0.5, `${aspect}: mark ${mark.width}`);
    assert.ok(Math.abs(mark.x + mark.width / 2 - 200) < 0.5 && Math.abs(mark.y + mark.height / 2 - (40 + (h - 80) / 2)) < 0.5, `${aspect}: centred`);
    // Its circles, dashed in the accent, and the grid.
    assert.match(svg, /stroke="#3b82f6" stroke-width="[\d.]+" stroke-dasharray/);
    assert.match(svg, /<clipPath id="[^"]+"><rect x="16" y="40" width="368"/);
    for (const id of ['meta', 'name']) assert.ok(text[id].y + text[id].height <= field.y && text[id].y >= 0, `${aspect}: ${id} above the sheet`);
    for (const id of ['gridLabel', 'caption']) assert.ok(text[id].y >= field.y + field.height && text[id].y + text[id].height <= h, `${aspect}: ${id} below the sheet`);
    assert.ok(text.meta.x >= 15.4 && text.gridLabel.x >= 15.4, `${aspect}: left corners`);
    assert.ok(text.name.x + text.name.width <= 384.6 && text.caption.x + text.caption.width <= 384.6, `${aspect}: right corners`);
  }
});

test('construction: light and dark by ground and ink; the guides follow the mark', async () => {
  const r = recipe('construction');
  const light = await renderSvg({ recipe: r, seed: 'c', mark: TRIANGLE, width: 400, height: 500, ground: '#f3f2ee', ink: '#141414', accent: '#2563eb' });
  assert.match(light, /<rect width="400" height="500" fill="#f3f2ee"\/>/);
  assert.match(light, /<g fill="#141414"><path/);
  assert.match(light, /stroke="#2563eb"/);
  assert.doesNotMatch(light, /#3b82f6|#0b0b0c/);
  const other = await renderSvg({ recipe: r, seed: 'c', mark: RING, width: 400, height: 500 });
  const dashed = (svg) => svg.match(/<path fill="none" d="([^"]+)" stroke="#[0-9a-f]+" stroke-width="[\d.]+" stroke-dasharray="[^"]+"\/>/g);
  assert.notDeepEqual(dashed(light), dashed(other), 'each mark its own guides');
});

// ---------------------------------------------------------------------------
// fluted-poster
// ---------------------------------------------------------------------------

test('fluted-poster: the glass embedded as a raster, the type as vector outlines, deterministic', async () => {
  const r = recipe('fluted-poster');
  const o = { recipe: r, seed: 'f', mark: MARK, name: 'Kestrel', width: 400, height: 500 };
  const { svg, text } = await rendered(o);
  assert.equal(svg, await renderSvg(o), 'deterministic');
  assert.equal(svg.match(/<image /g).length, 1, 'one raster: the glass');
  assert.match(svg, /href="data:image\/png;base64,/);
  assert.doesNotMatch(svg, /<text/);
  for (const id of ['year', 'series', 'title', 'credits', 'edition']) assert.ok(text[id], `${id} drawn as type`);
  // The subject and the preset change the glass; an unknown preset is refused.
  const glass = (svg) => svg.match(/href="(data:image[^"]+)"/)[1];
  assert.notEqual(glass(await renderSvg({ ...o, subject: 'name' })), glass(svg), 'the name instead of the mark');
  assert.notEqual(glass(await renderSvg({ ...o, preset: 'reeded-deep' })), glass(svg), 'another preset');
  await assert.rejects(renderSvg({ ...o, preset: 'nope' }), /Unknown fluted preset/);
});

test('fluted-poster: Swiss corners at every aspect; the ornament beside the title in the accent, or the ink with none', async () => {
  const r = recipe('fluted-poster');
  for (const [aspect, [w, h]] of Object.entries(SIZES)) {
    const { svg, text } = await rendered({ recipe: r, seed: 'f', mark: MARK, width: w, height: h, title: ['Through', 'the glass'] });
    assert.ok(text.year.x >= 14 && text.year.y >= 0 && text.year.y + text.year.height <= 70, `${aspect}: year top-left`);
    assert.ok(text.series.x + text.series.width <= 384.6 && text.series.y + text.series.height <= 50, `${aspect}: series top-right`);
    assert.ok(text.title.x >= 14.4 && text.title.y + text.title.height <= h - 45.4, `${aspect}: title bottom-left`);
    assert.ok(text.credits.y >= text.title.y + text.title.height && text.credits.y + text.credits.height <= h, `${aspect}: credits under the title`);
    assert.ok(text.edition.x + text.edition.width <= 384.6 && text.edition.y + text.edition.height <= h, `${aspect}: edition bottom-right`);
    const bars = [...svg.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="5" height="([\d.]+)" fill="#ff4d1a"/g)].map((m) => ({ x: +m[1], y: +m[2], width: 5, height: +m[3] }));
    assert.equal(bars.length, 6, `${aspect}: two bars, cut in three`);
    const orn = union(bars);
    assert.ok(orn.x + orn.width <= 384.6 && orn.x >= text.title.x + text.title.width, `${aspect}: right of the title`);
    assert.ok(Math.abs(orn.y + orn.height - (h - 46)) < 0.01, `${aspect}: on the title's foot`);
  }
  const plain = await renderSvg({ recipe: r, seed: 'f', mark: MARK, width: 400, height: 500, accent: '' });
  assert.equal(plain.match(/width="5" height="[\d.]+" fill="#ffffff"/g).length, 6, 'no accent: the bars in the ink');
});

// ---------------------------------------------------------------------------
// series-card
// ---------------------------------------------------------------------------

test('series-card: title top-left, number bottom-left, the mark large in the space left, at every aspect', async () => {
  const r = recipe('series-card');
  for (const [aspect, [w, h]] of Object.entries(SIZES)) {
    const o = { recipe: r, seed: 's', mark: TRIANGLE, width: w, height: h };
    const { svg, text } = await rendered(o);
    assert.equal(svg, await renderSvg(o), `${aspect}: deterministic`);
    const mark = union(ringBoxes(svg.match(/<path d="([^"]+)" fill="none" stroke="#1c1b19"/)[1]));
    assert.ok(inside(mark, { x: 124, y: 84, width: 260, height: h - 100 }), `${aspect}: mark ${JSON.stringify(mark)} in its box`);
    assert.ok(mark.width > 200 || mark.height > 200, `${aspect}: large`);
    assert.ok(text.title.x >= 17.4 && text.title.y >= 19.4 && text.title.y + text.title.height <= 84, `${aspect}: title top-left`);
    assert.ok(text.number.x >= 13.4 && text.number.y + text.number.height <= h - 15.4, `${aspect}: number bottom-left`);
    for (const id of ['title', 'number']) assert.ok(!overlaps(text[id], mark), `${aspect}: ${id} clear of the mark`);
  }
});

test('series-card: solid or contour; ten cards differ only in their number and colour', async () => {
  const r = recipe('series-card');
  const strokes = async (o) => (await renderSvg({ recipe: r, seed: 's', mark: SQUARE, width: 400, height: 400, ...o })).match(/<path d="([^"]+)" fill="none" stroke/)?.[1];
  assert.equal(ringBoxes(await strokes({})).length, 4, 'four contour lines by default');
  assert.equal(ringBoxes(await strokes({ lines: 5 })).length, 5);
  const solid = await renderSvg({ recipe: r, seed: 's', mark: SQUARE, width: 400, height: 400, style: 'solid' });
  assert.match(solid, /<g fill="#1c1b19"><path d=/);
  assert.doesNotMatch(solid, /fill="none" stroke/);
  const palette = ['#f3c9b8', '#cfdcc4', '#d6cdea', '#f2e3b3', '#c9dde8', '#f0c4d4', '#dfe6c8', '#e8d5c4', '#c8d8d0', '#e6cfe0'];
  const cards = await Promise.all(palette.map((ground, i) => rendered({ recipe: r, seed: `card-${i}`, mark: MARK, width: 400, height: 400, ground, number: String(i + 1).padStart(2, '0') })));
  const markOf = (svg) => svg.match(/<path d="([^"]+)" fill="none" stroke/)[1];
  for (const [i, { svg, text }] of cards.entries()) {
    assert.match(svg, new RegExp(`<rect width="400" height="400" fill="${palette[i]}"/>`));
    assert.equal(markOf(svg), markOf(cards[0].svg), `card ${i + 1}: the same mark`);
    assert.deepEqual(text.title, cards[0].text.title, `card ${i + 1}: the same title`);
    assert.ok(text.number.x + text.number.width <= 124, `card ${i + 1}: number in its column`);
  }
});

test('fluted-poster: the name gets gentle glass by default (no doubling); a given preset, and the mark, keep theirs', async () => {
  const r = recipe('fluted-poster');
  const glassFx = (o) => cover({ recipe: r, seed: 'f', name: 'Halden', width: 400, height: 500, ...o }).layers.find((l) => l.id === 'glass').effects[0];
  const clean = (fx) => Object.fromEntries(Object.entries(fx).filter(([, v]) => v !== undefined && v !== null));
  assert.deepEqual(clean(glassFx({ subject: 'name', mark: MARK })), { kind: 'fluted', preset: 'fluted', profile: 'convex', ribs: 12, refraction: 0.15, stretch: '0.4vmin', chroma: 0.2 });
  assert.deepEqual(clean(glassFx({})), clean(glassFx({ subject: 'name' })), 'no mark: the name, gently');
  assert.deepEqual(clean(glassFx({ subject: 'name', preset: 'fluted' })), { kind: 'fluted', preset: 'fluted' }, 'a given preset as it is');
  assert.deepEqual(clean(glassFx({ subject: 'name', preset: 'reeded-prism' })), { kind: 'fluted', preset: 'reeded-prism' });
  assert.deepEqual(clean(glassFx({ mark: MARK })), { kind: 'fluted', preset: 'fluted' }, 'the mark: the fluted preset');
  const o = { recipe: r, seed: 'f', mark: MARK, width: 400, height: 500 };
  assert.equal(await renderSvg(o), await renderSvg({ ...o, preset: 'fluted' }), 'the mark\'s default is the fluted preset');
  assert.notEqual(await renderSvg({ ...o, subject: 'name' }), await renderSvg({ ...o, subject: 'name', preset: 'fluted' }), 'the name\'s default is gentler');
});
