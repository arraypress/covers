/**
 * Render every recipe × its example seeds × palettes (light and dark, or the
 * example's own) × 2 aspects to
 * `examples/out/`, with an `index.html` grid to eyeball them and one PNG
 * contact sheet per recipe.
 *
 *   node examples/gallery.mjs [sheetDir]
 *
 * `sheetDir` (default `examples/out/sheets`) is where the contact sheets go.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import sharp from 'sharp';
import { renderImage, recipes } from '../src/index.js';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = join(here, 'out');
const sheets = process.argv[2] ?? join(out, 'sheets');
await mkdir(out, { recursive: true });
await mkdir(sheets, { recursive: true });

const photo = join(here, 'photo.jpg');
const seeds = [
  { seed: 'shipping-covers', title: 'Introducing covers: editorial images from a single seed', label: 'Product', icon: 'lucide:feather' },
  { seed: 'field-notes-14', title: 'Field notes on building quieter software', label: 'Essay', icon: 'lucide:compass' },
  { seed: 'state-of-the-stack-2026', title: 'The state of the stack, 2026', label: 'Research', icon: 'lucide:sparkles' },
];
// `mark` shows off icons and both backgrounds instead of headlines.
const markSeeds = [
  { seed: 'mark-feather', icon: 'lucide:feather' },
  { seed: 'mark-music', icon: 'lucide:music', background: 'gradient' },
  { seed: 'mark-github', icon: 'simple-icons:github', title: 'Open source, in the open', label: 'Engineering' },
  { seed: 'mark-compass', icon: 'lucide:compass', background: 'gradient' },
  { seed: 'mark-sparkles', icon: 'lucide:sparkles' },
];
// The OpenAI-style fields carry no title by default (the page sets it under the card).
const fieldSeeds = [
  { seed: 'field-notes-14' },
  { seed: 'shipping-covers' },
  { seed: 'state-of-the-stack-2026', title: 'The state of the stack, 2026', label: 'Research' },
];
// Diagrams and cut paper bring their own palettes.
const diagramSeeds = [
  { seed: 'storage', palette: 'dusk', layout: 'hub', nodes: [{ icon: 'lucide:globe' }, { icon: 'lucide:database' }, { icon: 'lucide:database' }, { icon: 'lucide:database' }] },
  { seed: 'pipeline', palette: 'ocean', nodes: [{ icon: 'lucide:send' }, { icon: 'lucide:settings' }, { icon: 'lucide:cpu' }], arrows: 'loop' },
  { seed: 'voice', palette: 'ink', layout: 'triangle', nodes: [{ icon: 'lucide:audio-lines' }, { icon: 'lucide:user' }, { icon: 'lucide:sparkles' }], arrows: 'both' },
  { seed: 'agents', palette: 'dawn', layout: 'square', nodes: [{ icon: 'lucide:pencil' }, { icon: 'lucide:shapes' }, { icon: 'lucide:chart-line' }, { icon: 'lucide:wrench' }, { icon: 'lucide:terminal', shape: 'square' }] },
  { seed: 'core-dump', palette: 'moss', layout: 'stack', nodes: [{ icon: 'lucide:list' }, { icon: 'lucide:cpu' }, { icon: 'lucide:triangle-alert' }] },
  { seed: 'writing', palette: 'ember', icon: 'lucide:feather' },
];
const page = '#1f1e1d';
const cutoutSeeds = [
  { seed: 'graph', name: 'lavender', palette: { accent: '#8b80c9', bg: page }, graph: true },
  { seed: 'cursor', name: 'clay', palette: { accent: '#b5694f', bg: page }, panel: true, icon: 'lucide:mouse-pointer-2' },
  { seed: 'leaf', name: 'sage', palette: { accent: '#8a9a7b', bg: page }, icon: 'lucide:leaf', shapes: 0 },
  { seed: 'compass', name: 'ochre', palette: { accent: '#c4a052', bg: page }, icon: 'lucide:compass' },
  { seed: 'chat', name: 'slate', palette: { accent: '#5f6f7f', bg: page }, panel: true, icon: 'lucide:message-circle' },
  { seed: 'paper-graph', palette: 'paper', graph: true, shapes: 4 },
  { seed: 'dusk-pen', palette: 'dusk', icon: 'lucide:pen-tool' },
];
const lasers = join(here, 'photo-lasers.jpg');
const studio = join(here, 'photo-studio.jpg');
const risoSeeds = [
  { seed: 'zine-1', palette: 'paper' },
  { seed: 'zine-2', palette: 'dusk' },
  { seed: 'pink-blue', palette: 'paper', inks: ['riso:pink', 'riso:blue'], name: 'pink + blue' },
  { seed: 'yellow-teal', palette: 'paper', inks: ['riso:yellow', 'riso:teal'], texture: 'halftone', name: 'yellow + teal, halftone' },
  { seed: 'red-navy', palette: 'paper', inks: ['riso:red', 'riso:navy', 'riso:yellow'], third: true, name: 'red + navy + yellow' },
  { seed: 'print-room', palette: 'ocean', title: 'Notes from the print room', label: 'Zine' },
];
const ditherSeeds = [
  { seed: 'sphere', palette: 'paper' },
  { seed: 'night', palette: 'dusk' },
  { seed: 'bayer8', palette: 'ocean', matrix: 'bayer8', name: 'ocean, bayer 8×8' },
  { seed: 'noise', palette: 'ember', matrix: 'noise', name: 'ember, noise' },
  { seed: 'three', palette: 'moss', three: true, name: 'moss, three colours' },
  { seed: 'one-bit', palette: 'ink', title: 'One bit at a time', label: 'Essay' },
];
const contourSeeds = [
  { seed: 'ridge', palette: 'paper' }, { seed: 'basin', palette: 'dusk' }, { seed: 'valley', palette: 'moss' },
  { seed: 'shore', palette: 'ocean' }, { seed: 'peaks', palette: 'ink', levels: 28 },
  { seed: 'terrain', palette: 'dawn', title: 'Mapping the terrain', label: 'Field notes' },
];
const waveformSeeds = [
  { seed: 'ep-1', palette: 'paper' }, { seed: 'ep-2', palette: 'dusk', style: 'bars' },
  { seed: 'ep-3', palette: 'ocean', style: 'bars', field: 'toned', name: 'ocean, toned' }, { seed: 'ep-4', palette: 'ember', style: 'dots' },
  { seed: 'ep-5', palette: 'moss', style: 'line', duration: 2537 },
  { seed: 'ep-42', palette: 'ink', title: 'Episode 42: Quiet software', label: 'Podcast', duration: '48:12' },
];
const bauhausSeeds = [
  { seed: 'one', palette: 'paper', series: 'autumn', name: 'paper, series A' }, { seed: 'two', palette: 'paper', series: 'autumn', name: 'paper, series A' },
  { seed: 'three', palette: 'dusk', series: 'winter' }, { seed: 'four', palette: 'dawn' }, { seed: 'five', palette: 'mono' },
  { seed: 'form', palette: 'ocean', title: 'Form follows function', label: 'Design' },
];
const issueSeeds = [
  { seed: 'i14', palette: 'paper', number: 14, masthead: 'Wren Street', date: 'October 2026' },
  { seed: 'i7', palette: 'dusk', number: 7, masthead: 'Wren Street', date: 'Autumn' },
  { seed: 'i128', palette: 'ember', number: 128 },
  { seed: 'i3', palette: 'moss', number: 3, masthead: 'Field Notes', date: 'Vol. 2' },
  { seed: 'i-notes', palette: 'mono', masthead: 'Field Notes', date: '2026' },
  { seed: 'i21', palette: 'ocean', number: 21, masthead: 'Wren Street', date: 'Nov 2026', title: 'The quiet issue', label: 'Issue' },
];
const photoSeeds = [
  { seed: 'lasers', palette: 'paper', image: lasers, name: 'lasers' }, { seed: 'studio', palette: 'dusk', image: studio, name: 'studio' },
  { seed: 'synth', palette: 'paper', image: photo, name: 'synth' }, { seed: 'lasers-blur', palette: 'paper', image: lasers, show: 'blur', name: 'lasers, blur' },
  { seed: 'studio-title', palette: 'paper', image: studio, title: 'After hours in the studio', label: 'Gear', name: 'studio' },
  { seed: 'lasers-dark', palette: 'dusk', image: lasers, title: 'Light shows', name: 'lasers' },
];
const seedsFor = (name) => ({ mark: markSeeds, aurora: fieldSeeds, gridTitle: fieldSeeds, diagram: diagramSeeds, cutout: cutoutSeeds, riso: risoSeeds, dither: ditherSeeds, contour: contourSeeds, waveform: waveformSeeds, bauhaus: bauhausSeeds, issue: issueSeeds, photo: photoSeeds })[name] ?? seeds;
const palettes = [['light', 'paper'], ['dark', 'dusk']];
const palettesFor = (name) => (['aurora', 'gridTitle', 'mark', 'iconTile', 'stripes', 'bigType', 'duotone'].includes(name) ? palettes : [['set', undefined]]);
/** Caption info for the covers page, by file. */
const manifest = {};
const label = (s, palette) => s.name ?? (typeof (s.palette ?? palette) === 'string' ? (s.palette ?? palette) : 'custom');
const aspects = ['1:1', '16:9'];

