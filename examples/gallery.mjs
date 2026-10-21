/**
 * Render every recipe × 3 seeds × 2 palettes (light, dark) × 2 aspects to
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
const seedsFor = (name) => (name === 'mark' ? markSeeds : seeds);
const palettes = [['light', 'paper'], ['dark', 'dusk']];
const aspects = ['1:1', '16:9'];

const rows = [];
const timings = [];
for (const name of Object.keys(recipes)) {
  const tiles = [];
  for (const aspect of aspects) {
    for (const [mode, palette] of palettes) {
      for (const s of seedsFor(name)) {
        const file = `${name}-${mode}-${aspect.replace(':', 'x')}-${s.seed}.webp`;
        const t = performance.now();
        const buf = await renderImage({ recipe: name, palette, aspect, image: photo, ...s }, { format: 'webp' });
        timings.push(performance.now() - t);
        await writeFile(join(out, file), buf);
        tiles.push({ file, buf, aspect, mode });
      }
    }
  }
  rows.push({ name, tiles });

  // One contact sheet per recipe: a row per aspect, light then dark.
  const thumb = 360;
  const gap = 16;
  const heights = aspects.map((a) => Math.round(thumb / (a === '1:1' ? 1 : 16 / 9)));
  const cols = palettes.length * seedsFor(name).length;
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

timings.sort((a, b) => a - b);
console.log(`${timings.length} covers → ${out}`);
console.log(`median ${timings[timings.length >> 1].toFixed(0)}ms, max ${timings.at(-1).toFixed(0)}ms (1200px wide WebP)`);
console.log(`contact sheets → ${sheets}`);
