/**
 * The platform: everything that differs between Node, a browser and a
 * Cloudflare Worker, behind one small adapter. Nothing here imports a
 * `node:` module.
 *
 * @module platform
 */

export { node, installNode, isNode, FROM_DISK, readTextSync, packageFileSync } from './node.js';
export { settings, configure, registry } from './settings.js';
export { loadBytes } from './load.js';
export { deflateSync, deflate, inflate, unbrotli, unbrotliSync } from './compress.js';
export { harfbuzz, shaperModule } from './harfbuzz.js';
