# @arraypress/covers

Build-time cover images for posts, products and pages: soft mesh gradients, film grain, fine grids, stripes, shapes, icons and type, drawn from one **seed**. The same slug always gives the same image, and two posts never look alike.

Nine recipes cover the editorial looks (full-bleed gradient fields, engineering-blog line diagrams, cut-paper collages with hand-drawn icons, stripe bands, a clean icon tile, big type, duotone photos, a single-icon mark), and every layer under them is yours to change, remove or add to. Recipes are data: the built-ins are JSON documents, and a theme can write its own cover style the same way, with no JavaScript (see [JSON recipes](#json-recipes)). Output is an SVG string (text as outlines, so it needs no fonts) or WebP / PNG / AVIF / JPEG via [sharp](https://sharp.pixelplumbing.com). Inter ships in the package, so it works with no setup. There's an Astro helper that turns a content collection into static covers in three lines.

No network, no telemetry, no DOM. It runs in Node at build time.

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

Or build the stack yourself:

```js
const svg = await renderSvg({
  seed: 'hello',
  palette: ['#0c0d12', '#3d5afe', '#ff6b3d', '#9b4dff'], // [bg, ...colors]
  layers: [
    { type: 'mesh', blur: '12vmax' },
    { type: 'pattern', kind: 'grid', fade: 'edges' },
    { type: 'grain', amount: 0.08 },
    { type: 'text', content: 'Hello', anchor: 'bottom-left', size: 96 },
  ],
});
```

![a hand-built stack](https://raw.githubusercontent.com/arraypress/covers/main/docs/manual.webp)

## API

| Export | |
|---|---|
| `cover(options)` | Resolve size and palette and expand the recipe into a layer stack. Pure, synchronous; returns plain data you can inspect or tweak. |
| `renderSvg(cover)` | `Promise<string>`: an SVG document. Byte-identical for the same input. |
| `renderImage(cover, { format, quality, effort, cache })` | `Promise<Buffer>`: `'webp'` (default), `'png'`, `'avif'` or `'jpeg'`. |
| `coverKey(cover, options)` | The content-hash cache key (see [Caching](#caching)). |
| `recipes` | The built-in recipes, by name. |
| `defineRecipe(json)`, `loadRecipe(path)` | A recipe from a JSON document or file (see [JSON recipes](#json-recipes)). |
| `palettes`, `resolvePalette(input)`, `derivePalette(tokens)` | Palettes (see [Palettes](#palettes)). |
| `registerIcons(iconifySet)` | Use an icon set without installing its package. |
| `toHex`, `toOklch`, `fromOklch`, `mixOklab`, `mixOklch`, `onBackground`, `gradientAt` | Colour helpers (`onBackground(bgs, 3, 'white')` is the icon-contrast rule). |
| `createRng(seed)`, `hashString(str)` | The seeded randomness, for custom recipes. |
| `resolveSize`, `ASPECTS`, `MIME`, `DEFAULT_QUALITY`, `VERSION` | |

### Cover options

| Option | Default | |
|---|---|---|
| `seed` | the title | Drives every random choice. Use the slug. |
| `width` / `height` / `aspect` | 1200×1200 | `aspect`: `'1:1'`, `'16:9'`, `'4:5'`, `'3:2'`, `'4:3'`, `'2:1'`, `'9:16'`, `'og'` (1200×630), any `'w:h'`, or a number. One side plus an aspect gives the other. |
| `palette` | `'paper'` | A preset, one colour, `[bg, ...colors]`, an object, or `derivePalette()`. |
| `recipe` | — | A recipe name, your own function, or a JSON recipe document. |
| `layers` | mesh + grain | Without a recipe: the stack. With one: extra layers on top. |
| `fonts` | Inter | `[{ name, data, weight, style }]`, `.ttf`/`.otf`/`.woff` (not woff2). Inter 400/500/600/700 is always available. |
| `alt` | the title | The SVG's `<title>`. |
| `radius` | — | Rounded corners, transparent outside. |
| any layer id | — | Customise a recipe's layer (see [Recipes](#recipes)). |

### Lengths

Sizes are pixels as numbers, or viewport units of the cover as strings: `'6vmin'` (6% of the shorter side), `'4vw'`, `'4vh'`, `'5vmax'`. Defaults use these, so a cover keeps its proportions at any size. Positions (`x`, `y`, `region`) are fractions of the canvas, 0–1.

## Layers

Layers paint bottom first. Every option has a default drawn from the palette, the canvas and the layer's own seeded stream, so `{ type: 'mesh' }` alone is a finished background. Every layer also takes `id` (for overrides), `seed` (its own stream), `opacity` and `blend` (a CSS `mix-blend-mode`).

A layer's random stream is keyed by its `seed`, else its `id`, else its type and position among layers of that type, so adding a layer never reshuffles the others.

### `solid`
`color` (default `bg`).

### `linear`
`colors` (default the first two palette colours), `opacities` (per stop), `angle` (CSS degrees, 0 = up; default seeded), `ease` (default `true`: smoothstep stops mixed in OKLab, so there's no hard edge where the gradient starts and ends).

### `radial`
`colors` (centre → edge; default `[colors[0], bg]`), `x`, `y` (default seeded), `radius` (default `'80vmax'`), `ease`.

### `mesh`
Full-bleed fields of blurred colour: the mesh-gradient look.

| Option | Default | |
|---|---|---|
| `colors` | the palette's | |
| `hues` | 3 | How many distinct colours to use. A few hues read as a colour story; every hue at once reads as a rainbow. |
| `count` | 4 | Fields. |
| `arrangement` | `'sweep'` | Long fields laid along one direction, their centres free to sit beyond the frame. `'ring'` spreads rounder blobs around the centre. |
| `angle` | seeded | The sweep's direction, degrees. |
| `streak` | 1.5 | How much more a sweep blurs along its direction than across it (broad washes rather than spots). |
| `blur` | `'11vmax'` | Gaussian std deviation. |
| `spread` | 1 | How far fields wander, 0–1. |
| `size` | `[0.42, 0.72]` | Radius range, fractions of the longer side. |
| `tone` | — | `{ l: [min, max], c: [min, max] }`: pull every colour into an OKLCH band, keeping its hue. Pastels become clear mid-tones; a dark palette can't fall to black between fields. |
| `fold` | — | `true` or `{ color, to, position, bend, softness, sheen }`: a second field meeting the first along a soft curve, its edge sharper than the blur elsewhere, with a faint sheen along it (silk). |
| `streaks` | 0 | Thin light motion streaks along the sweep. |
| `base` | `'auto'` | Under the fields: a gradient across the sweep between the first two colours, so colour reaches every edge and corner. Or `'bg'`, a colour, or `null`. |
| `blobs` | — | `[{ x, y, r, squash, rotate, color, opacity }]` to place them yourself. |

### `stripes`
`direction` (`'vertical'` default, `'horizontal'`, `'diagonal'` + `angle`), `count` (8), `widths` (`'even'`, `'random'`, `'taper'` with `taper` ratio 0.78, or weights like `[3, 2, 1]`), `colors` (cycled), `gap`, `radius`, `region` (fractions; default the whole canvas), `regionRadius`.

### `image`
`src` (a local path, a `data:` URI or bytes; URLs are refused), `fit` (`'cover'` / `'contain'`), `focus` (an anchor, or `'attention'` / `'entropy'` smart crops), `region`, `duotone` (`true` derives shadow and highlight from the palette, or `[shadow, highlight]`), `grayscale`, `normalize` (stretch tones first; on by default with duotone/grayscale), `tint` (a colour, or `{ color, amount, blend }`), `blur`.

With sharp installed the image is cropped and resized to its box before embedding. Without it, PNG, JPEG and SVG are embedded as they are.

### `grain`
`amount` (0.08), `size` (px per grain, 1), `monochrome` (`true`), `vary` (`'edges'`: heavier toward the edges and corners, like spray paint), `blend` (`'overlay'`; also `'soft-light'`, `'multiply'`, `'screen'`, `'normal'`).

### `pattern`
`kind`: `'grid'` (default), `'dots'`, `'lines'` (+ `angle`), `'rings'`, `'waves'` (+ `wavelength`, `amplitude`). `size` (cell; `'8.33vmin'`), `stroke`, `color` (`text`), `opacity` (0.14), `center` (rings and grid alignment), `fade` (`'none'`, `'radial'`, `'edges'`, `'top'`, `'bottom'`, `'left'`, `'right'`), `dash` (`'dashed'`, `'dotted'` or `[on, off]`), `divisions` (grid/lines: N equal cells, inner lines only, instead of `size`), `gaps` (regions the lines break around), `region`.

Grid lines are drawn across the canvas, not as an SVG `<pattern>` (which clips a line on a tile edge to half its width), and centred.

### `shapes`
`kind` (`'circle'`, `'square'`, `'pill'`, `'mixed'`), `count` (6), `size` (`['7vmin', '20vmin']`), `colors`, `placement` (`'scatter'` spreads them out avoiding overlaps; `'row'`, `'column'`), `items` (`[{ kind, x, y, size, color, rotate, opacity }]`), `region`, `rotate`, `radius` (squares, fraction of size), `outline` (`true` or a width).

### `icon`
One of `name` (Iconify: `'lucide:feather'`, `'simple-icons:github'`), `svg` (a raw SVG string; scripts and handlers are stripped) or `path` (+ `viewBox`). `size` (`'24vmin'`, `'15vmin'` on a tile), `color` (the accent on a tile, else `text`), `strokeWidth`, `anchor`, `position`, `offset`, `margin`, and `tile` (`true` or `{ size, radius, color, shadow: 'soft' | 'none', border }`).

Named icons load from `@iconify-json/<prefix>` (resolved from your project), or from a set you pass to `registerIcons()`.

### `text`
Set as outlines, so the SVG needs no fonts.

| Option | Default | |
|---|---|---|
| `content` | — | `\n` breaks a line. |
| `font`, `weight`, `style` | `'Inter'`, 600 | The closest weight in the family wins. |
| `size` | 6% of `sqrt(w × h)` | |
| `minSize` | — | Shrink toward this before truncating. |
| `lineHeight` | 1.12 | |
| `letterSpacing` | -0.02 | Em. Tighten big type further (`-0.045`). |
| `color` | `text` | |
| `anchor` | `'bottom-left'` | Nine anchors, inside the safe `margin` (7% of `sqrt(w × h)`). |
| `align` | from the anchor | |
| `position`, `offset` | — | |
| `maxWidth` | width less margins | |
| `maxLines` | 3 | Past it, cut at a word with `ellipsis` (`'…'`). |
| `balance` | `true` | Even line lengths (CSS `text-wrap: balance`). |
| `transform` | — | `'uppercase'` / `'lowercase'`. |
| `label` | — | A small line above: a string, or `{ content, size, weight, color, letterSpacing, transform, gap }` (uppercase, tracked, `muted` by default). |
| `background` | — | A pill or box behind: a colour, or `{ color, radius, padding, opacity }`. |

Text is shaped by [HarfBuzz](https://harfbuzz.github.io) (kerning, ligatures, any script the font covers) and trimmed to the cap height above and the baseline below, so a margin measured to a headline is the margin you see. A word wider than the line breaks between characters. Pass a font that covers your script for non-Latin titles (the bundled Inter is a Latin subset).

### `diagram`
White line-art: one icon, or nodes (icons in outlined tiles) joined by arrows.

| Option | Default | |
|---|---|---|
| `icon` | — | One icon, drawn large (an Iconify name or raw SVG). |
| `nodes` | — | `[{ icon, shape: 'square' \| 'circle' \| 'none', size, brackets }]`. |
| `layout` | from the count | `'single'`, `'row'` (2–4), `'triangle'` (one over two), `'square'` (four corners, a fifth in the middle with dotted spokes and corner brackets), `'stack'` (two merging into one), `'hub'` (a large first node with the rest round its edge, knocked out of it: a globe with databases). |
| `arrows` | `true` | `false`, `'loop'` (row: an elbow back from the last to the first), `'both'` (triangle: there and back), `'cycle'` (square). |
| `size`, `gap` | per layout | Node size and spacing. |
| `stroke` | `'0.3vmin'` | One line weight for tiles, arrows and icons (Lucide strokes are rescaled to match). |
| `color` | white | |
| `grid` | — | `true` or `{ divisions: 4, opacity: 0.6, stroke, color, pad }`: a dotted grid whose lines break around the nodes and arrows instead of running through them. |
| `iconScale`, `radius`, `position` | 0.44, — , centre | |

### `paper`
Cut-paper shapes: the outline is resampled into short straight cuts, each nudged off the line (seeded), so edges are irregular but never blurry. `count` (4, laid out as a loose collage), `kind` (`'mixed'`, `'rect'`, `'square'`, `'circle'`, `'blob'`, `'arch'`, `'pill'`), `color` (`#faf9f5`), `region` (the middle 60%), `items` (`[{ kind, x, y, width, height, size, rotate, color }]`), `wobble` (0.5).

### `scribble`
A hand-drawn line: an `icon` re-drawn by hand (its outline flattened, wobbled with smooth seeded noise, stroked in short runs whose width drifts, round caps), or `graph` (`true` or `{ nodes, dot }`: a polyline with filled dots). `color` (`#faf9f5`), `stroke` (`'1.3vmin'`), `size` (`'46vmin'`), `position`, `wobble` (0.5).

### `frame`
`inset` (`'3.5vmin'`), `radius` (`'2vmin'`), `stroke` (`'0.15vmin'`), `color` (`text`, at opacity 0.22), `fill` (a colour, to make a card).

## Recipes

A recipe returns a stack of layers with ids. Customise any of them by id:

- a **string** is the layer's content: `title: 'Hello'`, `icon: 'lucide:feather'`
- an **object** is merged into the layer: `mesh: { blur: '16vmax' }`, `title: { content: 'Hello', size: 96 }`
- **`false`** removes it: `grain: false`

```js
await renderImage({
  recipe: 'gridTitle',
  seed: post.slug,
  title: post.title,
  mesh: { hues: 2, blur: '14vmax' },
  grid: { kind: 'dots' },
  layers: [{ type: 'frame' }], // painted on top
});
```

Every recipe takes an optional `title` and `label`.

### `aurora`
Layers `bg`, `mesh`, `grain` (+ `title`). Full-bleed sweeps of the palette's colours; per seed, sometimes a silk fold, sometimes motion streaks, sometimes grain heavier at the edges.

![aurora](https://raw.githubusercontent.com/arraypress/covers/main/docs/aurora.webp)

### `gridTitle`
Layers `bg`, `mesh`, `grid`, `grain` (+ `title`). The same field under a dotted grid of four cells each way.

Both were tuned against openai.com/news, measured rather than eyeballed: colour reaches every edge and corner (no page colour, no vignette), two or three hues in fields larger than the frame, directional sweeps and folds rather than round blobs, clear mid-tones (OKLCH lightness ~0.55–0.85, chroma ~0.1–0.2), and **no title on the image** (the page sets it under the card). Give a `title` and one sets lower left: the field is then toned so the palette's text clears 4.5:1 wherever the title sits (light pages: lightness 0.66–0.82; dark: 0.34–0.5), folds and streaks are left out, and a test checks every preset.

![gridTitle](https://raw.githubusercontent.com/arraypress/covers/main/docs/gridTitle.webp)

### `diagram`
Layers `bg`, `mesh`, `diagram`, `grain` (+ `title`). The field, toned a little deeper (lightness 0.4–0.6, so white lines clear 3:1, WCAG 1.4.11; tested on every preset), with white line-art and a dotted grid that breaks around it: the engineering-blog look. Options `icon`, `nodes`, `layout`, `arrows` (see the [`diagram` layer](#diagram)).

```js
await renderImage({ recipe: 'diagram', seed: post.id, layout: 'hub',
  nodes: [{ icon: 'lucide:globe' }, { icon: 'lucide:database' }, { icon: 'lucide:database' }, { icon: 'lucide:database' }] });
await renderImage({ recipe: 'diagram', seed: post.id, arrows: 'loop',
  nodes: [{ icon: 'lucide:send' }, { icon: 'lucide:settings' }, { icon: 'lucide:cpu' }] });
```

![diagram](https://raw.githubusercontent.com/arraypress/covers/main/docs/diagram.webp)

### `cutout`
Layers `bg`, `panel`, `shapes`, `icon` or `graph`, `grain` (+ `title`). A flat, matte field (the accent toned down: lightness 0.52–0.64, chroma 0.05–0.11), cut-paper shapes in off-white, and a hand-drawn icon or node graph. `panel: true` sets a hand-cut panel on the page colour instead of a full field. `shapes` (3; none on a panel), `graph`, `stroke: 'light' | 'dark'` (default: dark over paper, light on a bare field or panel; both clear 3:1 on the field). Muted palettes suit it: `{ accent: '#8b80c9' }` (lavender), `'#b5694f'` (clay), `'#8a9a7b'` (sage), `'#c4a052'` (ochre), `'#5f6f7f'` (slate).

![cutout](https://raw.githubusercontent.com/arraypress/covers/main/docs/cutout.webp)

### `iconTile`
Layers `bg`, `glow`, `rings`, `icon`, `grain` (+ `title`). An icon on a raised tile over a soft tint of the accent, a glow and faint rings. With a title, the tile moves to the top left. `icon` is an Iconify name (a spark when none is given).

![iconTile](https://raw.githubusercontent.com/arraypress/covers/main/docs/iconTile.webp)

### `bigType`
Layers `bg`, `wash`, `grain`, `label`, `title`. The headline is the cover: large, tight (−0.045em), shrinking to fit four lines; the label in the accent at the top.

![bigType](https://raw.githubusercontent.com/arraypress/covers/main/docs/bigType.webp)

### `stripes`
Layers `bg`, `stripes`, `spot`, `icon`, `grain`, `title`. A tonal band of tapering stripes down one side (`side: 'left' | 'right'`), a disc riding its edge with an optional `icon`, and the title on the open side.

![stripes](https://raw.githubusercontent.com/arraypress/covers/main/docs/stripes.webp)

### `duotone`
Layers `image`, `scrim`, `grain`, `title`. A photo (`image`: a path or bytes) mapped to the palette's shadow and highlight colours, with a scrim under the title.

![duotone](https://raw.githubusercontent.com/arraypress/covers/main/docs/duotone.webp)

### `mark`
Layers `bg`, `icon`, `grain` (+ `title`). One icon, centred, on the accent, or on a gradient with `background: 'gradient'` (135°, the accent toward the palette's second colour, mixed in OKLCH so it stays vivid; `angle` and `colors` override). `icon` is an Iconify name or raw SVG (the spark by default); `size` is `'24vmin'`; grain is 0.03 (`grain: false` removes it). A title appears bottom left only when given.

`iconColor` is `'auto'` (default), `'white'`, `'black'` or a colour. Auto prefers **white** whenever white clears **3:1** (WCAG 1.4.11, non-text contrast; 4.5:1 is the rule for text) against everything under the icon: the fill, or for a gradient every colour across the icon's square (sampled along the gradient, not just its midpoint). Otherwise it's near-black. So a mid-tone orange-to-pink gradient keeps a white mark, and a yellow one gets a dark one. The title is text, so it keeps the icon's colour only where that clears 4.5:1 across the whole background.

```js
await renderImage({ recipe: 'mark', seed: 'podcast', icon: 'lucide:music', background: 'gradient' });
```

![mark](https://raw.githubusercontent.com/arraypress/covers/main/docs/mark.webp)

### Your own

```js
const poster = (o, { palette, rng, u }) => [
  { type: 'solid' },
  { type: 'shapes', count: rng.int(3, 6), kind: 'circle' },
  { type: 'text', content: o.title, size: u * 0.1, anchor: 'top-left' },
];
await renderSvg({ recipe: poster, seed: 'x', title: 'Hello' });
```

## Palettes

| Input | Means |
|---|---|
| `'dusk'` | A preset: `paper`, `ink`, `dawn`, `dusk`, `ocean`, `ember`, `moss`, `carbon`, `mono`. |
| `'#2563eb'` | One colour: an accent to derive a palette from. |
| `['#0c0d12', '#3d5afe', '#ff6b3d']` | `[bg, ...colors]`. |
| `{ bg, colors, text, accent, muted, surface }` | Any subset; the rest is derived. |

Resolved, a palette has `mode`, `bg`, `colors`, `text` (7:1 on `bg` when derived), `accent`, `onAccent` (white, or near-black when the accent is light), `muted` and `surface`.

From a theme's tokens:

```js
import { derivePalette } from '@arraypress/covers';

const palette = derivePalette({ accent: '#2563eb', bg: '#fdfdfd', text: '#1d1d1f' });
// or just: derivePalette({ accent: 'rgb(209 254 23)', mode: 'dark' })
```

The gradient colours are built in OKLCH around the accent's hue (the accent, two neighbours ±40° and a quiet complement), pastel on light backgrounds and deep on dark ones. Colours can be hex, `rgb()` or `hsl()`; alpha is ignored.

## JSON recipes

A cover style can be data: a JSON document, in a `.json` file or in a theme's config. The built-ins are written this way (`recipes/*.json`; read them for worked examples). Point `$schema` at the bundled schema for autocomplete and checking in your editor.

```json
{
  "$schema": "https://unpkg.com/@arraypress/covers/schema/recipe.schema.json",
  "name": "house",
  "params": { "background": "solid", "angle": 135 },
  "vars": {
    "ink": { "readable": "@accent" },
    "lean": { "range": [-8, 8] }
  },
  "layers": [
    { "id": "bg", "type": "solid", "color": "@accent", "when": { "background": "solid" } },
    { "id": "bg", "type": "linear", "when": { "background": "gradient" },
      "angle": { "add": ["{angle}", "$lean"] },
      "colors": ["@accent", { "mix": ["@accent", "@colors.1", 0.5, "oklch"] }] },
    { "id": "grid", "type": "pattern", "kind": "grid", "color": "$ink", "fade": "edges",
      "opacity": { "if": { "mode": "dark" }, "then": 0.16, "else": 0.12 } },
    { "id": "grain", "type": "grain", "amount": 0.05 },
    { "id": "title", "type": "text", "when": "title", "content": "{title}", "label": "{label}",
      "color": "$ink", "size": { "mul": ["@u", 0.066] }, "maxLines": 3 }
  ]
}
```

```js
import { loadRecipe, renderImage } from '@arraypress/covers';

const house = loadRecipe('./src/covers/house.json'); // or defineRecipe(json), or pass the object as `recipe`
await renderImage({ recipe: house, seed: 'my-post', title: 'Hello', background: 'gradient' });
```

A layer is any [layer](#layers) plus an optional `id` and `when`. Its option values can be literals or:

| Form | Means |
|---|---|
| `"@bg"`, `"@text"`, `"@accent"`, `"@onAccent"`, `"@muted"`, `"@surface"`, `"@mode"`, `"@colors"`, `"@colors.N"` | The palette (`colors.N` wraps around). |
| `"@width"`, `"@height"`, `"@u"` | The canvas in px (`u` = `sqrt(width × height)`, the unit the built-ins size type with). |
| `"$name"`, `"$name.0"`, `"$name.x"` | A var (or an item or field of it). |
| `"{title}"`, `"{label}"`, `"{icon}"`, `"{image}"`, `"{param}"`, `"{opt.anything}"` | A cover option. A whole-string token keeps the value's type (a number stays a number, a label object stays an object); inside longer text it's interpolated (`"Read {title}"`). An unset option drops the key. |
| `{ "mix": [a, b, t] }`, `{ "mix": [a, b, t, "oklch"] }` | Two colours mixed in OKLab, or in OKLCH (hue the short way, so far-apart hues stay vivid). |
| `{ "readable": c }`, `{ "readable": [c, light, dark] }` | White (or `light`), or near-black (or `dark`), whichever reads better on `c`. |
| `{ "readable": [backgrounds, ratio, prefer] }` | `prefer` (`"white"`, `"black"` or a colour) when it clears `ratio` on every background (one colour or a list), else the better of white and near-black. `[c, 3, "white"]` is the icon rule. |
| `{ "tone": [color, { l: [min, max], c: [min, max] }] }` | The colour pulled into an OKLCH band, its hue kept. |
| `{ "gradientUnder": [colors, angle, size] }` | The colours a centred square of `size` covers in a linear gradient (five samples, eased as drawn). Pair it with `readable`. |
| `{ "pick": [...] }`, `{ "range": [min, max] }`, `{ "int": [min, max] }` | Seeded choices. |
| `{ "add" / "sub" / "mul" / "div" / "min" / "max": [...] }` | Arithmetic. Lengths (`"54vw"`, `"12vmin"`) become px first. |
| `{ "ramp": [from, to, steps, amount?] }` | `steps` colours from `from` toward `to` (`amount` of the way). |
| `{ "taper": [ratio, steps] }` | `[1, ratio, ratio², …]`, e.g. stripe widths. |
| `{ "reverse": array }` | |
| `{ "if": condition, "then": a, "else": b }` | A choice. Only the chosen side is evaluated (and draws from the stream). |
| `"@@x"`, `"$$x"` | A literal `@x` / `$x`. |

Conditions (a layer's `when`, an `if`): `"title"` (the option is set; an override object counts when it has `content`, `name`, `svg` or `src`), `{ "background": "gradient" }` (equals; an array means any of; `mode` is the palette's), `{ "not": c }`, `{ "all": [...] }`, `{ "any": [...] }`.

- **`params`** are the options a recipe reads, with defaults; a cover option of the same name overrides one. `title`, `label`, `icon` and `image` are always available. **`requires`** lists options that must be set (`["image"]`).
- **`vars`** are resolved once, in order, before the layers; their draws use the cover's recipe stream. Draws inside a layer use that layer's own stream, so adding a layer never changes another's choices.
- **Overrides by id** work exactly as for the built-ins (`grain: false`, `mesh: { blur: 30 }`), and so do extra `layers`.
- **Validation** runs when the recipe is defined, and stops at the first problem with the recipe's name, the JSON path and what to do: `Recipe "house": layers[2] (grid).blurr: "pattern" layers have no option "blurr" (kind, size, …)`, `unknown token "@bgg"`, `unknown param "subtitle" (declare it in "params", or use "{opt.subtitle}")`.
- The schema is exported as `@arraypress/covers/recipe.schema.json`, and the built-ins as `@arraypress/covers/recipes/<name>.json` to copy and edit.

All nine built-ins are JSON, with no JS fallback. The tests check that six of them render byte-identical SVG to JavaScript versions kept as a fixture, across palettes, aspects and options, object overrides included (`mark`, `diagram` and `cutout` were written as JSON from the start).

## Astro

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

## Caching

`renderImage(cover, { cache: true })` (the Astro helper's default) stores renders in `node_modules/.cache/covers`, keyed by a SHA-256 of the resolved cover: size, seed, palette, every layer option, font and image bytes (hashed by content), the format, quality and this package's version. An unchanged cover is read back instead of drawn; change anything and it renders again. Pass a directory instead of `true` to put the cache elsewhere (e.g. one your CI restores between builds).

## Performance

Measured on an Apple M3 Max, Node 26, 1200×1200 WebP at the default quality (median of 5):

| Recipe | `renderSvg` | `renderImage` | Size |
|---|---|---|---|
| aurora | <1 ms | 154 ms | 245 KB |
| gridTitle | <1 ms | 139 ms | 196 KB |
| iconTile | 2 ms | 103 ms | 37 KB |
| bigType | 1 ms | 79 ms | 32 KB |
| stripes | 1 ms | 84 ms | 69 KB |
| duotone | 21 ms | 204 ms | 159 KB |
| mark | 1 ms | 73 ms | 38 KB |
| diagram | <1 ms | 113 ms | 110 KB |
| cutout | 1 ms | 71 ms | 37 KB |

(The gradient fields are the heaviest files: saturated colour plus grain at WebP 90. See "Grain versus file size" below.)

A 1200×630 `og` card is about 70 ms. The first render in a process adds ~80 ms (HarfBuzz's WebAssembly and the fonts load once). Cached covers cost a file read.

How it rasterises, and why:

- **Blur** is SVG `feGaussianBlur`, through sharp's librsvg. librsvg clips a filter's input to the canvas, so a blur near an edge pulls in transparency and the field fades there (a vignette). `renderImage` renders each `mesh` layer on its own canvas padded by 3σ, at the smallest scale its finest blur allows (blur this heavy has no detail to lose), then crops and upscales it: full-bleed, and cheaper than the unpadded render. Browsers draw the plain SVG's filters without that clip.
- **Grain** is not. librsvg's `feTurbulence` costs ~200 ms at that size, so `renderImage` splits the stack at each grain layer: the layers below are rasterised, seeded noise (a triangular distribution, closer to film than flat noise) is blended in JS with the W3C formulas (~10 ms; sharp's own overlay blend flattens partly transparent noise to almost nothing), and the layers above are composited on top. `renderSvg` keeps `feTurbulence`, which browsers draw quickly; the two grains are matched in strength.
- **Text** is shaped by HarfBuzz (`harfbuzzjs`, a 440 KB WebAssembly build) and written as path data. opentype.js was tried first and dropped: Inter's kerning lives in GPOS extension lookups that neither its 1.x nor 2.x reads, and 2.0 throws on Inter's contextual substitutions.

**Grain versus file size.** Grain is the first thing a lossy encoder throws away. On a cover with grain, WebP quality 82 keeps about 40% of it, 90 about 60%, 94 about 78%, and the file grows each step (a dark aurora: 26 KB at 80, 60 KB at 85, 144 KB at 90; 19 KB at 90 without grain). The default is 90 for WebP (72 AVIF, 88 JPEG). For a grid of small thumbnails, `quality: 80` or `grain: false` is a quarter of the size; for crisp grain, raise it or use PNG.

## Gallery

```bash
npm run gallery
```

renders every recipe × 3 seeds × 2 palettes × 2 aspects into `examples/out/`, with an `index.html` to look through and a contact sheet per recipe. `node examples/docs-images.mjs` rebuilds the images in this README.

## Licence

MIT © ArrayPress Limited. Inter is © The Inter Project Authors, SIL Open Font License 1.1 (`fonts/OFL.txt`). The example photo is from Unsplash (`examples/CREDITS.md`) and isn't published with the package.
