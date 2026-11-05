// Type-level usage check (`npm run typecheck`); never executed.
import { cover, renderSvg, renderImage, derivePalette, recipes, defineRecipe, loadRecipe, type CoverOptions, type Layer, type RecipeJson } from '../src/index.js';
import { coverEndpoint, coverUrl } from '../src/astro.js';

const layers: Layer[] = [
  { type: 'solid' },
  { type: 'mesh', count: 5, blur: '12vmax', hues: 2 },
  { type: 'pattern', kind: 'grid', fade: 'radial', opacity: 0.12 },
  { type: 'grain', amount: 0.08 },
  { type: 'icon', name: 'lucide:feather', tile: { radius: '6vmin', shadow: 'soft' } },
  { type: 'text', content: 'Hello', anchor: 'bottom-left', maxLines: 2, label: { content: 'News' } },
];

const options: CoverOptions = {
  recipe: 'gridTitle',
  seed: 'post',
  aspect: '16:9',
  title: 'Hello',
  palette: derivePalette({ accent: '#2563eb', bg: '#fdfdfd' }),
  mesh: { blur: '14vmax' },
  grain: false,
};

const house: RecipeJson = {
  $schema: '../schema/recipe.schema.json',
  name: 'house',
  params: { background: 'solid' },
  vars: { ink: { readable: '@accent' } },
  layers: [
    { id: 'bg', type: 'solid', color: '@accent', when: { background: 'solid' } },
    { id: 'bg', type: 'linear', colors: ['@accent', { mix: ['@accent', '@colors.1', 0.5] }], when: { background: 'gradient' } },
    { id: 'title', type: 'text', content: '{title}', color: '$ink', size: { mul: ['@u', 0.07] }, when: 'title' },
  ],
};

export async function check(): Promise<void> {
  const fromJson: string = await renderSvg({ recipe: house, seed: 'x', title: 'Hi', background: 'gradient' });
  const loaded = loadRecipe('./house.json');
  const named: string | undefined = defineRecipe(house).recipeName ?? loaded.recipeName;
  const mark: string = await renderSvg({ recipe: 'mark', icon: 'lucide:music', background: 'gradient', angle: 120 });
  void fromJson; void named; void mark;
  const svg: string = await renderSvg(options);
  const webp: Buffer = await renderImage({ layers }, { format: 'webp', quality: 80, cache: true });
  const c = cover({ recipe: 'aurora', palette: 'dusk' });
  const n: number = c.width + recipes.aurora({}, { width: 1, height: 1, palette: c.palette, rng: null as never, u: 1 }).length;
  void svg; void webp; void n;

  const { getStaticPaths, GET } = coverEndpoint({
    getEntries: async () => [{ id: 'a', data: { title: 'A' } }],
    cover: (post) => ({ recipe: 'bigType', seed: post.id, title: post.data.title }),
  });
  const paths = await getStaticPaths();
  const res: Response = await GET({ params: paths[0].params, props: paths[0].props });
  const url: string = coverUrl('a');
  void res; void url;
}

