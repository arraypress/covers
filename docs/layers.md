# Layers

Layers paint bottom first. Every option has a default drawn from the palette, the canvas and the layer's own seeded stream, so `{ type: 'mesh' }` alone is a finished background. Every layer also takes `id` (for overrides), `seed` (its own stream), `opacity` and `blend` (a CSS `mix-blend-mode`), and:

| Option | |
|---|---|
| `transform` | `{ translate, rotate, scale, skewX, skewY, mirror: 'x' \| 'y', origin }` about `origin` (`[x, y]` px; default the centre). Misregistration is `{ translate: [1.8, -1.3], rotate: 0.25 }`; a reflection is `{ mirror: 'y' }`. On a `text` layer, `transform: 'uppercase'` is still the case. |
| `effects` | `[{ kind, … }]`: filters, pixel effects and copies, applied in order, each with an optional `mask` (see [Effects](effects.md)). |
| `knockout` | Layers cut out of this one: knockout type and marks, punched holes. Whatever they paint is cut, whatever colour they are. |
| `clip` | Layers this one shows only inside (a photo in a circle, in type). |
| `mask` | Layers whose luminance masks this one (a white-to-black `linear` fades it). |
| `area` | Draw the layer in a box: `'trim'` or `'safe'` (print), or `{ x, y, width, height }` fractions. |
| `motion` | Move in the SVG itself: a motion, a preset name, or a list (see [Animation](animation.md)). |

`blend` and `opacity` go on the outermost group, so a masked or filtered layer still blends with what's under it (two riso inks overprint).

A layer's random stream is keyed by its `seed`, else its `id`, else its type and position among layers of that type, so adding a layer never reshuffles the others.

## `solid`
`color` (default `bg`).

