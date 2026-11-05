import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { renderSvg, renderImage, defineRecipe, loadRecipe, MOTION_PRESETS } from '../src/index.js';
import { progress, motionList, easing } from '../src/animate/index.js';

const root = new URL('..', import.meta.url);
const MARK = '<path d="M256 48c-74 64-120 140-120 214a120 120 0 0 0 240 0c0-74-46-150-120-214z"/>';
/** Markup without embedded data URIs. */
const bare = (svg) => svg.replace(/data:[^"')]+/g, '');
/** A layer list without its motion. */
const still = (layers) => layers.map(({ motion, ...l }) => l);

const LAYERS = [
  { type: 'solid', color: '#111' },
  { type: 'shape', kind: 'circle', cx: 100, cy: 100, r: 40, fill: '#f0f', blend: 'screen', motion: { translate: ['5vw', '-4vw'], scale: 1.08, origin: [100, 100], duration: 4, easing: 'inOut', direction: 'alternate' } },
  { type: 'text', content: 'SPIN · SPIN · ', path: { kind: 'circle', cx: 300, cy: 200, r: 60, start: 270 }, fitPath: 4, size: 14, color: '#fff', motion: { preset: 'spin', origin: [300, 200], duration: 8 } },
  { type: 'shape', kind: 'rect', x: 20, y: 360, width: 8, height: 14, fill: '#fb0', motion: 'blink' },
  { type: 'text', content: 'OUT NOW · ARC · OUT NOW · ARC · OUT NOW · ARC · ', size: 20, color: '#dfff3a', path: { kind: 'wave', x1: -20, x2: 420, y: 300, amplitude: 5, wavelength: 200 }, startOffset: 0, align: 'left', motion: { preset: 'marquee', duration: 6 } },
  { type: 'text', content: 'LUMIO', weight: 700, size: 50, x: 200, y: 460, align: 'center', color: '#fff', motion: { vary: { letterSpacing: [-0.05, 0.2] }, duration: 2, easing: 'inOut', direction: 'alternate', frames: 4 } },
];
const COVER = { width: 400, height: 500, seed: 'motion', layers: LAYERS };

test('motion: the animated SVG is well formed, carries one named stylesheet, and stops for reduced motion', async () => {
  const svg = await renderSvg(COVER);
  assert.equal((svg.match(/<style>/g) ?? []).length, 1);
  assert.doesNotMatch(svg, /__cv__/, 'names given their prefix');
  const ns = /\.(cv[a-z0-9]+)\{transform-box:view-box;transform-origin:0 0\}/.exec(svg)?.[1];
  assert.ok(ns, 'prefixed');
  assert.match(svg, new RegExp(`@media \\(prefers-reduced-motion:reduce\\)\\{\\.${ns}\\{animation:none!important\\}\\}`));
  // Every class used has its rule, every animation its keyframes.
  for (const [, cls] of svg.matchAll(/class="[^" ]+ ([^"]+)"/g)) assert.match(svg, new RegExp(`\\.${cls}\\{animation:(${ns}k\\d+) `), cls);
  for (const [, k] of svg.matchAll(/\{animation:([a-z0-9]+k\d+) /g)) assert.match(svg, new RegExp(`@keyframes ${k}\\{`), k);
  assert.match(svg, /d:path\("M/, 'vary morphs outlines');
  assert.match(svg, /<use href="#cv[a-z0-9]+l4q0"/, 'marquee glyph copies');
  assert.match(svg, /<g style="mix-blend-mode:screen"><g class=/, 'blend outside the moving group');
  // librsvg parses it (and draws the still).
  const { info } = await sharp(Buffer.from(svg)).png().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 400);
  // Deterministic, and two covers never share names.
  assert.equal(await renderSvg(COVER), svg);
  const other = await renderSvg({ ...COVER, layers: [{ type: 'solid', color: '#222' }, ...LAYERS.slice(1)] });
  assert.notEqual(/\.(cv[a-z0-9]+)\{/.exec(other)[1], ns);
});

test('motion: animate: false (and every still) without a poster is the layers at rest, byte for byte', async () => {
  const rest = await renderSvg({ ...COVER, layers: still(LAYERS) });
  assert.equal(await renderSvg({ ...COVER, animate: false }), rest);
  assert.equal(await renderSvg({ ...COVER, layers: still(LAYERS) }), rest, 'no motion, no stylesheet');
  const png = (o) => renderImage(o, { format: 'png' });
  assert.deepEqual(await png(COVER), await png({ ...COVER, layers: still(LAYERS) }));
});

test('motion: a poster or t draws that frame, in renderImage too, matching the playing SVG\'s still', async () => {
  const at = await renderSvg(COVER, { t: 1.5 });
  assert.equal(await renderSvg({ ...COVER, animate: false, poster: 1.5 }), at);
  assert.notEqual(at, await renderSvg({ ...COVER, animate: false }));
  assert.match(at, /<g style="mix-blend-mode:screen"><g transform="translate\(/);
  assert.doesNotMatch(at, /<style>|class=/);
  // The live SVG's attributes are the poster frame (transforms only: the same groups, plus classes).
  const moving = { width: 200, height: 200, seed: 'm', layers: [LAYERS[0], LAYERS[1]], poster: 1.5 };
  const live = await renderSvg(moving);
  assert.equal(live.replace(/<style>.*<\/style>/, '').replace(/ class="[^"]*"/g, '').replace(/<defs><\/defs>/, ''), await renderSvg(moving, { t: 1.5 }));
  const a = await renderImage({ ...COVER, poster: 1.5 }, { format: 'png' });
  const b = await renderImage({ ...COVER }, { format: 'png' });
  assert.notDeepEqual(a, b);
});

test('motion: timing follows CSS (delay, direction, iterations, fill both) and presets fill in defaults', () => {
  const [m] = motionList({ rotate: 90, duration: 2, delay: 1, direction: 'alternate', iterations: 3 });
  assert.equal(progress(m, 0), 0, 'before its delay: the start');
  assert.equal(progress(m, 2), 0.5);
  assert.equal(progress(m, 3.5), 0.75, 'second iteration runs back');
  assert.equal(progress(m, 99), 1, 'after the last: the end (third runs forward)');
  const [r] = motionList({ rotate: 90, direction: 'reverse', duration: 4 });
  assert.equal(progress(r, 1), 0.75);
  assert.equal(motionList('spin')[0].duration, MOTION_PRESETS.spin.duration);
  assert.equal(motionList({ preset: 'blink', duration: 1.1 })[0].duration, 1.1);
  assert.equal(easing('step')(0.99), 0);
  assert.ok(Math.abs(easing('inOut')(0.5) - 0.5) < 1e-6);
  assert.throws(() => motionList({ preset: 'wobble' }), /Unknown motion preset "wobble"/);
  assert.throws(() => motionList({ direction: 'sideways' }), /unknown direction/);
  assert.throws(() => motionList({ duration: 0 }), /positive/);
});

test('motion: JSON recipes check motion options, and marquee and vary refuse what they can\'t play', async () => {
  assert.throws(() => defineRecipe({ name: 'n', layers: [{ type: 'solid', motion: { rotat: 3 } }] }), /layers\[0\]\.motion\.rotat: motions have no option "rotat"/);
  assert.throws(() => defineRecipe({ name: 'n', layers: [{ type: 'solid', motion: ['spin', 'wobble'] }] }), /motion\[1\]: unknown motion preset "wobble"/);
  await assert.rejects(renderSvg({ width: 300, layers: [{ type: 'text', content: 'ONCE ONLY', path: { kind: 'wave' }, motion: 'marquee' }] }), /repeated along the path/);
  await assert.rejects(renderSvg({ width: 300, layers: [{ type: 'text', content: 'A', x: 10, y: 50, motion: { vary: { color: ['#f00', '#00f'] } } }] }), /changes more than its outlines/);
});

test('motion: the motion flyers validate, play, and stand still as their at-rest recipes', async () => {
  const files = (await readdir(new URL('recipes/flyers/', root))).filter((f) => f.endsWith('-motion.json'));
  assert.equal(files.length, 8);
  for (const f of files) {
    const name = f.slice(0, -5);
    const recipe = loadRecipe(new URL(`recipes/flyers/${f}`, root));
    // (arcfield-mirror-motion separates its words with ✶: the fonts here have no ✱.)
    const rest = defineRecipe(JSON.parse((await readFile(new URL(`recipes/flyers/${name.replace(/-motion$/, '')}.json`, root), 'utf8')).replaceAll('✱', '✶')));
    for (const format of ['flyer', 'release']) {
      const o = { seed: name, format, width: 400, mark: MARK, photo: new URL('examples/photo.jpg', root).pathname, cutout: new URL('examples/photo.jpg', root).pathname };
      const live = await renderSvg({ ...o, recipe });
      // (lumio-stack breathes on Anybody's wdth axis; with the fallback face here its frames are all one.)
      if (name !== 'lumio-stack-motion') assert.match(live, /@keyframes/, `${name} ${format} plays`);
      assert.doesNotMatch(bare(live), /NaN|undefined/, name);
      assert.equal(await renderSvg({ ...o, recipe, animate: false }), await renderSvg({ ...o, recipe: rest }), `${name} ${format} at rest`);
    }
  }
});
