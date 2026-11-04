/**
 * Node's built-ins, found without importing `node:` (so bundles for
 * browsers and Workers never see them): `process.getBuiltinModule` on Node
 * 20.16+, or the modules `@arraypress/covers/node` installs.
 *
 * @module platform/node
 */

/**
 * @typedef {object} NodeModules
 * @property {any} [fs] - `node:fs`.
 * @property {any} [fsp] - `node:fs/promises`.
 * @property {any} [zlib] - `node:zlib`.
 * @property {any} [path] - `node:path`.
 * @property {any} [module] - `node:module`.
 * @property {any} [url] - `node:url`.
 */

/** @type {NodeModules} */
let nodeModules = {};

/** The global `process`, where there is one. */
export const proc = /** @type {any} */ (globalThis).process;
/** Built-in lookup without a static import (Node 20.16+, Deno, Bun). */
const builtin = typeof proc?.getBuiltinModule === 'function' && proc.versions?.node ? proc.getBuiltinModule.bind(proc) : undefined;
/** This module was loaded from disk (Node, Deno, Bun), not a bundle or a page. */
export const FROM_DISK = String(import.meta.url).startsWith('file:');

/**
 * A Node built-in, when there is one.
 *
 * @param {'fs' | 'fs/promises' | 'zlib' | 'path' | 'module' | 'url'} name
 * @returns {any}
 */
export function node(name) {
  const key = name === 'fs/promises' ? 'fsp' : name;
  const have = /** @type {any} */ (nodeModules)[key];
  if (have) return have;
  if (!builtin) return undefined;
  try {
    return (/** @type {any} */ (nodeModules)[key] = builtin(`node:${name}`));
  } catch {
    return undefined;
  }
}

/**
 * Install Node's modules (what `@arraypress/covers/node` does).
 *
 * @param {NodeModules} mods
 * @returns {void}
 */
export function installNode(mods) {
  nodeModules = { ...nodeModules, ...mods };
}

/** Whether this looks like Node with a file system we can read. */
export const isNode = () => Boolean(node('fs')) && Boolean(proc?.versions?.node);

/**
 * Read a text file synchronously (Node only; `loadRecipe`).
 *
 * @param {string | URL} path
 * @returns {string}
 */
export function readTextSync(path) {
  const fs = node('fs');
  if (!fs) throw new Error('Reading a file synchronously needs Node. In a browser or Worker, fetch the JSON and pass it to defineRecipe().');
  return fs.readFileSync(path, 'utf8');
}

/**
 * Read a file that ships with this package (Node, from disk), or undefined.
 *
 * @param {string} rel - Relative to the package root (`'fonts/inter-latin-400.woff'`).
 * @returns {Uint8Array | undefined}
 */
export function packageFileSync(rel) {
  const fs = node('fs');
  if (!fs || !FROM_DISK) return undefined;
  try {
    return fs.readFileSync(new URL(`../../${rel}`, import.meta.url));
  } catch {
    return undefined;
  }
}
