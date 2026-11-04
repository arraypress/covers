// An image's pixel size from its header.

/** Width and height of a PNG, JPEG, WebP or GIF, without decoding it. */
export function imageSize(b: Uint8Array): { width: number; height: number } | undefined;
