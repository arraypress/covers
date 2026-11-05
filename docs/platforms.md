# Running anywhere

No module imports `node:`; `renderSvg`, `renderPages`, `kit` and `lint` run in Node, browsers and Cloudflare Workers (`src/platform/`).

| | Node | Browser | Cloudflare Worker |
|---|---|---|---|
| Text | HarfBuzz | HarfBuzz (wasm) | A JavaScript TrueType reader, byte-identical to HarfBuzz on the 1.0 test set (no ligatures, CFF or variable instances) |
| Files | Paths; URLs with `network: true` | URLs, fetched | URLs, fetched |
| Raster | `renderImage` (sharp) | `renderBlob`, `rasterize` (canvas) | Return the SVG |
| `color: 'auto'` | sharp | canvas | The background colour |

```js
configure({
  harfbuzz: '/assets/harfbuzz.wasm',   // URL, bytes, WebAssembly.Module or Response
  icons: 'https://cdn.jsdelivr.net/npm/@iconify-json/{prefix}/icons.json',
  load: (src, { kind }) => assets.get(src), // return bytes, or undefined to fall through
  network: true,                        // let Node fetch URLs
  fonts: [{ name: 'Fraunces', src: '/fonts/Fraunces.ttf', weight: [100, 900] }],
});
```

Workers resolve `#harfbuzz` to a stub (harfbuzzjs compiles wasm at runtime, which Workers forbid). `@arraypress/covers/node` installs Node's modules up front (Node before 20.16). WOFF2 needs Brotli: Node has it, and browsers with `DecompressionStream('brotli')`; elsewhere (most Workers) convert it first with `node scripts/woff2-to-ttf.mjs font.woff2` (it uses this library's decoder, or fontTools / `woff2_decompress` when present), or use `render: 'live'`.
