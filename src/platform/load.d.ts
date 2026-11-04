// Loading bytes from anything.

/** Load an image, font, audio file or icon set. */
export function loadBytes(src: unknown, kind?: 'image' | 'font' | 'audio' | 'icons' | 'file'): Promise<Uint8Array>;
/** Bytes from what a loader returned (bytes, a Blob or a Response). */
export function asBytes(v: unknown): Promise<Uint8Array>;
