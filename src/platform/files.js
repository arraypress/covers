/**
 * Files read from disk in Node: a recipe's JSON, and the fonts that ship
 * with this package. Node's built-ins come from the image-effects platform
 * adapter (`process.getBuiltinModule`, or what `@arraypress/covers/node`
 * installs).
 *
 * @module platform/files
 */

import { node } from '@logomarks/image-effects/platform';

/** This module was loaded from disk (Node, Deno, Bun), not a bundle or a page. */
const FROM_DISK = String(import.meta.url).startsWith('file:');

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
