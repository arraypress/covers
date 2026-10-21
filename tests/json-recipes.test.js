import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import Ajv from 'ajv/dist/2020.js';
import { cover, renderSvg, defineRecipe, loadRecipe, recipes, resolvePalette, mixOklab } from '../src/index.js';
import { jsRecipes } from './fixtures/js-recipes.js';
import { schemaText } from '../scripts/schema.mjs';

const photo = await sharp({ create: { width: 64, height: 40, channels: 3, background: '#3366cc' } }).png().toBuffer();
const root = new URL('..', import.meta.url);

/** Resolve a one-layer recipe and return that layer. */
function one(layer, options = {}, extra = {}) {
  const c = cover({ seed: 's', palette: 'dusk', ...options, recipe: { name: 't', ...extra, layers: [layer] } });
  return c.layers[0];
}

// ---------------------------------------------------------------------------
// Parity: the JSON built-ins draw exactly what the original JS recipes drew
// ---------------------------------------------------------------------------

test('JSON built-ins render byte-identical SVG to the JS recipes', async () => {
  const optionSets = [
    {},
    { title: 'Hello there world, a title that wraps' },
    { title: 'T', label: 'L', icon: 'lucide:feather' },
    { title: { content: 'Object title', size: 40 }, label: { content: 'Lab', color: '#ff0000' }, side: 'left', mesh: { blur: 30 }, grain: false },
  ];
  let count = 0;
  for (const [name, js] of Object.entries(jsRecipes)) {
    for (const palette of ['paper', 'dusk', { accent: '#2563eb' }]) {
      for (const aspect of ['1:1', '16:9', 'og']) {
        for (const opts of optionSets) {
          const o = { seed: `p-${name}-${aspect}`, palette, aspect, width: 600, image: photo, ...opts };
          assert.equal(await renderSvg({ ...o, recipe: name }), await renderSvg({ ...o, recipe: js }), `${name} ${aspect} ${JSON.stringify(opts)}`);
          count++;
        }
      }
    }
  }
  assert.equal(count, 6 * 3 * 3 * 4);
});

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

test('palette and canvas tokens', () => {
  const p = resolvePalette('dusk');
  const l = one({ type: 'shapes', items: [{ color: '@accent' }, { color: '@colors.1' }, { color: '@colors.9' }, { color: '@onAccent' }], count: '@u' }, { width: 400, height: 100 });
  assert.deepEqual(l.items.map((i) => i.color), [p.accent, p.colors[1], p.colors[9 % p.colors.length], p.onAccent]);
  assert.equal(l.count, 200);
  assert.deepEqual(one({ type: 'stripes', colors: '@colors' }).colors, [...p.colors]);
  assert.equal(one({ type: 'text', content: '@@handle' }).content, '@handle');
});

test('templates: whole tokens keep their type, partial ones interpolate', () => {
  const l = one(
    { type: 'text', content: 'Read: {title} ({opt.extra})', label: '{label}', size: '{big}' },
    { title: 'Hi', label: { content: 'L', color: '#ff0000' }, extra: 7, big: 99 },
    { params: { big: 10 } },
  );
  assert.equal(l.content, 'Read: Hi (7)');
  assert.deepEqual(l.label, { content: 'L', color: '#ff0000' });
  assert.equal(l.size, 99, 'a cover option overrides the param default');
  assert.equal(one({ type: 'text', content: 'x', size: '{big}' }, {}, { params: { big: 10 } }).size, 10);
  assert.equal(one({ type: 'text', content: '{title}' }).content, undefined, 'unset options drop the key');
});