## `linear`
`colors` (default the first two palette colours), `opacities` (per stop), `angle` (CSS degrees, 0 = up; default seeded), `ease` (default `true`: smoothstep stops mixed in OKLab, so there's no hard edge where the gradient starts and ends).

## `radial`
`colors` (centre → edge; default `[colors[0], bg]`), `x`, `y` (default seeded), `radius` (default `'80vmax'`), `ease`.

## `mesh`
Full-bleed fields of blurred colour: the mesh-gradient look.

| Option | Default | |
|---|---|---|
| `colors` | the palette's | |
| `hueSpan` | — | Neighbouring hues only: keep the colours within this many degrees of OKLCH hue (blue with violet, teal with blue, orange with pink), turning the first colour's hue to make neighbours when the palette has too few. The gradient recipes use 60. |
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
| `from` | — | A photo (path or bytes): take the colours from it (needs sharp; see `extractPalette`). |
| `base` | `'auto'` | Under the fields: a gradient across the sweep between the first two colours, so colour reaches every edge and corner. Or `'bg'`, a colour, or `null`. |
| `blobs` | — | `[{ x, y, r, squash, rotate, color, opacity }]` to place them yourself. |

## `stripes`
`direction` (`'vertical'` default, `'horizontal'`, `'diagonal'` + `angle`), `count` (8), `widths` (`'even'`, `'random'`, `'taper'` with `taper` ratio 0.78, or weights like `[3, 2, 1]`), `colors` (cycled), `gap`, `radius`, `region` (fractions; default the whole canvas), `regionRadius`.

## `image`
`src` (a local path, a `data:` URI or bytes; URLs are refused), `fit` (`'cover'` / `'contain'`), `focus` (an anchor, or `'attention'` / `'entropy'` smart crops), `region`, `duotone` (`true` derives shadow and highlight from the palette, or `[shadow, highlight]`), `grayscale`, `normalize` (stretch tones first; on by default with duotone/grayscale), `tint` (a colour, or `{ color, amount, blend }`), `blur`.

With sharp installed the image is cropped and resized before embedding, at the pixels it's drawn at (its box times any group and transform scale above it), never past the source's own pixels (the SVG scales it up instead). An unused alpha channel embeds as JPEG; PNG only where there's transparency. Without sharp, PNG, JPEG and SVG are embedded as they are.

## `grain`
`amount` (0.08), `size` (px per grain, 1), `monochrome` (`true`), `vary` (`'edges'`: heavier toward the edges and corners, like spray paint), `blend` (`'overlay'`; also `'soft-light'`, `'multiply'`, `'screen'`, `'normal'`).

## `pattern`
`kind`: `'grid'` (default), `'dots'`, `'lines'` (+ `angle`), `'rings'`, `'waves'` (+ `wavelength`, `amplitude`). `size` (cell; `'8.33vmin'`), `stroke`, `color` (`text`), `opacity` (0.14), `center` (rings and grid alignment), `fade` (`'none'`, `'radial'`, `'edges'`, `'top'`, `'bottom'`, `'left'`, `'right'`), `dash` (`'dashed'`, `'dotted'` or `[on, off]`), `divisions` (grid/lines: N equal cells, inner lines only, instead of `size`), `gaps` (regions the lines break around), `region`.

Grid lines are drawn across the canvas, not as an SVG `<pattern>` (which clips a line on a tile edge to half its width), and centred.

## `shapes`
`kind` (`'circle'`, `'square'`, `'pill'`, `'mixed'`), `count` (6), `size` (`['7vmin', '20vmin']`), `colors`, `placement` (`'scatter'` spreads them out avoiding overlaps; `'row'`, `'column'`), `items` (`[{ kind, x, y, size, color, rotate, opacity }]`), `region`, `rotate`, `radius` (squares, fraction of size), `outline` (`true` or a width).

## `icon`
One of `name` (Iconify: `'lucide:feather'`, `'simple-icons:github'`), `svg` (a raw SVG string; scripts and handlers are stripped) or `path` (+ `viewBox`). `size` (`'24vmin'`, `'15vmin'` on a tile), `color` (the accent on a tile, else `text`), `fill` (a gradient, tile or preset [paint](effects.md#paints) instead), `strokeWidth`, `anchor`, `position`, `offset`, `margin`, and `tile` (`true` or `{ size, radius, color, shadow: 'soft' | 'none', border }`).

Named icons load from `@iconify-json/<prefix>` (resolved from your project), or from a set you pass to `registerIcons()`.

## `text`
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

## `diagram`
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

## `paper`
Cut-paper shapes: the outline is resampled into short straight cuts, each nudged off the line (seeded), so edges are irregular but never blurry. `count` (4, laid out as a loose collage), `kind` (`'mixed'`, `'rect'`, `'square'`, `'circle'`, `'blob'`, `'arch'`, `'pill'`), `color` (`#faf9f5`), `region` (the middle 60%), `items` (`[{ kind, x, y, width, height, size, rotate, color }]`), `wobble` (0.5).

## `scribble`
A hand-drawn line: an `icon` re-drawn by hand (its outline flattened, wobbled with smooth seeded noise, stroked in short runs whose width drifts, round caps), or `graph` (`true` or `{ nodes, dot }`: a polyline with filled dots). `color` (`#faf9f5`), `stroke` (`'1.3vmin'`), `size` (`'46vmin'`), `position`, `wobble` (0.5).

## `ink`
One risograph ink: flat `shapes` (`circle`, `ring`, `half`, `arch`, `band`, `rect`, or `text` with any text-layer options), printed with `multiply` (`screen` on dark paper) and slightly misregistered (`offset`, default seeded 0.3–1% of the short side). `color` is a colour or a classic ink by name: `'riso:pink'`, `blue`, `yellow`, `teal`, `red`, `green`, `orange`, `purple`, `navy`, `black` (`RISO_INKS`, approximations). `texture`: `'grain'` (speckle where the paper shows through; `speckle` 0.09), `'halftone'` (`cell`, `dot`, `angle` 0 or 45) or `'none'`. `density` (`[0.78, 1]`): the ink thins across the sheet.

## `dither`
A soft field rendered 1-bit at a visible pixel size (`cell`, `'0.9vmin'`): `source` (`'field'` noise, `'linear'`, `'radial'`), an optional `shape` (`'sphere'` lit from the upper left, `'circle'`, `'arch'`; `size`, `center`), `matrix` (`'bayer4'`, `'bayer8'`, `'noise'`), `colors` (`[ground, ink]`, or three for two dithered bands), `gamma`, `range`. It's a tiny PNG (one pixel per cell) drawn with `image-rendering: pixelated`, so the cells stay crisp at any size and the SVG stays small.

## `contour`
Topographic isolines of seeded noise (marching squares, joined and smoothed): `levels` (20), `color` and `stroke`, `opacity` (0.5), `index` (every Nth line thicker, 5), `highlight` (one level in the accent; seeded, or a number, or `false`), `scale`, `octaves`, `resolution`.

## `waveform`
An episode's waveform: `peaks` (any scale), or `audio` (a file decoded at build with [`@arraypress/waveform-gen`](https://www.npmjs.com/package/@arraypress/waveform-gen), an optional peer). `style` (`'mirrored'`, `'bars'`, `'line'`, `'dots'`), `bars` (88), `gap`, `round`, `color`, `region`, `caption` (`true` for the duration, from the audio or `duration`, or any text). **With neither peaks nor audio it draws seeded demo peaks** — a placeholder, not your audio.

## `tiles`
A Bauhaus grid: each cell a ground with one shape (`quarter`, `half`, `circle`, `square`, `triangle`), rotated by quarters, in `colors` plus `ground`. `series` seeds the grid's rhythm (columns, rows and a merged 2×2 cell), so covers in a series share a family look while each cover's seed fills the cells. `cols`, `rows`, `kinds`, `merge`, `region`.

## `rule`
A hairline: `y` (fraction), or `from` / `to` points; `inset`, `color`, `stroke`.

## `frame`
`inset` (`'3.5vmin'`), `radius` (`'2vmin'`), `stroke` (`'0.15vmin'`), `color` (`text`, at opacity 0.22), `fill` (a colour, to make a card).

## Poster type (`text`, 1.1)
The `text` layer takes these as well. Any of them switches it to the poster typesetter (1.0 text is unchanged, byte for byte).

| Option | |
|---|---|
| `x`, `y` | The first baseline, like SVG `<text x y>`; `align` acts as the anchor (`'right'` sets the end at `x`). No wrapping unless `maxWidth` is given. |
| `width` | Justify every line to exactly this width (`textLength`). `lengthAdjust: 'spacing'` opens the letter-spacing instead of scaling the glyphs. `justify: true` uses `maxWidth`. |
| `fit` | `'width'`: size the block so its widest line fills `width`; `'lines'`: size every line on its own to fill it (the stacked full-width headline); `'words'`: a word a line, the widest filling `width`; `'wrap'`: wrap at the width, then size every line so the widest fills it; `'shrink'`: shrink before wrapping. `split: 'words'` puts a word on each line without fitting; `maxHeight` shrinks a block taller than it. |
| `spans` | `[{ content, font, weight, style, axes, scale, size, color, letterSpacing, dy }]` instead of `content`: mixed runs on the same lines (a `\n` starts a new one). |
| `glyphs` | Per-glyph arrays, cycled and counted across the block (spaces skipped): `scale`, `scaleX`, `scaleY`, `dx`, `dy`, `rotate`, `color`; `origin: 'center' \| 'baseline'`; a scaled glyph takes its scaled width unless `advance: false`. Bulging 70s type is one layer. |
| `font: 'pixel'` | A built-in 5×7 pixel face (A–Z, 0–9, punctuation), drawn as merged cells; everything else here works on it. |
| `fallback` | A family (or list) for characters the font lacks; then fonts registered with `fallback: true`; then built-in shapes for ✺ ✦ ✶ ★ ☆ ♥ ♡ ▶ ◀ ● ◆ ■ ♪. |
| `extrude` | A depth, or `{ depth, angle, color, to, steps }`: block extrusion (the [`extrude`](effects.md) effect). |
| `dash` | Dashes on `stroke` (and `dash` on each of `strokes`): stitching. |
| `stretch` | `[sx, sy]` (or `sy`) about the first baseline: condensed and stretched display type. |
| `axes` | Variable-font axes: `{ wdth: 50 }`, `{ SOFT: 100, WONK: 1, opsz: 144 }`, `{ YEAR: 1979 }`. A variable font's `wght` follows `weight`. |
| `content` | An array is one line per item. |
| `fill`, `stroke`, `strokeWidth` | `fill: 'none'` with a `stroke` is outline type; `fill` takes gradients. |
| `strokes` | `[{ color, width, dash }]`: keylines under the fill, widest first (varsity lettering). A preset paint (`fill: { preset: 'chrome' }`) brings its own. |
| `path` | Text on a path: `{ kind: 'circle' \| 'arc' \| 'ellipse' \| 'wave', cx, cy, r, start, end, direction }` or `{ d }`. `startOffset` (0–1 or px; 0.5 centres), `fitPath` (space it round a ring; a length leaves a gap), `dy`. |
| `color: 'auto'` | White or near-black by what's drawn underneath (rendered small and averaged: sharp in Node, a canvas in a browser, the background colour in a Worker): luma (Rec. 601) above 0.72 takes the dark colour, as designers set it (a mid pink takes white). `autoColors: [light, dark]`, `autoThreshold`. |
| `{layout.<id>.<field>}` | Any later layer can place itself by where a text block landed: `bottom`, `top`, `left`, `right`, `width`, `height`, `x`, `y`, `baseline`, `size`, `lines`, plus or minus a number (`"y": "{layout.title.bottom + 12}"`), in the text layer's units. |
| `render: 'live'` | `<text>` with the font embedded by `@font-face` (or linked by URL when it came from one): selectable, fast in a browser, laid out the same. |

## Poster layers

Coordinates in px of the layer's canvas (or its group's `viewBox`), or `'50%'`. Every option is documented in the layer's module (`src/layers/*.js`).

| Layer | Draws | Main options |
|---|---|---|
| `group` | A nested stack on its own design grid | `layers`, `viewBox`, `x` `y` `width` `height`, `fit`, `align` |
| `shape` | One exact shape, or `items` | `kind` (rect, circle, ellipse, line, polygon, polyline, star, burst, scallop, rays, ring, sector, arch, wave, path, `cut`: the print format's die-cut, `outset`), `fill`/`stroke` ([paints](effects.md#paints)), `edge` (deckle, torn, zigzag, wave, scallop), `strokes`, `dash`, `dashOffset`, `rotate` (about the centre, or `origin`), `open` (an arch as an arc), `soft` (a blur drawn padded: no edge fade, no square edge) |
| `repeat` | A layer many times | `layer` (or `layers`); a grid (`rows`, `cols`, `step`), a ring (`count`, `cx`, `cy`, `radius`, `start`, `sweep`, `turn`) or a line (`count`, `step`). `{#…}` expressions per instance (`i`, `n`, `row`, `col`, `x`, `y`, `angle`, `odd`; `+ - * / %`, `? :`, `min` `max` `abs` `floor` `round` `sin` `cos` `pick`); `odd` and `cycle` overrides; `skip` |
| `defs`, `use` | A named stack drawn again | `defs.layers` (each with an `id`; nothing drawn); `use`: `ref`, `x`, `y`, `rotate`, `scale` (or `place`, a transform), `with` (overrides for that copy). A plain use is the same markup referenced |
| `svg` | Raw markup: the escape hatch | `markup`, `defs`, `viewBox`, `fit`; tokens `{{@accent}}`, `{{id}}`, `{{seed}}`, and `{{name}}` slots in JSON recipes (a markup value such as `{{mark}}` between elements goes in as sanitised shapes; anything else is escaped). Scripts, handlers and links out are stripped |
| `table` | Meta grids, lineups, tracklists | `rows`, `columns` (`x`, `align`, `key`, style), `x`, `y`, `size`, `rowHeight`, `header`, `rules` |
| `barcode` | Real Code 128, or decorative bars | `value`, `kind`, `x` `y` `width` `height`, `text` |
| `perforation` | A tear-off line | `kind` (holes, dashes, notches), `x1` `y1` `x2` `y2`, `size`, `gap`; punches holes inside a `knockout` |
| `tear` | Paper torn on a jagged line | `from`, `to`, `side`, `color`, `rip`, `fibres`, `step`, `jitter` (same `seed` on two layers: one tear) |
| `texture` | Surfaces | `kind` (paper, creases, concrete, speck, wood, folds, dust), `color`, `frequency`, `region` |

`icon` also takes `markup` (a mark's paths on a 512 grid) and `x`, `y`; `image` takes `x` `y` `width` `height`, `fit: 'stretch'` and URLs where fetching is allowed. A cut-out subject is another `image` above the masthead.
