import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderSvg, loadRecipe, defineRecipe, cover } from '../src/index.js';
import { renderReport } from '../src/render.js';
import { lineSpans } from '../src/type/spans.js';
import { sheetGrid } from '../src/layers/marks.js';
import { markGeometry } from '../src/layers/mark-geometry.js';
import { SYMBOLS } from '../src/type/symbols.js';

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
