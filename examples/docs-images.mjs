/**
 * Render the README's recipe images into `docs/`: each recipe, light and
 * dark side by side.
 *
 *   node examples/docs-images.mjs
 */

import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import sharp from 'sharp';
import { renderImage, recipes } from '../src/index.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const docs = join(root, 'docs');
await mkdir(docs, { recursive: true });

const base = {
  aspect: '16:9',
  width: 800,
  title: 'Field notes on building quieter software',
  label: 'Essay',
  icon: 'lucide:compass',
  image: join(root, 'examples', 'photo.jpg'),
};

for (const recipe of Object.keys(recipes)) {
  const tiles = await Promise.all(
    [['paper', 'notes-light'], ['dusk', 'notes-dark']].map(([palette, seed]) => renderImage({ ...base, recipe, palette, seed }, { format: 'png' })),
  );
  await sharp({ create: { width: 1616, height: 450, channels: 3, background: '#ffffff' } })
    .composite([{ input: tiles[0], left: 0, top: 0 }, { input: tiles[1], left: 816, top: 0 }])
    .webp({ quality: 80 })
    .toFile(join(docs, `${recipe}.webp`));
}

// The layer showcase: a hand-built stack.
const manual = await renderImage({
  width: 800,
  aspect: '16:9',
  seed: 'manual',
  palette: 'ocean',
  layers: [
    { type: 'linear', angle: 160 },
    { type: 'pattern', kind: 'dots', fade: 'radial', opacity: 0.22 },
    { type: 'shapes', kind: 'mixed', count: 7, size: ['8vmin', '22vmin'], region: { x: 0.45 } },
    { type: 'frame' },
    { type: 'icon', name: 'lucide:sparkles', anchor: 'top-left', tile: true, size: '8vmin' },
    { type: 'text', content: 'Every layer, by hand', anchor: 'bottom-left', size: '7vmin', label: 'Manual', background: { padding: ['4vmin', '5vmin'], radius: '3vmin' } },
    { type: 'grain', amount: 0.07 },
  ],
}, { format: 'webp' });
await sharp(manual).toFile(join(docs, 'manual.webp'));
console.log(`docs images → ${docs}`);
