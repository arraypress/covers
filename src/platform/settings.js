/**
 * Global settings: how files load, where HarfBuzz comes from, how text is
 * drawn. Set with {@link configure}.
 *
 * @module platform/settings
 */

/**
 * @typedef {object} Settings
 * @property {((src: any, info: { kind: string }) => any) | undefined} load - A loader hook; return bytes (or a Response, Blob, ArrayBuffer), or undefined to fall through.
 * @property {boolean | undefined} network - Allow fetching http(s) URLs.
 * @property {typeof fetch | undefined} fetch - The fetch to use.
 * @property {any} harfbuzz - HarfBuzz's wasm: a URL, bytes, a WebAssembly.Module, a Response, or a promise of one.
 * @property {'auto' | 'harfbuzz' | 'js'} shaper - How text is shaped and outlined.
 * @property {'outline' | 'live'} text - The default text rendering.
 * @property {((prefix: string) => string) | string | undefined} icons - Where icon sets load from outside Node: a URL template with `{prefix}`, or a function.
 */

/** @type {Settings} */
export const settings = {
  load: undefined,
  network: undefined,
  fetch: undefined,
  harfbuzz: undefined,
  shaper: 'auto',
  text: 'outline',
  icons: undefined,
};

/**
 * Configure how covers loads files, fetches, shapes text and finds
 * HarfBuzz. Settings are global and merge with what's set already.
 *
 * @param {Partial<Settings> & { fonts?: import('../index.js').FontSource[] }} options
 * @returns {void}
 *
 * @example
 * // A browser app serving the wasm itself:
 * configure({ harfbuzz: '/wasm/harfbuzz.wasm' });
 * // A Worker: no wasm compilation at runtime, so text uses the JS outliner.
 * configure({ shaper: 'js' });
 */
export function configure(options = {}) {
  for (const k of /** @type {(keyof Settings)[]} */ (Object.keys(settings))) {
    if (Object.hasOwn(options, k)) /** @type {any} */ (settings)[k] = /** @type {any} */ (options)[k];
  }
  if (options.fonts) for (const f of options.fonts) registry.push(f);
}

/** Fonts registered globally (`configure({ fonts })`, `registerFont()`). @type {import('../index.js').FontSource[]} */
export const registry = [];
