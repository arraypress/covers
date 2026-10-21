// Type-level usage check (`npm run typecheck`); never executed.
import { cover, renderSvg, renderImage, derivePalette, recipes, type CoverOptions, type Layer } from '../src/index.js';
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

export async function check(): Promise<void> {
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