// 1.1
import { renderPages, lint, kit, configure, registerFont, FORMATS, rasterize, type Effect, type Motion, MOTION_PRESETS } from '../src/index.js';
export async function check11(): Promise<void> {
  const fx: Effect[] = [{ kind: 'halftone', ink: '#0078bf', cell: 5.2, angle: 15 }, { kind: 'wear' }];
  const poster: Layer[] = [
    { type: 'group', viewBox: [0, 0, 400, 500], blend: 'multiply', effects: fx, transform: { translate: [1.8, -1.3], rotate: 0.25, origin: [200, 250] }, layers: [
      { type: 'text', content: 'Bloomfall', x: 16, y: 446, width: 368, weight: 800, size: 104, axes: { wdth: 90 } },
      { type: 'icon', markup: '<path d="M0 0h512v512z"/>', x: 330, y: 22, size: 50 },
      { type: 'shape', kind: 'circle', cx: 214, cy: 176, r: 134, fill: { type: 'linear', colors: ['#fff', '#000'], spread: 'reflect', length: 60 } },
      { type: 'table', y: 26, columns: [{ x: 16, weight: 700 }, { x: 384, align: 'right' }], rows: [['Doors', '7 pm']] },
      { type: 'barcode', value: 'HF-0042', text: true },
      { type: 'perforation', x: 232 },
      { type: 'tear', from: [0, 330], to: [400, 170], fibres: { width: 2.2 } },
      { type: 'texture', kind: 'creases' },
      { type: 'svg', markup: '<circle r="4" fill="{{@accent}}"/>' },
      { type: 'text', content: 'ROUND', path: { kind: 'circle', cx: 200, cy: 200, r: 100 }, fitPath: true, color: 'auto' },
    ] },
    { type: 'solid', knockout: [{ type: 'text', content: 'MAKE IT', x: 14, y: 118, width: 372 }] },
  ];
  const svg: string = await renderSvg({ layers: poster, format: 'instagram-story', overlay: true }, { t: 0.5 });
  const pages: Record<string, string> = await renderPages({ recipe: 'brand', format: 'business-card', name: 'Hollow Fern' });
  const report = await lint({ recipe: 'brand', format: 'release' }, { target: 'spotify' });
  const ok: boolean = report.ok && report.issues.every((i) => i.severity === 'error' || i.severity === 'warning');
  const files = await kit({ name: 'Hollow Fern' }, { formats: ['avatar', 'x-header'] });
  configure({ shaper: 'js', harfbuzz: '/harfbuzz.wasm', network: true });
  registerFont({ name: 'Fraunces', src: '/fonts/Fraunces.ttf', weight: [100, 900] });
  const w: number = FORMATS['youtube-banner'].zones!.safe[2];
  const blob: Promise<Blob> = rasterize(svg, { format: 'webp' });
  void [pages, ok, files, w, blob];
}

// 1.1 additions: repeat, defs/use, spans, per-glyph control, pixel type, paints, soft shapes, cuts, recipe fonts.
export async function more(): Promise<void> {
  const layers: Layer[] = [
    { type: 'repeat', rows: 4, cols: 4, step: [50, 50], layer: { type: 'shape', kind: 'sector', r: 25, start: 0, end: 180 }, odd: { fill: '#ff3b1d' }, skip: '{#i == 5}' },
    { type: 'repeat', count: 12, radius: 80, cx: '50%', cy: '50%', layer: { type: 'shape', kind: 'rect', x: -4, y: -12, width: 8, height: 24 } },
    { type: 'defs', layers: [{ id: 'badge', type: 'shape', kind: 'burst', r: 30 }] },
    { type: 'use', ref: 'badge', x: 100, y: 100, rotate: 12, scale: 0.6, with: { opacity: 0.5 } },
    { type: 'text', spans: [{ content: 'Mixed ', weight: 900 }, { content: 'runs', font: 'Fraunces', scale: 1.4, color: '#c22' }], x: 20, y: 100 },
    { type: 'text', content: 'Groovy', glyphs: { scale: [0.8, 1.2], rotate: [-6, 6], color: ['#e8541c', '#2a7d6f'] }, fallback: 'Noto Symbols' },
    { type: 'text', content: 'PIXEL', font: 'pixel', extrude: { depth: 6, color: '#5b2bff' }, stroke: '#111', dash: [3, 2] },
    { type: 'text', content: 'Pale Orchard', fit: 'words', width: 180, x: 20, y: 280, fill: { preset: 'chrome' } },
    { type: 'text', content: 'under', x: 20, y: 300, autoThreshold: 0.7, color: 'auto' },
    { type: 'shape', kind: 'circle', r: 60, soft: 18, fill: { type: 'radial', colors: ['#ffe066', '#ff7a00'], opacities: [1, 0], rx: 0.5, ry: 0.3 } },
    { type: 'shape', kind: 'rect', width: 80, height: 50, rotate: 20, origin: [0, 0], fill: { type: 'tile', kind: 'checker', size: 8, colors: ['#fff', '#111'] } },
    { type: 'shape', kind: 'arch', open: true, stroke: '#7cf', dash: [4, 3], dashOffset: 2 },
    { type: 'shape', kind: 'cut', outset: -20, fill: 'none', stroke: '#fff' },
    { type: 'icon', name: 'lucide:heart', fill: { type: 'linear', colors: ['#ffd700', '#ff3b8a'] }, effects: [{ kind: 'border', shape: 'circle', width: 8 }, { kind: 'extrude', depth: '2vmin' }, { kind: 'filter', markup: '<feDropShadow in="SourceGraphic" dy="2"/>', colorSpace: 'linearRGB' }] },
  ];
  const json: RecipeJson = { name: 'f', fonts: [{ name: 'Bebas', src: 'fonts/bebas.woff2', weight: 400 }], layers: [{ type: 'text', content: '{title}', font: 'Bebas', y: '{layout.title.bottom + 12}' }] };
  const svg: string = await renderSvg({ layers, format: 'ticket', cutLine: true, cut: { radius: 4 } });
  void [json, svg];
}

