// zlib on every platform.

/** zlib-deflate synchronously (Node), else undefined. */
export function deflateSync(data: Uint8Array): Uint8Array | undefined;
/** zlib-deflate (Node's zlib, else CompressionStream). */
export function deflate(data: Uint8Array): Promise<Uint8Array>;
/** zlib-inflate. */
export function inflate(data: Uint8Array): Promise<Uint8Array>;
/** Brotli-decompress synchronously (Node), else undefined. */
export function unbrotliSync(data: Uint8Array): Uint8Array | undefined;
/** Brotli-decompress (Node's zlib, else DecompressionStream('brotli') where there is one), else undefined. */
export function unbrotli(data: Uint8Array): Promise<Uint8Array | undefined>;
