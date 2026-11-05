// Files read from disk in Node.

/** Read a text file synchronously (Node). */
export function readTextSync(path: string | URL): string;
/** A file shipped with the package, from disk (Node), or undefined. */
export function packageFileSync(rel: string): Uint8Array | undefined;
