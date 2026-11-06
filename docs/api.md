# API

| Export | |
|---|---|
| `cover(options)` | Resolve size and palette and expand the recipe into a layer stack. Pure, synchronous; returns plain data you can inspect or tweak. |
| `renderSvg(cover)` | `Promise<string>`: an SVG document. Byte-identical for the same input. Layers with [`motion`](animation.md) play in it. |
| `renderSvg(cover, { t })` | A still at `t` seconds, for [motion and keyframes](animation.md) (static covers ignore it). |
| `renderSvg(cover, { images: 'webp', quality })` | Embedded photos and pixel effects re-encoded as WebP where smaller (about a third off a photo-heavy flyer; needs sharp). For SVGs shown in browsers: librsvg (sharp, `renderImage`) can't draw WebP. |
| `renderImage(cover, { format, quality, lossless, effort, cache })` | `Promise<Buffer>` (Node, sharp): `'webp'` (default), `'png'`, `'avif'` or `'jpeg'`; `lossless` for WebP/AVIF (default: the recipe's preference). |
| `renderBlob(cover, { format, quality, width })`, `rasterize(svg, options)` | `Promise<Blob>` in the browser: PNG, JPEG or WebP through a canvas. |
| `renderPages(cover)` | `{ front, back }`: both sides of a card, ticket or flyer (see [Pages](formats.md#print-pages)). |
| `kit(brand, { formats, recipe })` | A whole brand kit: every format from one brand (see [Brand kit](formats.md#brand-kit)). |
| `lint(cover, { target: 'spotify' })` | Release-art checks (see [lint](formats.md#lint)). |
| `configure({ load, network, harfbuzz, shaper, icons, fonts })`, `registerFont(font)` | Loading and text, per platform (see [Running anywhere](platforms.md)). |
| `FORMATS`, `KIT_FORMATS`, `safeBox(cover)` | Named formats with their safe zones (see [Formats](formats.md#formats)). |
| `EFFECTS`, `EFFECT_OPTIONS`, `MOTION_PRESETS`, `valueAt(keyframes, t)` | Effect kinds and their options; the motion presets; a keyframed value at a time. |
| `coverKey(cover, options)` | The content-hash cache key (see [Caching](performance.md#caching)). |
| `recipes` | The built-in recipes, by name. |
| `defineRecipe(json)`, `loadRecipe(path)` | A recipe from a JSON document or file (see [JSON recipes](json-recipes.md)). |
| `describeParams(recipe)`, `paramLabel(name)`, `PARAM_TYPES` | A JSON recipe's editable params, each with a control type, default, choices and range, to build an editor's form from (see [Describing params](json-recipes.md#describing-params-for-an-editor)). |
| `palettes`, `resolvePalette(input)`, `derivePalette(tokens)` | Palettes (see [Palettes](palettes.md)). |
| `registerIcons(iconifySet)` | Use an icon set without installing its package. |
| `extractPalette(image, { count })` | A photo's dominant colours (k-means in OKLab; needs sharp). |
| `RISO_INKS` | Classic risograph inks by name. |
| `toHex`, `toOklch`, `fromOklch`, `mixOklab`, `mixOklch`, `onBackground`, `gradientAt` | Colour helpers (`onBackground(bgs, 3, 'white')` is the icon-contrast rule). |
| `createRng(seed)`, `hashString(str)` | The seeded randomness, for custom recipes. |
| `resolveSize`, `ASPECTS`, `MIME`, `DEFAULT_QUALITY`, `VERSION` | |

## Cover options

| Option | Default | |
|---|---|---|
| `seed` | the title | Drives every random choice. Use the slug. |
| `width` / `height` / `aspect` | 1200×1200 | `aspect`: `'1:1'`, `'16:9'`, `'4:5'`, `'3:2'`, `'4:3'`, `'2:1'`, `'9:16'`, `'og'` (1200×630), any `'w:h'`, or a number. One side plus an aspect gives the other. |
| `palette` | `'paper'` | A preset, one colour, `[bg, ...colors]`, an object, or `derivePalette()`. |
| `recipe` | — | A recipe name, your own function, or a JSON recipe document. |
| `layers` | mesh + grain | Without a recipe: the stack. With one: extra layers on top. |
| `fonts` | Inter | `[{ name, data \| src, weight, style, axes, fallback }]`, `.ttf`/`.otf`/`.woff`/`.woff2`. `src` is a path, a URL or anything your loader reads; a variable font takes `weight: [100, 900]`; `fallback: true` draws characters other fonts lack. A JSON recipe can declare its own (`"fonts"`). Inter 400/500/600/700 is always available. |
| `format` | — | A named size (`'release'`, `'instagram-story'`, `'business-card'`, …) or `{ width, height, unit: 'px' \| 'mm' \| 'in' }`. Wins over `width`/`height`/`aspect` (a screen format scales to a given `width`). See [Formats](formats.md#formats). |
| `dpi`, `bleed`, `safe`, `cropMarks`, `cutLine`, `cut` | 300, 3 mm, per format | Print: resolution, bleed (mm, or `false`), safe margin (mm), crop marks in a slug, the die line. |
| `overlay` | — | Draw the format's safe zones over the art, for previews. |
| `page` | `'front'` | Which page of a two-sided piece to draw. |
| `textRender` | `'outline'` | `'live'`: all text as `<text>` with `@font-face`. |
| `animate` | `true` | `false`: `renderSvg` draws a still (no CSS). |
| `poster` | — | Seconds: the frame stills show (`renderImage`, `renderBlob`, `animate: false`, reduced motion). Default the layers at rest. |
| `loop` | — | Seconds: a keyframed cover's loop length. |
| `alt` | the title | The SVG's `<title>`. |
| `radius` | — | Rounded corners, transparent outside. |
| any layer id | — | Customise a recipe's layer (see [Recipes](recipes.md)). |

## Lengths

Sizes are pixels as numbers, or viewport units of the cover as strings: `'6vmin'` (6% of the shorter side), `'4vw'`, `'4vh'`, `'5vmax'`. Defaults use these, so a cover keeps its proportions at any size. Positions (`position`, `region`) are fractions of the canvas, 0–1.

The poster layers (`group`, `shape`, `svg`, `table`, `barcode`, `perforation`, `tear`, and `x`/`y` on `text`, `icon` and `image`) take coordinates in **pixels of their canvas**, as SVG does, or `'50%'` of it. Inside a `group` with a `viewBox`, the canvas is the group's grid: a flyer drawn on a 400×500 grid keeps its numbers at 1600×2000 or 3000×3000.
