/**
 * HarfBuzz, loaded once and lazily, with its WebAssembly from wherever
 * `configure({ harfbuzz })` says. `#harfbuzz` is harfbuzzjs, except under
 * the `workerd` / `worker` conditions, where it's a stub that fails, and
 * text falls back to the JavaScript outliner.
 *
 * @module platform/harfbuzz
 */

import { isBytes } from './bytes.js';
import { settings } from './settings.js';
import { loadBytes, asBytes } from './load.js';

/** @type {Promise<any> | undefined} */
let hbPromise;

/**
 * Load harfbuzzjs. With `configure({ harfbuzz })` its WebAssembly comes from
 * there (a URL, bytes, a compiled Module or a Response) instead of the file
 * next to harfbuzzjs, which a bundler may not have copied.
 *
 * harfbuzzjs creates small wasm trampolines at runtime (Emscripten's
 * `addFunction`), which Cloudflare Workers forbid; there text falls back to
 * the built-in JavaScript outliner (`fonts/sfnt.js`).
 *
 * @returns {Promise<any>} The harfbuzzjs module.
 */
export function harfbuzz() {
  hbPromise ??= (async () => {
    const src = await settings.harfbuzz;
    if (src == null) return import('#harfbuzz');
    const W = /** @type {any} */ (WebAssembly);
    const { instantiate, instantiateStreaming } = W;
    /** @param {any} imports */
    const ours = async (imports) => {
      if (src instanceof WebAssembly.Module) return { module: src, instance: await instantiate(src, imports) };
      const bytes = isBytes(src) || typeof src?.arrayBuffer === 'function' ? await asBytes(src) : await loadBytes(src, 'file');
      return instantiate(bytes, imports);
    };
    let used = false;
    // harfbuzzjs instantiates once, on import: hand it our module then.
    W.instantiateStreaming = (/** @type {any} */ response, /** @type {any} */ imports) => {
      if (used) return instantiateStreaming(response, imports);
      used = true;
      Promise.resolve(response).catch(() => {});
      return ours(imports);
    };
    W.instantiate = (/** @type {any} */ source, /** @type {any} */ imports) => {
      if (used || !(source instanceof Uint8Array || source instanceof ArrayBuffer)) return instantiate(source, imports);
      used = true;
      return ours(imports);
    };
    try {
      return await import('#harfbuzz');
    } finally {
      W.instantiate = instantiate;
      W.instantiateStreaming = instantiateStreaming;
    }
  })();
  return hbPromise;
}

/**
 * Whether outlines come from HarfBuzz: `shaper: 'harfbuzz'`, or `'auto'`
 * where HarfBuzz loads (everywhere but Workers).
 *
 * @returns {Promise<any>} harfbuzzjs, or undefined for the JS outliner.
 */
export async function shaperModule() {
  if (settings.shaper === 'js') return undefined;
  try {
    return await harfbuzz();
  } catch (err) {
    if (settings.shaper === 'harfbuzz') throw err;
    hbPromise = Promise.reject(err);
    hbPromise.catch(() => {});
    return undefined;
  }
}