test('vars, paths and operators', () => {
  const l = one(
    {
      type: 'shapes',
      colors: [{ mix: ['#000000', '#ffffff', 0.5] }, { readable: '#ffe14d' }, { readable: '#101010' }, '$c.1'],
      items: { ramp: ['#000000', '#ffffff', 4, 1] },
      size: [{ add: ['10vw', 5] }, { sub: [100, '10vw'] }],
      count: { mul: [2, { div: [9, 3] }] },
      radius: { min: [3, 1, 2] },
      outline: { max: [3, 1, 2] },
      region: { reverse: '$c' },
      rotate: { taper: [0.5, 3] },
    },
    { width: 1000, height: 500 },
    { vars: { c: ['a', 'b', 'c'] } },
  );
  assert.equal(l.colors[1], '#111111');
  const vivid = one({ type: 'solid', color: { mix: ['#c9502a', '#a9bdf2', 0.5, 'oklch'] } }).color;
  const muddy = one({ type: 'solid', color: { mix: ['#c9502a', '#a9bdf2', 0.5] } }).color;
  assert.notEqual(vivid, muddy);
  const chroma = (hex) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)); return Math.max(r, g, b) - Math.min(r, g, b); };
  assert.ok(chroma(vivid) > chroma(muddy), 'OKLCH keeps the mix vivid');
  assert.equal(l.colors[2], '#ffffff');
  assert.equal(l.colors[3], 'b');
  assert.equal(l.items.length, 4);
  assert.equal(l.items[0], '#000000');
  assert.deepEqual(l.size, [105, 0]);
  assert.equal(l.count, 6);
  assert.equal(l.radius, 1);
  assert.equal(l.outline, 3);
  assert.deepEqual(l.region, ['c', 'b', 'a']);
  assert.deepEqual(l.rotate, [1, 0.5, 0.25]);
});

// ---------------------------------------------------------------------------
// Conditions and params
// ---------------------------------------------------------------------------

test('when: set, equals, not, all, any, mode', () => {
  const doc = {
    name: 'w',
    params: { background: 'solid' },
    layers: [
      { id: 'a', type: 'solid', when: 'title' },
      { id: 'b', type: 'solid', when: { not: 'title' } },
      { id: 'c', type: 'solid', when: { background: 'gradient' } },
      { id: 'd', type: 'solid', when: { mode: 'dark' } },
      { id: 'e', type: 'solid', when: { all: ['title', { background: ['solid', 'x'] }] } },
      { id: 'f', type: 'solid', when: { any: ['label', { mode: 'light' }] } },
    ],
  };
  const ids = (o) => cover({ seed: 's', recipe: doc, ...o }).layers.map((l) => l.id).join('');
  assert.equal(ids({ palette: 'dusk' }), 'bd');
  assert.equal(ids({ palette: 'paper', title: 'T' }), 'aef');
  assert.equal(ids({ palette: 'dusk', title: 'T', background: 'gradient' }), 'acd');
  assert.equal(ids({ palette: 'dusk', title: { size: 3 } }), 'bd', 'an override object without content is not "set"');
});

test('if: only the chosen side is evaluated (and drawn from)', () => {
  const doc = (cond) => ({ name: 'i', layers: [{ type: 'radial', x: { if: cond, then: { range: [0, 1] }, else: 0.5 }, y: { range: [0, 1] } }] });
  const a = cover({ seed: 's', recipe: doc(false) }).layers[0];
  const b = cover({ seed: 's', recipe: doc(true) }).layers[0];
  assert.equal(a.x, 0.5);
  assert.notEqual(a.y, b.y, 'the untaken branch consumed no draw');
});

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------

test('pick / range / int are seeded, and each layer draws from its own stream', () => {
  const layer = { id: 'x', type: 'radial', x: { range: [0, 1] }, y: { pick: [0.1, 0.2, 0.3, 0.4, 0.5] }, radius: { int: [10, 1000] } };
  const r1 = cover({ seed: 'a', recipe: { layers: [layer] } }).layers[0];
  const r2 = cover({ seed: 'a', recipe: { layers: [layer] } }).layers[0];
  const r3 = cover({ seed: 'b', recipe: { layers: [layer] } }).layers[0];
  assert.deepEqual(r1, r2);
  assert.notDeepEqual(r1, r3);
  assert.ok(r1.x >= 0 && r1.x < 1 && Number.isInteger(r1.radius));
  const withMore = cover({ seed: 'a', recipe: { layers: [{ id: 'first', type: 'radial', x: { range: [0, 1] } }, layer] } }).layers[1];
  assert.deepEqual(withMore, r1, 'adding a layer before it changed nothing');
});

