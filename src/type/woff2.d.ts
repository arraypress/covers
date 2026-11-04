// WOFF2 to sfnt.

/** A WOFF2 file's flavour, table directory and Brotli payload. */
export function woff2Directory(buf: Uint8Array): { flavor: number; tables: { tag: string; origLength: number; length: number; transformed: boolean; data: Uint8Array }[]; payload: Uint8Array };
/** WOFF2 bytes as sfnt, given its decompressed stream (glyf, loca and hmtx rebuilt). */
export function woff2ToSfnt(buf: Uint8Array, stream: Uint8Array | undefined): Uint8Array;
