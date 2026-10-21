# Changelog

All notable changes to `@arraypress/covers` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — Unreleased

### Added

- **`cover()`, `renderSvg()`, `renderImage()`**: build-time cover images from a
  seed. The same input gives byte-identical SVG; each layer has its own seeded
  stream, so adding one never reshuffles the others.
- **Twelve layer types**: `solid`, `linear`, `radial`, `mesh`, `stripes`,
  `image` (cover/contain, smart crop, duotone, tint), `grain`, `pattern`
  (grid, dots, lines, rings, waves, with fades), `shapes`, `icon` (Iconify
  names, raw SVG or a path, optional tile), `text` (HarfBuzz-shaped outlines,
  balanced wrapping, `maxLines` with ellipsis, `minSize` fit, label, pill) and
  `frame`.
- **Seven recipes**: `aurora`, `gridTitle`, `iconTile`, `bigType`, `stripes`,
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
