/**
 * The platform: everything that differs between Node, a browser and a
 * Cloudflare Worker, behind one small adapter. Node's built-ins, zlib and
 * the byte helpers are image-effects' (one registry, so
 * `@arraypress/covers/node` installs for both); settings, loading, files
 * and HarfBuzz are covers' own. Nothing here imports a `node:` module.
 *
 * @module platform
 */

export { node, installNode, isNode, deflateSync, deflate, inflate, unbrotli, unbrotliSync, u8, isBytes, toBase64, fromBase64, latin1, utf8, encodeUtf8, concat, fromDataUri, hexDigest } from '@logomarks/image-effects/platform';
export { readTextSync, packageFileSync } from './files.js';
export { settings, configure, registry } from './settings.js';
export { loadBytes } from './load.js';
export { harfbuzz, shaperModule } from './harfbuzz.js';
