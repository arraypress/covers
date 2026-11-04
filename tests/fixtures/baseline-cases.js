/**
 * The covers whose SVG must not change between releases: every built-in
 * recipe across palettes, aspects and options, and every layer type on its
 * own. `baseline-svg.json` holds the SHA-256 of each one's SVG as rendered
 * by 1.0.0 (written by `node tests/fixtures/baseline-cases.js --write`
 * before any 1.1.0 change); `tests/baseline.test.js` re-renders and compares.
 */

import { readFile } from 'node:fs/promises';

const root = new URL('../../', import.meta.url);

/** @returns {Promise<{ name: string, options: any }[]>} */
export async function baselineCases() {
  const photo = await readFile(new URL('examples/photo.jpg', root));
  const recipes = ['aurora', 'gridTitle', 'iconTile', 'bigType', 'stripes', 'duotone', 'mark', 'diagram', 'cutout', 'riso', 'dither', 'contour', 'waveform', 'bauhaus', 'issue', 'photo'];
  const palettes = ['paper', 'dusk', 'ember', { accent: '#2563eb' }, ['#101820', '#f2aa4c', '#3d5afe']];
  const aspects = ['1:1', '16:9', 'og', '4:5', '9:16'];
  const optionSets = [
    {},
    { title: 'Hello there world, a title that wraps onto more lines than it should', label: 'Notes' },
    { title: 'T', label: 'L', icon: 'lucide:feather' },
    { title: { content: 'Object title', size: 40 }, label: { content: 'Lab', color: '#ff0000' }, side: 'left', mesh: { blur: 30 }, grain: false },
    { title: 'Episode 42', number: 7, peaks: [0.1, 0.5, 0.9, 0.3, 0.7], third: true, texture: 'halftone', background: 'gradient', layout: 'hub', nodes: [{ icon: 'lucide:globe' }, { icon: 'lucide:database' }, { icon: 'lucide:database' }], show: 'blur' },
  ];
  const cases = [];
  for (const recipe of recipes) {
    palettes.forEach((palette, pi) => {
      aspects.forEach((aspect, ai) => {
        optionSets.forEach((opts, oi) => {
          // A spread, not the full product: every option set on every recipe, rotating palette and aspect.
          if ((pi + ai + oi) % 3 !== 0) return;
          cases.push({ name: `${recipe}|p${pi}|${aspect}|o${oi}`, options: { recipe, seed: `b-${recipe}-${pi}-${oi}`, palette, aspect, width: 640, image: photo, ...opts } });
        });
      });
    });
  }
  const stacks = {
    solid: [{ type: 'solid' }, { type: 'solid', color: '#ff0000', opacity: 0.5, blend: 'multiply' }],
    gradients: [{ type: 'linear' }, { type: 'radial', x: 0.2, y: 0.3 }, { type: 'linear', colors: ['#000', '#fff', '#f00'], ease: false, angle: 33, opacities: [1, 0.5, 0] }],
    mesh: [{ type: 'mesh' }, { type: 'mesh', arrangement: 'ring', fold: true, streaks: 3, hueSpan: 60, tone: { l: [0.5, 0.7], c: [0.1, 0.2] } }],
    stripes: [{ type: 'stripes', widths: 'taper' }, { type: 'stripes', direction: 'diagonal', angle: 30, widths: [3, 2, 1], gap: 4, radius: 6, region: { x: 0.1, y: 0.1, width: 0.5, height: 0.5 } }],
    image: [{ type: 'image', src: photo, duotone: true, tint: '#ff0000' }, { type: 'image', src: photo, fit: 'contain', grayscale: true, blur: 3, region: { x: 0.5, width: 0.5 } }],
    grain: [{ type: 'solid' }, { type: 'grain' }, { type: 'grain', vary: 'edges', size: 2, monochrome: false, blend: 'soft-light' }],
    pattern: ['grid', 'dots', 'lines', 'rings', 'waves'].map((kind, i) => ({ type: 'pattern', kind, fade: ['none', 'radial', 'edges', 'top', 'left'][i], dash: i === 0 ? 'dotted' : undefined, angle: kind === 'lines' ? 30 : undefined })),
    shapes: [{ type: 'shapes', kind: 'mixed' }, { type: 'shapes', placement: 'row', kind: 'pill', outline: true }, { type: 'shapes', items: [{ kind: 'square', x: 0.2, y: 0.3, rotate: 12, color: '#123456' }] }],
    icon: [{ type: 'icon', name: 'lucide:feather' }, { type: 'icon', name: 'simple-icons:github', tile: true, anchor: 'top-left' }, { type: 'icon', path: 'M0 0L24 24', viewBox: [0, 0, 24, 24], size: 40 }],
    text: [{ type: 'text', content: 'A headline that is long enough to wrap and wrap again and again', maxLines: 2, minSize: 30, label: 'Label' }, { type: 'text', content: 'Pill', anchor: 'center', background: { color: '#fff', padding: 10 }, transform: 'uppercase', weight: 400 }],
    frame: [{ type: 'frame' }, { type: 'frame', fill: '#ffffff', inset: 20 }],
    diagram: [{ type: 'diagram', icon: 'lucide:cpu', grid: true }, { type: 'diagram', layout: 'square', nodes: [1, 2, 3, 4, 5].map(() => ({ icon: 'lucide:box' })), arrows: 'cycle' }],
    handmade: [{ type: 'paper' }, { type: 'scribble', icon: 'lucide:star' }, { type: 'scribble', graph: true }],
    ink: [{ type: 'ink', color: 'riso:pink', shapes: [{ kind: 'circle' }, { kind: 'band', rotate: 10 }, { kind: 'arch', x: 0.3 }, { kind: 'half' }, { kind: 'ring' }, { kind: 'rect' }, { kind: 'text', content: 'ZINE', size: 90 }] }, { type: 'ink', texture: 'halftone', color: 'riso:blue' }],
    dither: [{ type: 'dither' }, { type: 'dither', shape: 'sphere', matrix: 'bayer8' }, { type: 'dither', source: 'radial', matrix: 'noise', colors: ['#000', '#888', '#fff'] }],
    contour: [{ type: 'contour' }],
    waveform: ['mirrored', 'bars', 'line', 'dots'].map((style, i) => ({ type: 'waveform', style, region: { y: i / 4, height: 0.25 }, caption: i === 0 ? 'Caption' : undefined })),
    tiles: [{ type: 'tiles', series: 'a' }],
    rule: [{ type: 'rule' }, { type: 'rule', from: { x: 0.1, y: 0.1 }, to: { x: 0.9, y: 0.9 } }],
  };
  for (const [name, layers] of Object.entries(stacks)) {
    for (const palette of ['paper', 'dusk']) {
      cases.push({ name: `layers:${name}|${palette}`, options: { seed: `l-${name}`, palette, width: 500, aspect: '4:3', layers, radius: name === 'solid' ? 24 : undefined, alt: name === 'text' ? 'Alt <text> & "quotes"' : undefined } });
    }
  }
  return cases;
}

if (process.argv.includes('--write')) {
  const { renderSvg } = await import('../../src/index.js');
  const { createHash } = await import('node:crypto');
  const { writeFile } = await import('node:fs/promises');
  const out = {};
  for (const c of await baselineCases()) out[c.name] = createHash('sha256').update(await renderSvg(c.options)).digest('hex');
  await writeFile(new URL('baseline-svg.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
  console.log(Object.keys(out).length, 'cases');
}
