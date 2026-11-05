# Tests and gallery

## Tests

`npm test` runs the suite, including:

- **Byte identity with 1.0**: 694 covers (every built-in recipe across palettes, aspects and options, and every 1.0 layer on its own), hashed with the 1.0.0 code before any 1.1 change, must render the same SVG.
- **Effects on layers**: masks drawn from layers, and effects validated in JSON recipes (the effects themselves are tested in `@logomarks/image-effects`).
- **Every published recipe** (built-ins, `flyers/`, `release/`) validates against the schema and defines.
- **A browser smoke test** in headless Chrome over the DevTools protocol (`COVERS_CDP`, default `http://localhost:9334`; skipped without one): vector and text covers draw the same bytes as Node, the pixel layers render, `renderBlob` encodes PNG and WebP, and HarfBuzz loads its wasm from a URL.

`npm run test:worker` runs covers inside workerd with `wrangler dev` (needs wrangler).

## Gallery

```bash
npm run gallery
```

renders every recipe × 3 seeds × 2 palettes × 2 aspects into `examples/out/`, with an `index.html` to look through and a contact sheet per recipe. `node examples/docs-images.mjs` rebuilds the images in these docs.