const rows = [];
const timings = [];
for (const name of Object.keys(recipes)) {
  const tiles = [];
  for (const aspect of aspects) {
    for (const [mode, palette] of palettesFor(name)) {
      for (const s of seedsFor(name)) {
        const file = `${name}-${mode}-${aspect.replace(':', 'x')}-${s.seed}.webp`;
        const t = performance.now();
        const { name: _n, ...opts } = s;
        const buf = await renderImage({ recipe: name, palette, aspect, image: photo, ...opts, ...(s.palette ? { palette: s.palette } : {}) }, { format: 'webp' });
        timings.push(performance.now() - t);
        await writeFile(join(out, file), buf);
        manifest[file] = { recipe: name, palette: label(s, palette), seed: s.seed };
        tiles.push({ file, buf, aspect, mode });
      }
    }
  }
  rows.push({ name, tiles });

  // One contact sheet per recipe: a row per aspect, light then dark.
  const thumb = 360;
  const gap = 16;
  const heights = aspects.map((a) => Math.round(thumb / (a === '1:1' ? 1 : 16 / 9)));
  const cols = palettesFor(name).length * seedsFor(name).length;
  const sheetW = cols * thumb + (cols + 1) * gap;
  const sheetH = heights.reduce((a, b) => a + b, 0) + (aspects.length + 1) * gap;
  const composites = [];
  let y = gap;
  for (let r = 0; r < aspects.length; r++) {
    for (let col = 0; col < cols; col++) {
      const tile = tiles[r * cols + col];
      composites.push({ input: await sharp(tile.buf).resize(thumb, heights[r]).png().toBuffer(), left: gap + col * (thumb + gap), top: y });
    }
    y += heights[r] + gap;
  }
  await sharp({ create: { width: sheetW, height: sheetH, channels: 3, background: '#e9e9ea' } })
    .composite(composites)
    .png()
    .toFile(join(sheets, `${name}.png`));
}

const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Covers gallery</title>
<style>
  body { margin: 0; padding: 32px 16px; font: 14px/1.5 system-ui, sans-serif; background: #f2f2f3; color: #18181b; }
  h2 { margin: 40px 0 12px; font-size: 15px; font-weight: 600; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
  img { width: 100%; height: auto; display: block; border-radius: 6px; }
  figure { margin: 0; } figcaption { font-size: 11px; color: #71717a; margin-top: 4px; }
</style>
<h1>@arraypress/covers</h1>
${rows.map((r) => `<h2>${r.name}</h2><div class="grid">${r.tiles.map((t) => `<figure><img src="${t.file}" loading="lazy" alt=""><figcaption>${t.file}</figcaption></figure>`).join('')}</div>`).join('\n')}`;
await writeFile(join(out, 'index.html'), html);
await writeFile(join(out, 'manifest.json'), JSON.stringify(manifest, null, 1));

timings.sort((a, b) => a - b);
console.log(`${timings.length} covers → ${out}`);
console.log(`median ${timings[timings.length >> 1].toFixed(0)}ms, max ${timings.at(-1).toFixed(0)}ms (1200px wide WebP)`);
console.log(`contact sheets → ${sheets}`);
