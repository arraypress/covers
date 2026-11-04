// Node's built-ins, without importing node:.

/** Node modules covers uses. */
export interface NodeModules {
  fs?: typeof import('node:fs');
  fsp?: typeof import('node:fs/promises');
  zlib?: typeof import('node:zlib');
  path?: typeof import('node:path');
  module?: typeof import('node:module');
  url?: typeof import('node:url');
}

/** The global `process`, where there is one. */
export const proc: NodeJS.Process | undefined;
/** This module was loaded from disk. */
export const FROM_DISK: boolean;
/** A Node built-in, when there is one. */
export function node<K extends 'fs' | 'fs/promises' | 'zlib' | 'path' | 'module' | 'url'>(name: K): K extends 'fs' ? typeof import('node:fs') : K extends 'fs/promises' ? typeof import('node:fs/promises') : K extends 'zlib' ? typeof import('node:zlib') : K extends 'path' ? typeof import('node:path') : K extends 'module' ? typeof import('node:module') : typeof import('node:url') | undefined;
/** Install Node's modules (what `@arraypress/covers/node` does). */
export function installNode(mods: NodeModules): void;
/** Whether this is Node with a file system. */
export function isNode(): boolean;
/** Read a text file synchronously (Node). */
export function readTextSync(path: string | URL): string;
/** A file shipped with the package, from disk (Node), or undefined. */
export function packageFileSync(rel: string): Uint8Array | undefined;
