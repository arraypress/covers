// The platform adapter.
export { node, installNode, isNode, FROM_DISK, readTextSync, packageFileSync } from './node.js';
export type { NodeModules } from './node.js';
export { settings, configure, registry } from './settings.js';
export type { Settings } from './settings.js';
export { loadBytes } from './load.js';
export { deflateSync, deflate, inflate, unbrotli, unbrotliSync } from './compress.js';
export { harfbuzz, shaperModule } from './harfbuzz.js';
