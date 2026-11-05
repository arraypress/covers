# Astro

```ts
// src/pages/covers/[slug].webp.ts
import { getCollection } from 'astro:content';
import { coverEndpoint } from '@arraypress/covers/astro';

export const { getStaticPaths, GET } = coverEndpoint({
  getEntries: () => getCollection('posts'),
  cover: (post) => ({ recipe: 'gridTitle', seed: post.id, title: post.data.title, aspect: '16:9' }),
});
```

`astro build` writes `dist/covers/<id>.webp` for every post; `astro dev` renders on request. Link to one with `coverUrl(post.id)` (→ `/covers/<id>.webp`).

A theme can keep its cover style in its config as JSON and pass it straight through:

```ts
// src/config/site.ts
export const siteConfig = {
  covers: {
    palette: { accent: '#2563eb', bg: '#fdfdfd', text: '#1d1d1f' },
    recipe: {
      name: 'journal',
      params: { background: 'gradient' },
      layers: [
        { id: 'bg', type: 'linear', angle: 135, colors: ['@accent', { mix: ['@accent', '@colors.1', 0.5, 'oklch'] }] },
        { id: 'grain', type: 'grain', amount: 0.05 },
        { id: 'title', type: 'text', when: 'title', content: '{title}', color: '@onAccent', size: { mul: ['@u', 0.07] } },
      ],
    },
  },
};

// src/pages/covers/[slug].webp.ts
import { getCollection } from 'astro:content';
import { coverEndpoint } from '@arraypress/covers/astro';
import { derivePalette } from '@arraypress/covers';
import { siteConfig } from '../../config/site';

const palette = derivePalette(siteConfig.covers.palette);
export const { getStaticPaths, GET } = coverEndpoint({
  getEntries: () => getCollection('posts'),
  cover: (post) => ({ recipe: siteConfig.covers.recipe, seed: post.id, title: post.data.title, palette }),
});
```

Or keep it in a file: `recipe: loadRecipe('./src/covers/journal.json')`.

| Option | Default | |
|---|---|---|
| `getEntries` | — | The entries. |
| `cover` | — | An entry's cover options (may be async). |
| `slug` | `entry.id ?? entry.slug` | |
| `param` | `'slug'` | The route param, matching the file name. |
| `format` | `'webp'` | Match the file's extension (`[slug].png.ts` → `'png'`). |
| `quality` | per format | |
| `cache` | `true` | See below. |

Notes:

- Entries with nested ids (`blog/2026/post`) need a rest route: `[...slug].webp.ts`.
- In `output: 'server'`, add `export const prerender = true;` to keep the covers static. On-demand routes also work (the entry is looked up by slug).
- `coverUrl(slug, { base, format })` encodes each path segment.
- **Keep covers external to Vite's SSR bundle**: `vite: { ssr: { external: ['@arraypress/covers'] } }` in `astro.config.mjs` (any Vite SSR build). Bundled, Vite resolves covers' `#harfbuzz` import against the project's own harfbuzzjs (satori ships an older one), and text fails with "hb.Blob is not a constructor". `@arraypress/image-effects` needs nothing (no `#` imports).