test('vars draw from the recipe stream in order', () => {
  const doc = { vars: { a: { range: [0, 1] }, b: { range: [0, 1] } }, layers: [{ type: 'radial', x: '$a', y: '$b' }] };
  const l = cover({ seed: 'v', recipe: doc }).layers[0];
  assert.notEqual(l.x, l.y);
  assert.deepEqual(cover({ seed: 'v', recipe: doc }).layers[0], l);
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

test('validation errors name the recipe, the path and the fix', () => {
  const bad = (doc, re) => assert.throws(() => defineRecipe({ name: 'bad', ...doc }), re);
  bad({ layers: [] }, /Recipe "bad": layers: must be a non-empty array/);
  bad({ layers: [{ type: 'blob' }] }, /layers\[0\]\.type: unknown layer type "blob" \(solid, linear/);
  bad({ layers: [{ type: 'solid', color: '@bgg' }] }, /layers\[0\]\.color: unknown token "@bgg"/);
  bad({ layers: [{ type: 'solid', color: '@colors.x' }] }, /unknown token "@colors\.x"/);
  bad({ layers: [{ type: 'solid', color: '$nope' }] }, /unknown var "\$nope"/);
  bad({ layers: [{ type: 'text', content: '{subtitle}' }] }, /unknown param "subtitle" \(declare it in "params", or use "\{opt\.subtitle\}"/);
  bad({ layers: [{ id: 'm', type: 'mesh', blurr: 3 }] }, /layers\[0\] \(m\)\.blurr: "mesh" layers have no option "blurr"/);
  bad({ layers: [{ type: 'solid', color: { mix: ['#000', '#fff'] } }] }, /\.mix: takes 3–4 arguments, got 2/);
  bad({ layers: [{ type: 'solid', color: { if: 'title' } }] }, /"if" needs a "then"/);
  bad({ layers: [{ type: 'solid', color: { mix: ['#000', '#fff', 0.5, 'hsl'] } }] }, /\.mix: the space is "oklab" or "oklch"/);
  bad({ layers: [{ type: 'solid', when: 'subtitle' }] }, /when: unknown param "subtitle"/);
  bad({ layers: [{ type: 'solid' }], extra: 1 }, /extra: unknown key/);
  bad({ vars: { a: '$b', b: 1 }, layers: [{ type: 'solid' }] }, /vars\.a: unknown var "\$b" \(declare it in "vars" first\)/);
  assert.throws(() => cover({ recipe: 'duotone' }), /Recipe "duotone" needs the "image" option/);
});

test('the JSON Schema matches its generator and validates every bundled recipe', async () => {
  const text = await readFile(new URL('schema/recipe.schema.json', root), 'utf8');
  assert.equal(text, schemaText(), 'run npm run schema');
  const validate = new Ajv({ allErrors: true, strict: false }).compile(JSON.parse(text));
  const files = (await readdir(new URL('recipes/', root))).filter((f) => f.endsWith('.json'));
  assert.deepEqual(files.map((f) => f.replace('.json', '')).sort(), Object.keys(recipes).sort());
  for (const f of files) {
    const doc = JSON.parse(await readFile(new URL(`recipes/${f}`, root), 'utf8'));
    assert.ok(validate(doc), `${f}: ${JSON.stringify(validate.errors)}`);
    assert.equal(doc.$schema, '../schema/recipe.schema.json');
  }
  assert.equal(validate({ layers: [{ type: 'mesh', blurr: 3 }] }), false, 'unknown options are flagged in editors too');
  assert.equal(validate({ layers: [{ type: 'blob' }] }), false);
});

// ---------------------------------------------------------------------------
// Loading and using
// ---------------------------------------------------------------------------

test('loadRecipe reads a file; cover() takes the JSON directly', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'covers-recipe-'));
  try {
    const doc = { params: { tone: 'accent' }, layers: [{ type: 'solid', color: '@accent' }, { id: 'title', type: 'text', when: 'title', content: '{title}' }] };
    await writeFile(join(dir, 'house.json'), JSON.stringify(doc));
    const house = loadRecipe(join(dir, 'house.json'));
    assert.equal(house.recipeName, 'house');
    const a = await renderSvg({ recipe: house, seed: 'x', title: 'Hi' });
    assert.equal(a, await renderSvg({ recipe: doc, seed: 'x', title: 'Hi' }));
    assert.equal(defineRecipe(doc), defineRecipe(doc), 'defined once per object');
    await writeFile(join(dir, 'broken.json'), '{ nope');
    assert.throws(() => loadRecipe(join(dir, 'broken.json')), /Couldn't read recipe .*broken\.json/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// mark
// ---------------------------------------------------------------------------

test('mark: one centred icon, white on a dark accent, near-black on a light one', async () => {
  const dark = cover({ recipe: 'mark', seed: 'm', palette: { accent: '#2563eb' }, icon: 'lucide:feather' });
  assert.deepEqual(dark.layers.map((l) => `${l.id}:${l.type}`), ['bg:solid', 'icon:icon', 'grain:grain']);
  assert.equal(dark.layers[0].color, '#2563eb');
  assert.equal(dark.layers[1].color, '#ffffff');
  assert.equal(dark.layers[1].size, '24vmin');
  assert.equal(dark.layers[2].amount, 0.03);
  const light = cover({ recipe: 'mark', seed: 'm', palette: { accent: '#ffe14d' } });
  assert.equal(light.layers[1].color, '#111111');
  assert.ok(light.layers[1].path, 'the spark by default');
  assert.match(await renderSvg(light), /color="#111111"/);
});

test('mark: gradient background, overrides, raw SVG icons and an optional title', async () => {
  const g = cover({ recipe: 'mark', seed: 'm', palette: 'dusk', background: 'gradient', angle: 90, grain: false, title: 'Hello' });
  assert.deepEqual(g.layers.map((l) => l.type), ['linear', 'icon', 'text']);
  assert.equal(g.layers[0].angle, 90);
  assert.equal(g.layers[0].colors[0], resolvePalette('dusk').accent);
  assert.equal(g.layers[2].color, g.layers[1].color);
  const custom = cover({ recipe: 'mark', seed: 'm', background: 'gradient', colors: ['#000000', '#222222'] });
  assert.deepEqual(custom.layers[0].colors, ['#000000', '#222222']);
  assert.equal(custom.layers[1].color, '#ffffff');
  const svg = await renderSvg({ recipe: 'mark', seed: 'm', icon: '<svg viewBox="0 0 10 10"><rect width="10" height="10" fill="currentColor"/></svg>' });
  assert.match(svg, /<rect width="10" height="10" fill="currentColor"\/>/);
  assert.match(await renderSvg({ recipe: 'mark', seed: 'm', icon: 'simple-icons:github', aspect: '16:9' }), /viewBox="0 0 24 24"/);
});

test('mark: white whenever it clears 3:1 (WCAG 1.4.11) under the whole icon', () => {
  const icon = (o) => cover({ recipe: 'mark', seed: 'm', ...o }).layers.find((l) => l.type === 'icon').color;
  // paper's orange → pink gradient: a text rule (4.5:1 at the midpoint) chose black; 3:1 keeps white.
  assert.equal(icon({ palette: 'paper', background: 'gradient' }), '#ffffff');
  assert.equal(icon({ palette: 'paper' }), '#ffffff');
  assert.equal(icon({ palette: { accent: '#ffe14d' }, background: 'gradient' }), '#111111');
  // One light stop under the icon is enough to fall back to near-black.
  assert.equal(icon({ background: 'gradient', colors: ['#1d4ed8', '#fef08a'] }), '#111111');
  assert.equal(icon({ background: 'gradient', colors: ['#1d4ed8', '#7c3aed'] }), '#ffffff');
  assert.equal(icon({ palette: { accent: '#ffe14d' }, iconColor: 'white' }), '#ffffff');
  assert.equal(icon({ palette: { accent: '#2563eb' }, iconColor: 'black' }), '#111111');
  assert.equal(icon({ iconColor: '#ff0000' }), '#ff0000');
});

test('readable with a ratio and gradientUnder', () => {
  const l = one({
    type: 'shapes',
    colors: [
      { readable: ['#e0533d', 3, 'white'] },
      { readable: ['#e0533d', 4.5, 'white'] },
      { readable: [['#000000', '#ffff00'], 3, 'white'] },
      { readable: ['#777777', 3, 'black'] },
    ],
    items: { gradientUnder: [['#000000', '#ffffff'], 90, '10vmin'] },
  }, { width: 1000, height: 1000 });
  assert.deepEqual(l.colors, ['#ffffff', '#111111', '#111111', '#111111']);
  assert.equal(l.items.length, 5);
  assert.equal(l.items[2], mixOklab('#000000', '#ffffff', 0.5), 'the middle sample is the gradient midpoint');
  assert.ok(l.items[0] < l.items[2] && l.items[2] < l.items[4], 'samples run along the gradient');
});

test('mark: the title is held to 4.5:1 even where the icon gets 3:1', () => {
  const c = cover({ recipe: 'mark', seed: 'm', background: 'gradient', colors: ['#e0533d', '#e0533d'], title: 'Hello', label: 'L' });
  assert.equal(c.layers.find((l) => l.type === 'icon').color, '#ffffff', 'white icon at 3.8:1');
  const title = c.layers.find((l) => l.type === 'text');
  assert.equal(title.color, '#111111', 'white text would fail 4.5:1');
  assert.equal(title.label.color, '#111111');
});