// Image filters: pixel effects, masks, presets.
export async function filters(photo: Uint8Array) {
  const fx: Effect[] = [
    { kind: 'spin', center: [0.47, 0.36], angle: 14, mask: { gradient: 'radial', center: { x: 0.47, y: 0.36 }, from: '10vmin', to: '30vmin' } },
    { kind: 'motion', angle: -38, length: '6vmin', mask: { gradient: 'linear', from: [0.4, 0.5], to: [0.25, 0.5], ease: false } },
    { kind: 'tilt', angle: 4, width: '6vmin', falloff: '25vmin', saturate: 1.15 },
    { kind: 'lens', radius: '3vmin', blades: 6, highlights: 1.5, mask: { layers: [{ type: 'shape', kind: 'circle', cx: 300, cy: 200, r: 120, fill: '#fff' }], invert: true } },
    { kind: 'look', name: 'tealOrange', amount: 0.8 },
    { kind: 'curves', points: [[0, 0], [0.25, 0.2], [0.75, 0.82], [1, 1]], blue: [[0, 0.1], [1, 0.9]] },
    { kind: 'displace', amount: '2vmin', map: { layers: [{ type: 'text', content: 'ECHO' }] } },
    { kind: 'newsprint', angles: [15, 75, 0, 45] },
    { kind: 'ascii', color: 'source', background: 'none' },
  ];
  // @ts-expect-error: not an option of spin
  const bad: Effect = { kind: 'spin', angel: 3 };
  // @ts-expect-error: not a mask gradient
  const badMask: Effect = { kind: 'blur', mask: { gradient: 'diamond' } };
  const png: Uint8Array = await renderImage({ layers: [{ type: 'image', src: photo, effects: [...fx, 'grain', 'invert'] }] });
  void [bad, badMask, png];
}

// Motion: plays in the SVG; stills at a poster time.
export async function motion() {
  const m: Motion[] = [
    { translate: ['5vw', '-4vw'], scale: 1.08, origin: ['22%', '66%'], duration: 26, easing: 'inOut', direction: 'alternate' },
    { preset: 'spin', duration: 50, origin: [200, 222], direction: 'reverse' },
    { vary: { axes: { wdth: [62, 150] } }, duration: 2.8, delay: -0.32, easing: [0.42, 0, 0.58, 1], iterations: 'infinite' },
    { opacity: [1, 0, 1], easing: 'step', duration: 1.1 },
    { path: { kind: 'ellipse', rx: 12, ry: 8 }, duration: 9 },
  ];
  // @ts-expect-error: not a preset
  const badPreset: Motion = { preset: 'wobble' };
  // @ts-expect-error: not a direction
  const badDirection: Motion = { direction: 'sideways' };
  const svg: string = await renderSvg({ poster: 1.5, layers: [{ type: 'solid', color: '#000', motion: m }, { type: 'shape', kind: 'rect', motion: 'blink' }] });
  const still: string = await renderSvg({ animate: false, layers: [{ type: 'solid', motion: ['drift', 'breathe'] }] }, { t: 2 });
  void [badPreset, badDirection, svg, still, MOTION_PRESETS.marquee.duration];
}
