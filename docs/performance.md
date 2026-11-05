# Caching and performance

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
| riso | 29 ms | 171 ms | 311 KB |
| dither | 3 ms | 70 ms | 156 KB |
| contour | 11 ms | 120 ms | 117 KB |
| waveform | 1 ms | 68 ms | 24 KB |
| bauhaus | <1 ms | 44 ms | 12 KB |
| issue | 1 ms | 43 ms | 16 KB |
| photo | <1 ms | 124 ms | 147 KB |

(The gradient fields and riso are the heaviest files: saturated colour or speckle plus grain at WebP 90. See "Grain versus file size" below.)

A 1200×630 `og` card is about 70 ms. The first render in a process adds ~80 ms (HarfBuzz's WebAssembly and the fonts load once). Cached covers cost a file read.

How it rasterises, and why:

- **Blur** is SVG `feGaussianBlur`, through sharp's librsvg. librsvg clips a filter's input to the canvas, so a blur near an edge pulls in transparency and the field fades there (a vignette). `renderImage` renders each `mesh` layer on its own canvas padded by 3σ, at the smallest scale its finest blur allows (blur this heavy has no detail to lose), then crops and upscales it: full-bleed, and cheaper than the unpadded render. Browsers draw the plain SVG's filters without that clip.
- **Textures are image tiles.** The riso speckle and halftone are small PNG tiles in an SVG `<pattern>`, and dithers are one PNG pixel per cell scaled with `image-rendering: pixelated` (a minimal in-library PNG encoder, so no sharp needed for SVG). Two librsvg slow paths are avoided on purpose: a pattern of one shape per cell (~1.5 s a canvas) and a mask under a transform (~10×), which is why misregistration moves the shapes, not the texture.
- **Grain** is not. librsvg's `feTurbulence` costs ~200 ms at that size, so `renderImage` splits the stack at each grain layer: the layers below are rasterised, seeded noise (a triangular distribution, closer to film than flat noise) is blended in JS with the W3C formulas (~10 ms; sharp's own overlay blend flattens partly transparent noise to almost nothing), and the layers above are composited on top. `renderSvg` keeps `feTurbulence`, which browsers draw quickly; the two grains are matched in strength.
- **Filters at release size.** libvips hands librsvg large documents in a way that makes filter-heavy SVGs slow far past their pixel count (a 3000² displacement map: ~28 s in one piece, ~5 s as tiles), so `renderImage` draws an SVG with filters past ~2.4 MP as 1024 px tiles in parallel, each with a margin round it so blurs and displacements see across the seam. It also splits `feMorphology` into an x pass and a y pass (the same max, O(r) not O(r²)), and shrinks a filter's region to the box the layer paints when the chain can't paint outside its source (worked out from the primitives). Dithers are computed on pixels. Together these took the slowest release covers from minutes to seconds (see the CHANGELOG).
- **Pixel effects** (spin, zoom, bokeh, distortions…) draw the layer once at its output pixels and work on typed arrays: polar resampling with running sums for spin and zoom (a long blur costs no more than a short one), an aperture convolved a row at a time from running totals for bokeh, and wide blurs on smaller copies. A full 3000² `renderImage` of a photo with any one effect takes 0.4–2.8 s (median 0.8 s; the photo alone 0.4 s); the slowest are `newsprint`, `motion` and `halftone`.
- **Text** is shaped by HarfBuzz (`harfbuzzjs`, a 440 KB WebAssembly build) and written as path data. opentype.js was tried first and dropped: Inter's kerning lives in GPOS extension lookups that neither its 1.x nor 2.x reads, and 2.0 throws on Inter's contextual substitutions.

**Grain versus file size.** Grain is the first thing a lossy encoder throws away. On a cover with grain, WebP quality 82 keeps about 40% of it, 90 about 60%, 94 about 78%, and the file grows each step (a dark aurora: 26 KB at 80, 60 KB at 85, 144 KB at 90; 19 KB at 90 without grain). **The default stays at WebP 90** (72 AVIF, 88 JPEG): the owner compared 80 and 90 on the gallery and 80 visibly loses the grain and starts to band the gradients. For a grid of small thumbnails, pass `quality: 80` or `grain: false` knowingly; for crisp grain, raise it or use PNG.

**Lossless where it wins.** A recipe can declare the encoding it prefers (`"output": { "lossless": true }` in its JSON; `renderImage` options still win). `dither` does: it's flat 1-bit art, so lossless WebP is both exact and tiny, while lossy WebP smears the cells. Measured at 1200×1200:

| Recipe | PNG | WebP lossless | WebP q90 | WebP q80 |
|---|---|---|---|---|
| dither (3 palettes) | 42–45 KB | **~1 KB**, exact | 153–240 KB, 3–5% of pixels wrong | 125–196 KB, 3.5–5% wrong |
| contour (3 palettes) | 808–1074 KB | 511–661 KB | **145–183 KB**, visually exact | 101–135 KB |

Contour carries grain, so it stays lossy like the rest. Pass `lossless: true` to `renderImage` for any cover.
