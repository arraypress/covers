# Changelog

All notable changes to `@arraypress/covers` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] — 2026-11-05

Flyers, posters, release art, social formats and print stationery, in Node, browsers and Cloudflare Workers. Every 1.0 cover renders byte-identical SVG (694 covers checked against hashes taken with the 1.0.0 code).

### Added

- **Runs anywhere.** No module imports `node:` any more: Node's built-ins are found with `process.getBuiltinModule` (or installed by the new `@arraypress/covers/node` entry), Inter and the built-in recipes are plain modules, PNG and WOFF use `CompressionStream` / `DecompressionStream` outside Node, and cache keys use Web Crypto (same keys). `configure({ load, network, fetch, harfbuzz, shaper, icons, fonts })`: a loader hook for images, fonts, audio and icon sets; URLs fetched in browsers and Workers (in Node only when allowed, as before); HarfBuzz's wasm from a URL, bytes, a `WebAssembly.Module` or a `Response`.
- **A JavaScript TrueType outliner** (`cmap`, `hmtx`, `glyf` with composites, GPOS and `kern` pair kerning) for Cloudflare Workers, where harfbuzzjs can't run (it compiles wasm at runtime). `#harfbuzz` resolves to a stub under the `workerd` / `worker` conditions so wrangler never bundles it. Byte-identical to HarfBuzz on all 694 test covers.
- **`renderBlob()` / `rasterize()`**: PNG, JPEG or WebP in the browser through a canvas.
- **Fonts by `src`** (path, URL, loader) as well as bytes; `registerFont()`; variable fonts (`weight: [100, 900]`, per-layer `axes`).
- **Poster type** on the `text` layer: baseline placement (`x`, `y`), justification to a width (`width`, `lengthAdjust`), `fit: 'width' | 'lines' | 'shrink'`, `stretch`, `axes`, outline type and stacked keylines (`fill`, `stroke`, `strokes`), text on a path (circle, arc, ellipse, wave, any `d`; `fitPath`), `color: 'auto'` (white or near-black against what's drawn underneath), and `render: 'live'` (`<text>` with `@font-face`).
- **Every layer** takes `transform`, `effects`, `knockout`, `clip`, `mask` and `area`.
- **Effects**: `blur`, `motion` (directional), `shadow`, `glow`, `border` (die-cut), `wear` (riso), `rough`, `warp`, `xerox`, `photocopy`, `duotone`, `grayscale`, `levels`, `saturate`, `matrix`, `grit`, `halftone` (any screen angle), `dither` (Bayer), `threshold`, and a raw `filter` escape hatch.
- **Eight layers**: `group` (a nested stack on its own design grid), `shape` (fifteen exact shapes, deckled and torn edges, gradient paints including reflected foil), `svg` (raw markup with `{{slot}}` and palette tokens, sanitised), `table` (meta grids, lineups, tracklists), `barcode` (real Code 128), `perforation`, `tear` (torn paper with fibres) and `texture` (paper, creases, concrete, speck, wood, folds, dust). `icon` takes a mark's `markup` and `x`/`y`; `image` takes an explicit box and `fit: 'stretch'`.
- **Formats** (`format`, `FORMATS`): release cover 3000×3000, Spotify Canvas, Bandcamp header, Instagram post/square/story/reel, TikTok cover, YouTube thumbnail and channel art, X, LinkedIn, Facebook, Twitch, Discord and Bluesky banners, Pinterest, avatars, Open Graph, a 4:5 flyer, A6–A2, business cards (85×55 mm and 3.5×2 in), letterhead (A4, US Letter), compliment slips, stickers, tickets, badges and lanyard passes. Screen formats carry their **safe zones** (sourced; anchored text and icons are laid out inside them; `@safeX`… tokens; `overlay: true` previews them). Print formats render at a `dpi` with **bleed**, a **safe** margin, optional **crop marks** and a **die line**.
- **Two-sided pieces**: `pages` in a recipe, `when: { page: 'back' }`, `renderPages()`.
- **`kit(brand, { formats, recipe })`**: a brand kit in one call, and a built-in **`brand`** recipe that lays a brand out on every format.
- **`lint(cover, { target: 'spotify' })`**: Spotify's artwork requirements and distributors' content rules (URLs, handles, contact details, prices, promo wording, dates, platform names, barcodes, metadata), text too small for a 64 px thumbnail, upscaled images.
- **Animation, designed in**: any option can be keyframed against `t`, and `renderSvg(cover, { t })` draws that frame (static covers ignore it); `loop`, `valueAt()`. Video encoding is a later phase.
- **JSON recipes**: brand and event slots (`{name}`, `{mark}`, `{photo}`, `{cutout}`, `{lineup.0}`…), `join` / `upper` / `lower` / `slice`, `format` and `page` conditions, print and safe-zone tokens, nested layers validated.
- Tests: byte identity with 1.0, a headless-Chrome smoke test, and an opt-in Workers test (`npm run test:worker`). `examples/recipes/` re-expresses ~45 flyers and 16 release-cover styles as JSON.

- **Repeat and reuse.** `repeat` draws a layer on a grid, round a ring or along a line, with `{#…}` expressions per instance (`i`, `row`, `col`, `odd`, `angle`, …; a small parser, no `eval`), `odd` and `cycle` overrides and `skip`. `defs` names layers and `use` draws them again, placed (one drawing, referenced), or with `with` overrides.
- **Type.** `spans` (mixed runs on one line: font, weight, size, colour, baseline shift), `glyphs` (per-glyph scale, shift, turn and colour arrays: bulging 70s type is one layer, and lint counts it as one text), `font: 'pixel'` (a built-in 5×7 face as merged cells), glyph fallback (`fallback`, fonts registered with `fallback: true`, then built-in ✺ ✦ ✶ ★ ☆ ♥ ♡ ▶ ◀ ● ◆ ■ ♪), `fit: 'words'` and `'wrap'`, `split: 'words'`, `maxHeight`, `dash` on strokes, `extrude`, and `{layout.<id>.bottom + 12}` so a later layer sits under a wrapped block.
- **Paints** for shapes, text and icons: elliptical radial gradients (`rx`, `ry`) with per-stop opacities, `tile` patterns (checker, stripes, dots, grid, custom), and presets `chrome`, `steel` and `gold` (a reflected horizon with its keyline, how good Y2K chrome is painted). `icon` takes `fill`.
- **Shapes**: `rotate` about an `origin`, open arches (`open`), `soft` (a blur drawn padded: no edge fade, no square edge), `dashOffset`, and `kind: 'cut'` (the print format's die-cut, `outset`).
- **Effects**: `extrude` (an n-step offset in a darker colour, replacing stacks of copies), `border` with `shape: 'circle'` (a round sticker backing), and `colorSpace: 'sRGB' | 'linearRGB'` on every filter effect.
- **Print cuts**: `cut` takes `{ radius }` (mm) or `{ d, viewBox }`; tickets and lanyard passes have rounded corners; the die line follows it.
- **Fonts**: WOFF2 is outlined (Brotli from Node's zlib or a browser's `DecompressionStream('brotli')`; glyf, loca and hmtx rebuilt in JavaScript, outlines identical to the TTF builds); recipes declare their fonts (`"fonts": [{ name, src, weight }]`, paths beside the recipe); `scripts/woff2-to-ttf.mjs` for runtimes without Brotli.
- **`svg` slots** take markup: `{{mark}}` between elements goes in as sanitised shapes (paths and basic shapes, geometry and paint attributes); anything else is still escaped.

- **Image filters: 50 new effects**, on any layer or group, each data-first (validated by `defineRecipe`, seedable where random). Filters stay SVG (vector, sized in the layer's units); what filters can't do is computed on pixels: the layer is drawn once at the pixels it's shown at (sharp in Node, tiled past a few megapixels; a canvas in the browser, so `renderBlob` and `rasterize` get them too), processed on a typed array and embedded as one image. One module per family in `src/effects/`, with shared pixel helpers (`buffer.js`) and the runner (`pixels.js`).
  - **Blurs** (pixels): `zoom` (radial), `spin` (rotational: both resampled into polar coordinates and blurred with running sums, so a long blur costs no more than a short one; the centre pixel never moves), `tilt` (tilt-shift: a sharp band, the blur growing beyond it, `saturate` for the miniature look), `lens` (lens blur in linear light with highlights boosted into bokeh discs or `blades`-sided polygons, the aperture convolved a row at a time from running sums).
  - **`mask` on every effect**: `{ gradient: 'linear' | 'radial' | 'band', from, to, center, angle, aspect, invert, ease }` or `{ layers }` (their luminance). An exact mix of before and after: inside the filter (a small greyscale mask image), or per pixel. "The left half motion-blurred, the face sharp" is one effect.
  - **Distortions** (pixels): `wave`, `ripple`, `twirl`, `bulge`, `pinch`, `fisheye`, `glass` (`frosted`, `reeded` (fluted), `pebbled`), `displace` (seeded noise, or the luminance of any layers: a texture, a photo, type), `kaleidoscope` (the frame filled by reflection), `stretch` (pixel stretch), `sort` (pixel sorting by luminance, hue or saturation). `mirror` (vector copies).
  - **Colour** (filters): `curves` (monotone cubic, per channel), `gradientMap` (any stops, sRGB or OKLab), `posterize`, `invert`, `hue` (hue, saturation, lightness), `colorBalance` (shadows, midtones, highlights), `channelMixer`, `sepia`, `look` presets (`fade`, `crossProcess`, `bleachBypass`, `tealOrange`, `warmFilm`, `coolFilm`, `noir`, with `amount`); `vibrance` on pixels. `levels` takes Photoshop's `black`, `white`, `gamma` and `output`.
  - **Light**: `bloom`, `halation`, `vignette` (`ellipse`, `circle`, `rect`; size, softness, colour), `lightLeak`, `lensFlare` (glow, halo, ghosts, optional anamorphic streak: drawn from small greyscale sprites the filter scales and tints), `rays` (god rays on pixels: occluders cast shafts).
  - **Texture and print**: `grain` (film grain overlaid, monochrome or colour), `paper` (`paper`, `canvas`), `scanlines`; on pixels `dust` (specks, hairs, scratches), `crt` (aperture or shadow mask, scanlines, curvature), `vhs` (chroma smear and shift, line jitter, tracking noise), `jpeg` (a real JPEG encoder, blocks at any size, re-saves), `newsprint` (CMYK process halftone with rosettes). `halftone` takes a `shape`: `dot`, `line`, `square`, `diamond`, `cross`.
  - **Digital**: `chromatic` / `rgbSplit` (directional as a filter; `mode: 'radial'` on pixels), `glitch` (channel shift, torn slices, displaced blocks), `pixelate` / `mosaic` (`square` cells embedded at one pixel a cell; `hex`), `ascii` (the built-in pixel face's glyphs by ink, in the source's colours or one ink), `edges` (`ink` or `glow`), `sketch` (pencil), `emboss`, `sharpen` (unsharp mask).
  - `EFFECT_OPTIONS` lists every kind's options (validation, the JSON Schema's autocomplete, the README table). Where nothing can draw pixels (a Worker) `lens` falls back to a Gaussian blur, `tilt` to one through its band, and the other pixel effects are left out.

### Fixed

- **`motion` blurred in every direction at any angle but 0 in `renderImage`**: librsvg can't apply a one-axis `feGaussianBlur` under a rotation. `renderImage` now draws motion blur on pixels (in a frame turned to the angle, with the edge held, so a full-bleed photo no longer fades at its edges); `renderSvg` keeps the filter, which browsers draw correctly.
- **WOFF2 fonts with a large `glyf` lost glyphs past 128 KB** (Doto drew no digits and no "/"): the decoder rebuilds `glyf` plainly, a word a coordinate, so it can outgrow the font's short `loca`, whose offsets then wrapped. It now writes a long `loca` (and says so in `head`) when the table needs one; decoded glyphs, metrics and cmap match fontTools on both Doto builds. A generated WOFF2 with composite digits past the limit is in the tests.
- **`fit: 'words'` (and `'width'`, `'wrap'`) with a `width` stretched every line to the full width** (a lone "&" became a bar). Under those fits only the widest line fills the width, as documented; the others keep their natural width. `width` without a fit still justifies every line.
- **Images in a `viewBox` group were resampled at design-unit size** (a 400-wide grid embedded a photo 400 px across, however large the output): images now resample at the pixels they're drawn at, through every group and transform scale. They're embedded at no more than the source's pixels (the SVG scales up), and as JPEG when an alpha channel is unused, so two full-bleed photos no longer overflow librsvg's parser at 3000 px. (A top-level image under 4 MP keeps 1.0's box-sized embed, so 1.0 covers stay byte-identical.)
- Text on the poster typesetter dropped its `opacity` and `blend`.
- The `filter` sanitiser rejected `specularExponent`, `diffuseConstant` and `exponent` (it matched `on…=` inside names); it now matches attribute names that start with `on`.
- `feDropShadow` ignored its `in` in librsvg (a felt texture vanished under its own shadow): it's spelled out as primitives.
- A dither with a transform on the same layer rendered as a solid colour in `renderImage`.
- A group's own effects, clips, masks and knockouts used the parent's coordinates: with a `viewBox` they now work in the group's grid, so their numbers (noise frequency, wobble) look the same at every output size.
- `shape` `path`s with a `viewBox` rotated about the wrong point.
- Recipe validation now checks anchor names (`'bottom-center'` failed only at render).
- `color: 'auto'` picked black on mid-tones (a mid-pink photo) where designers set white: it now uses the site's rule, luma above 0.72 takes the dark colour (`autoThreshold`).
- `lint`: no more false positives for store names that are words ("Tidal Archive": only with a cue or on their own), day names in titles ("Second Sun": short names only beside a number), or text spelled from the metadata a letter or a knocked-out word at a time. Legibility measures the whole block as drawn (every line, stretch, justification, group and transform scale), and `upscaled` measures images through groups and transforms (and flags embeds smaller than drawn).

### Performance

`renderImage` at release size (3000×3000) takes seconds where it took minutes. Rendering every ported flyer and style (104 covers) went from 2662 s to 156 s; the slowest cover is now 11 s. Some before → after: `lofi-hexmoth` 609 → 0.9 s, the three `chrome` styles ~235 → 1.5 s, `ferrova` 220 → 1.1 s, `velora-stickers` 182 → 6.3 s, `lofi-lowbit` 145 → 1.6 s, the riso flyers ~67 → 9 s, the `riso` styles ~46 → 6 s.

- SVGs with filters past ~2.4 MP render as parallel 1024 px tiles, each with a margin as wide as the furthest any filter reaches (effects report it at their own resolution); one render cost 5–6× its pixel count.
- `feMorphology` (the die-cut `border`) is split into an x and a y pass: the same result, O(r) instead of O(r²).
- Filter regions shrink to the box the layer paints, when the chain provably can't paint outside its source.
- `dither` is computed on pixels: the layer drawn once at one pixel per cell, thresholded in JavaScript, embedded nearest-neighbour (the filter's pixelation ran at output size).

### Known limits

- `wear`, `xerox`, lighting and displacement filters are still librsvg's own primitives: a full-bleed two-ink riso cover is ~6–9 s at 3000×3000 (from about a minute). Browsers draw the same SVG far faster. `halftone` stays a filter (it wasn't the bottleneck once tiled).
- WOFF2 needs Brotli: Node has it; most Workers don't (convert to TTF with `scripts/woff2-to-ttf.mjs`).

### Changed

- `engines` stays Node 20; on Node before 20.16 import `@arraypress/covers/node`.
- Cache keys include the version, so 1.0 caches render again once.

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
