// HarfBuzz, loaded once.

/** The harfbuzzjs module (its own types need Emscripten's; covers uses a handful of its classes). */
export type HarfBuzzModule = object;

/** harfbuzzjs, with its wasm from `configure({ harfbuzz })` when given. */
export function harfbuzz(): Promise<HarfBuzzModule>;
/** harfbuzzjs where it runs (and isn't switched off), else undefined: text then uses the JavaScript outliner. */
export function shaperModule(): Promise<HarfBuzzModule | undefined>;
