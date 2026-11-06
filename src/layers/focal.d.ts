// Placing a photo on a point of it: a focus [x, y], or a cut-out's head.

/** A cut-out's head (the alpha-weighted centre of the top 45% of its opaque rows), 0–1 in the photo; null with no transparency. */
export function subjectFocus(sharp: any, bytes: Uint8Array): Promise<[number, number] | null>;
/** The drawn box (relative to the box) that centres a point of a `sw` × `sh` photo; `cover` keeps the box filled except sideways when `free` (a cut-out). */
export function focalBox(box: { width: number; height: number }, sw: number, sh: number, fit: 'cover' | 'contain', point: [number, number], free?: boolean): { x: number; y: number; width: number; height: number };
/** A `W` × `H` raster with the photo drawn at a box (raster pixels), the rest clear, as a sharp pipeline. */
export function drawAt(sharp: any, bytes: Uint8Array, W: number, H: number, at: { x: number; y: number; width: number; height: number }): Promise<any>;
