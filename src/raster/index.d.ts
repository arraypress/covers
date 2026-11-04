// Rasterising in the browser.

/** Browser raster options. */
export interface RasterizeOptions {
  /** Default `'png'`. */
  format?: 'png' | 'jpeg' | 'webp';
  /** 0–1 (JPEG, WebP). Default 0.9. */
  quality?: number;
  /** Output width or height, px (the other follows), or a `scale`. */
  width?: number;
  height?: number;
  scale?: number;
  /** A colour under the art (JPEG defaults to the page colour). */
  background?: string;
}

/** Rasterise an SVG string in a browser page. */
export function rasterize(svg: string, options?: RasterizeOptions): Promise<Blob>;
/** RGBA pixels of an SVG at a size: sharp in Node, a canvas in a page, undefined elsewhere. */
export function pixelsOf(svg: string, w: number, h: number, sharp?: unknown): Promise<Uint8Array | undefined>;
/** Encode RGBA pixels for embedding: JPEG where opaque (unless `lossless`), else PNG. */
export function encodePixels(data: Uint8Array | Uint8ClampedArray, w: number, h: number, o?: { opaque?: boolean; lossless?: boolean; quality?: number }, sharp?: unknown): Promise<{ mime: 'image/jpeg' | 'image/png'; bytes: Uint8Array }>;
/** Pixels through a real JPEG encoder and back; undefined where none is available. */
export function jpegRoundTrip(data: Uint8ClampedArray, w: number, h: number, quality: number, subsample: boolean, sharp?: unknown): Promise<Uint8ClampedArray | undefined>;
