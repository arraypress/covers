# Changelog

All notable changes to `@arraypress/covers` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — Unreleased

### Added

- **`cover()`, `renderSvg()`, `renderImage()`**: build-time cover images from a
  seed. The same input gives byte-identical SVG; each layer has its own seeded
  stream, so adding one never reshuffles the others.
- **Gradient fields keep to neighbouring hues** (`mesh.hueSpan`, 60° in `aurora`, `gridTitle` and `diagram`): no olive-with-teal or red-with-orange clashes. **`issue`** sets its numeral from the left, sized by digit count and cropped at the bottom only, so it reads on every aspect and never covers the "No." (new `aspect` condition and `length` operator). **Per-recipe encoding:** a recipe's `output: { lossless: true }` (dither: ~1 KB lossless against 150–240 KB lossy) and `renderImage({ lossless })`. The WebP default stays at 90.
- **Seven more recipes: `riso`, `dither`, `contour`, `waveform`, `bauhaus`, `issue`, `photo`**, on six new layers: `ink` (risograph inks with multiply, misregistration, speckle or halftone, uneven density; `RISO_INKS`), `dither` (Bayer 4×4/8×8 or noise, crisp cells), `contour` (marching-squares isolines, index and accent lines), `waveform` (peaks, or audio decoded with `@arraypress/waveform-gen` as an optional peer; demo peaks otherwise), `tiles` (a Bauhaus grid with a shared `series` rhythm) and `rule`. `mesh.from` and `extractPalette()` take colours from a photo. Titles are held to 4.5:1 and marks to 3:1 on every preset (tested).
- **`diagram`, `paper` and `scribble` layers; `diagram` and `cutout` recipes.** White line-art nodes and arrows with a dotted grid that breaks around them (layouts single / row / triangle / square / stack / hub); cut-paper shapes with scissor-cut edges; icons re-drawn by hand (SVG shapes flattened, wobbled, stroked at a drifting width) and hand-drawn node graphs. White line-art is held to 3:1 and both cutout inks to 3:1 on every preset.
- **`mesh` gains `fold` (a silk-edged second field) and `streaks`; `grain` gains `vary: 'edges'`; `pattern` gains `divisions` and `gaps`; JSON gains `tone`.** `aurora`/`gridTitle` carry no title unless given (the reference sets it under the card), vary folds/streaks per seed, and use a dotted 4×4 grid. `renderImage` renders mesh layers padded (librsvg clips filters to the canvas, which made the fields fade at the edges).
- **`mesh` is full-bleed**: long fields along a seeded direction (`arrangement: 'sweep'`, `angle`, `streak`), a gradient base between its colours (`base: 'auto'`) so the page colour never shows round the edges, and `tone` to pull colours into an OKLCH band. `aurora` and `gridTitle` retuned against openai.com/news (measured: no vignette, mid-tone fields, dashed grid); a test holds their titles to 4.5:1 on every preset. `pattern` gains `dash`.
- **Twenty-one layer types** (the newer ones above): `solid`, `linear`, `radial`, `mesh`, `stripes`,
  `image` (cover/contain, smart crop, duotone, tint), `grain`, `pattern`
  (grid, dots, lines, rings, waves, with fades), `shapes`, `icon` (Iconify
  names, raw SVG or a path, optional tile), `text` (HarfBuzz-shaped outlines,
  balanced wrapping, `maxLines` with ellipsis, `minSize` fit, label, pill) and
  `frame`.
- **Sixteen recipes** (the newer ones above and below): `aurora`, `gridTitle`, `iconTile`, `bigType`, `stripes`,
  `duotone` and `mark` (one icon on the accent or an accent gradient; white
  whenever it clears WCAG 1.4.11's 3:1 against every colour under the icon,
  else near-black; `iconColor` to force one). Any layer is customised by id: a string sets its
  content, an object merges in, `false` removes it.
- **JSON recipes**: `defineRecipe(json)`, `loadRecipe(path)`, or the document
  passed as `recipe`. Palette and canvas tokens (`@accent`, `@colors.1`,
  `@u`), vars (`$name`), option templates (`{title}`, `{opt.x}`), operators
  (`mix` in OKLab or OKLCH, `readable`, seeded `pick`/`range`/`int`,
  arithmetic, `ramp`, `taper`, `reverse`, `if`), `when` conditions, `params`
  and `requires`. Validated on definition with the JSON path in every error;
  a JSON Schema ships as `@arraypress/covers/recipe.schema.json`. All seven
  built-ins are JSON (`recipes/*.json`), tested byte-identical to the
  original JavaScript recipes.
- `palette.onAccent`, `mixOklch()`, `onBackground()` and `gradientAt()`; the
  `readable` operator's `[backgrounds, ratio, prefer]` form and
  `gradientUnder`.
- **Palettes**: nine presets, `[bg, ...colors]` arrays, partial objects, and
  `derivePalette()` from a theme's tokens (OKLCH, text at 7:1).
- **Inter** (Latin, 400/500/600/700, WOFF) bundled; any TTF/OTF/WOFF can be
  added.
- **`@arraypress/covers/astro`**: `coverEndpoint()` (`getStaticPaths` + `GET`
  for `src/pages/covers/[slug].webp.ts`) and `coverUrl()`.
- **Content-hash cache** (`cache: true` → `node_modules/.cache/covers`) and
  `coverKey()`.
