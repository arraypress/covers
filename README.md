# @arraypress/covers

Cover images, flyers, posters, release art, social formats and print stationery, drawn from one seed and a stack of layers. The same slug always gives the same image. Output is SVG, or WebP / PNG / AVIF / JPEG through sharp; it runs in Node, browsers and Cloudflare Workers.

![gridTitle, light and dark](https://raw.githubusercontent.com/arraypress/covers/main/docs/gridTitle.webp)

## Install

```bash
npm install @arraypress/covers sharp
# optional, for icons by name:
npm install @iconify-json/lucide @iconify-json/simple-icons
```

`sharp` is needed for `renderImage()`. `renderSvg()` works without it.

## Quick start

```js
import { renderImage } from '@arraypress/covers';
import { writeFile } from 'node:fs/promises';

const webp = await renderImage({
  recipe: 'gridTitle',
  seed: 'introducing-covers',          // the post's slug
  title: 'Introducing covers',
  label: 'Product',
  palette: 'dusk',
  aspect: '16:9',
});
await writeFile('public/covers/introducing-covers.webp', webp);
```

## What's in it

- [API](https://github.com/arraypress/covers/blob/main/docs/api.md): every export and cover option
- [Layers](https://github.com/arraypress/covers/blob/main/docs/layers.md): mesh, grain, text, diagrams, riso inks, dithers, poster type and more
- [Effects](https://github.com/arraypress/covers/blob/main/docs/effects.md): filters and pixel effects on any layer, masks, paints
- [Recipes](https://github.com/arraypress/covers/blob/main/docs/recipes.md): seventeen built-ins, 91 flyers and release covers, your own
- [JSON recipes](https://github.com/arraypress/covers/blob/main/docs/json-recipes.md): a cover style as data, with no JavaScript
- [Palettes](https://github.com/arraypress/covers/blob/main/docs/palettes.md): presets, one accent, a theme's tokens
- [Formats, print and brand kits](https://github.com/arraypress/covers/blob/main/docs/formats.md): social sizes with safe zones, print with bleed, `kit`, `lint`
- [Animation](https://github.com/arraypress/covers/blob/main/docs/animation.md): motion in the SVG itself
- [Running anywhere](https://github.com/arraypress/covers/blob/main/docs/platforms.md): Node, browsers, Workers
- [Astro](https://github.com/arraypress/covers/blob/main/docs/astro.md): static covers for a content collection
- [Caching and performance](https://github.com/arraypress/covers/blob/main/docs/performance.md)

## Links

- [Docs](https://github.com/arraypress/covers/tree/main/docs)
- [Changelog](https://github.com/arraypress/covers/blob/main/CHANGELOG.md)
- [Licence](https://github.com/arraypress/covers/blob/main/LICENSE)

## Licence

MIT © ArrayPress Limited; author David Sherlock. Inter is © The Inter Project Authors, SIL Open Font License 1.1 (`fonts/OFL.txt`). The example photo is from Unsplash (`examples/CREDITS.md`) and isn't published with the package.
