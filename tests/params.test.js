import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { defineRecipe, loadRecipe, describeParams, paramLabel, PARAM_TYPES } from '../src/index.js';

const root = new URL('..', import.meta.url);
const flyer = (name) => loadRecipe(new URL(`recipes/flyers/${name}.json`, root));
const byName = (specs) => Object.fromEntries(specs.map((s) => [s.name, s]));

const DOC = {
  name: 'params-demo',
  params: {
    headline: [{ content: 'Big', bold: true }, 'small'],
    lines: ['one', 'two'],
    rows: [['a', 'b'], ['c', { content: 'd', weight: 700 }]],
    coords: '51.5° N\n0.1° W',
    tagline: 'Hello',
    wash: '#ff5a1f',
    markColor: '',
    cells: 11,
    drop: 0.12,
    pixel: false,
    focus: [0.5, 0.3],
    side: 'left',
  },
  controls: {
    markColor: { type: 'color', label: 'Mark colour' },
    cells: { min: 4, max: 24 },
    side: { enum: ['left', 'right'], help: 'Which side.' },
    focus: { hidden: true },
  },
  requires: ['mark'],
  layers: [
    { type: 'solid', color: '{wash}' },
    { type: 'image', when: 'photo', src: '{photo}', fit: 'cover' },
    { type: 'icon', when: 'mark', markup: '{mark}', size: 100, color: { if: 'markColor', then: '{markColor}', else: '#000' } },
    { type: 'text', content: '{headline}', when: { side: 'left' } },
    { type: 'text', content: 'Tag: {tagline} {coords} {lines} {rows} {drop} {cells} {pixel} {focus}' },
  ],
};

test('describeParams reads each type from its default', () => {
  const p = byName(describeParams(defineRecipe(DOC)));
  assert.equal(p.headline.type, 'rich-lines');
  assert.equal(p.lines.type, 'lines');
  assert.equal(p.rows.type, 'table');
  assert.equal(p.coords.type, 'multiline');
  assert.equal(p.tagline.type, 'text');
  assert.equal(p.wash.type, 'color');
  assert.equal(p.pixel.type, 'boolean');
  assert.deepEqual([p.drop.type, p.drop.min, p.drop.max, p.drop.step], ['number', 0, 1, 0.01]);
  assert.equal(p.tagline.label, 'Tagline');
  assert.equal(p.tagline.default, 'Hello');
});

test('the layers say what an undeclared option is: an image src, a mark', () => {
  const specs = describeParams(defineRecipe(DOC));
  const p = byName(specs);
  assert.equal(p.photo.type, 'image');
  assert.equal(p.photo.optional, true);
  assert.equal(p.mark.type, 'mark');
  assert.equal(p.mark.required, true);
  // declared params first, in order; then the content options the layers read
  assert.deepEqual(specs.map((s) => s.name).slice(0, 3), ['headline', 'lines', 'rows']);
  assert.ok(specs.findIndex((s) => s.name === 'photo') > specs.findIndex((s) => s.name === 'side'));
});

test('controls refine a param: a colour for an empty default, a range, an enum, hidden', () => {
  const p = byName(describeParams(DOC));
  assert.deepEqual([p.markColor.type, p.markColor.label, p.markColor.optional], ['color', 'Mark colour', true]);
  assert.deepEqual([p.cells.min, p.cells.max, p.cells.step], [4, 24, 1]);
  assert.deepEqual([p.side.type, p.side.enum, p.side.help], ['enum', ['left', 'right'], 'Which side.']);
  assert.equal(p.focus, undefined);
});

test('a number with no range gets about three times its default', () => {
  const p = byName(describeParams({ params: { n: 20, z: 0, f: 1.5 }, layers: [{ type: 'text', content: '{n}{z}{f}' }] }));
  assert.deepEqual([p.n.min, p.n.max, p.n.step], [0, 60, 1]);
  assert.deepEqual([p.z.min, p.z.max], [0, 10]);
  assert.deepEqual([p.f.max, p.f.step], [5, 0.01]);
});

test('paramLabel splits names into words', () => {
  assert.equal(paramLabel('markColor'), 'Mark color');
  assert.equal(paramLabel('fade_end'), 'Fade end');
  assert.equal(paramLabel('gridLabel'), 'Grid label');
});

test('bad controls fail validation with the path', () => {
  const bad = (controls) => () => defineRecipe({ name: 'bad', params: { a: 1 }, controls, layers: [{ type: 'text', content: '{a}' }] });
  assert.throws(bad({ b: {} }), /controls\.b: unknown param "b"/);
  assert.throws(bad({ a: { kind: 'x' } }), /controls\.a\.kind: unknown key/);
  assert.throws(bad({ a: { type: 'slider' } }), /controls\.a\.type: unknown type "slider"/);
  assert.throws(bad({ a: { enum: [] } }), /controls\.a\.enum/);
  assert.throws(bad({ a: { min: '0' } }), /controls\.a\.min: must be a number/);
  assert.throws(bad([]), /controls: must be an object/);
  assert.doesNotThrow(bad({ a: { min: 0, max: 4, step: 1, label: 'A', help: 'h', hidden: false } }));
});

test('describeParams wants a JSON recipe', () => {
  assert.throws(() => describeParams(() => []), /JSON recipe/);
});

test('every flyer describes cleanly: known types, unique names, enum defaults among their choices', () => {
  const files = readdirSync(new URL('recipes/flyers/', root)).filter((f) => f.endsWith('.json'));
  for (const f of files) {
    const specs = describeParams(flyer(f.replace(/\.json$/, '')));
    assert.equal(new Set(specs.map((s) => s.name)).size, specs.length, f);
    for (const s of specs) {
      assert.ok(PARAM_TYPES.includes(s.type), `${f}: ${s.name} ${s.type}`);
      if (s.type === 'enum') assert.ok(s.optional || s.enum.includes(s.default), `${f}: ${s.name} default ${s.default} not in ${s.enum}`);
      if (s.type === 'number' && typeof s.default === 'number') assert.ok(s.default >= s.min && s.default <= s.max, `${f}: ${s.name} ${s.default} outside [${s.min}, ${s.max}]`);
    }
  }
});

test('the Swiss-grid posters describe what an editor needs', () => {
  const p = (name) => byName(describeParams(flyer(name)));
  assert.equal(p('grid-poster').headline.type, 'rich-lines');
  assert.equal(p('grid-poster').markColor.type, 'color');
  assert.equal(p('grid-poster').photo.type, 'image');
  assert.equal(p('logofolio').marks.type, 'marks');
  assert.deepEqual(p('fluted-poster').subject.enum, ['mark', 'name', 'word']);
  assert.equal(p('fluted-poster').preset.optional, true);
  assert.deepEqual(p('dissolve-poster').direction.enum, ['up', 'down', 'left', 'right', 'radial']);
  assert.equal(p('dissolve-poster').cutout.type, 'image');
  assert.equal(p('dissolve-poster').focus, undefined);
  assert.deepEqual([p('pixel-mosaic').cells.min, p('pixel-mosaic').cells.max], [5, 24]);
  assert.equal(p('terminal-poster').font.type, 'font');
  assert.equal(p('construction').mark.required, true);
});
