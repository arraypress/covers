/**
 * Rasterising without sharp: an SVG drawn into a canvas in the browser,
 * encoded as PNG, JPEG or WebP. `renderImage()` stays the Node path (sharp,
 * with its grain and padded-blur handling); this is the browser one.
 *
 * The SVG is decoded by the browser as an `<img>` (so it needs a page:
 * `document` and `Image`), drawn onto an `OffscreenCanvas` when there is
 * one (else a `<canvas>`), and encoded with `convertToBlob` / `toBlob`.
 *
 * @module raster
 */

const MIMES = /** @type {const} */ ({ png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' });

/**
 * Decode an SVG string into a drawable image (browser).
 *
 * @param {string} svg
 * @returns {Promise<HTMLImageElement>}
 */
async function decodeSvg(svg) {
  const g = /** @type {any} */ (globalThis);
  if (typeof g.Image !== 'function' || typeof g.document === 'undefined') {
    throw new Error('rasterize() needs a browser page (Image and canvas). In Node use renderImage(); in a Worker return the SVG, or rasterise it with a wasm renderer.');
  }
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new g.Image();
    img.decoding = 'sync';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    // Revoked after decode: the decoded image keeps its pixels.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

/**
 * A 2D canvas of a size.
 *
 * @param {number} w @param {number} h
 * @returns {{ canvas: any, ctx: CanvasRenderingContext2D }}
 */
function canvasOf(w, h) {
  const g = /** @type {any} */ (globalThis);
  const canvas = typeof g.OffscreenCanvas === 'function' ? new g.OffscreenCanvas(w, h) : Object.assign(g.document.createElement('canvas'), { width: w, height: h });
  return { canvas, ctx: canvas.getContext('2d') };
}

/**
 * Rasterise an SVG in the browser.
 *
 * @param {string} svg - An SVG document (from `renderSvg`).
 * @param {{ format?: 'png' | 'jpeg' | 'webp', quality?: number, width?: number, height?: number, scale?: number, background?: string }} [options]
 * @returns {Promise<Blob>}
 *
 * @example
 * const blob = await rasterize(await renderSvg(cover), { format: 'webp', quality: 0.9 });
 * img.src = URL.createObjectURL(blob);
 */
export async function rasterize(svg, options = {}) {
  const format = options.format ?? 'png';
  if (!Object.hasOwn(MIMES, format)) throw new TypeError(`Unknown format "${format}" (png, jpeg, webp)`);
  const vw = Number(/\bwidth="([\d.]+)"/.exec(svg)?.[1] ?? 1200);
  const vh = Number(/\bheight="([\d.]+)"/.exec(svg)?.[1] ?? 1200);
  const scale = options.scale ?? (options.width ? options.width / vw : options.height ? options.height / vh : 1);
  const w = Math.max(1, Math.round(vw * scale));
  const h = Math.max(1, Math.round(vh * scale));
  const img = await decodeSvg(svg);
  const { canvas, ctx } = canvasOf(w, h);
  if (format === 'jpeg' || options.background) {
    ctx.fillStyle = options.background ?? /fill="(#[0-9a-f]{6})"/i.exec(svg)?.[1] ?? '#ffffff';
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(img, 0, 0, w, h);
  const type = MIMES[format];
  const quality = options.quality ?? (format === 'png' ? undefined : 0.9);
  if (typeof canvas.convertToBlob === 'function') return canvas.convertToBlob({ type, quality });
  return new Promise((resolve, reject) => canvas.toBlob((/** @type {Blob | null} */ b) => (b ? resolve(b) : reject(new Error('Canvas encoding failed'))), type, quality));
}

/**
 * RGBA pixels of an SVG at a size: sharp in Node, a canvas in a page.
 * Undefined where neither is available (a Worker).
 *
 * @param {string} svg
 * @param {number} w
 * @param {number} h
 * @param {any} [sharp] - The sharp module, when loaded.
 * @returns {Promise<Uint8Array | undefined>}
 */
export async function pixelsOf(svg, w, h, sharp) {
  if (sharp) {
    const out = await sharp(new TextEncoder().encode(svg)).resize(w, h, { fit: 'fill' }).ensureAlpha().raw().toBuffer();
    return new Uint8Array(out.buffer, out.byteOffset, out.byteLength);
  }
  const g = /** @type {any} */ (globalThis);
  if (typeof g.Image !== 'function' || typeof g.document === 'undefined') return undefined;
  const img = await decodeSvg(svg);
  const { ctx } = canvasOf(w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return new Uint8Array(ctx.getImageData(0, 0, w, h).data.buffer);
}

/**
 * Encode RGBA pixels for embedding: JPEG where they're opaque (smaller),
 * PNG where they aren't or where `lossless` (flat colour, crisp cells).
 * sharp in Node, a canvas in a page, else the in-library PNG encoder.
 *
 * @param {Uint8Array | Uint8ClampedArray} data - RGBA, unpremultiplied.
 * @param {number} w
 * @param {number} h
 * @param {{ opaque?: boolean, lossless?: boolean, quality?: number }} [o]
 * @param {any} [sharp]
 * @returns {Promise<{ mime: 'image/jpeg' | 'image/png', bytes: Uint8Array }>}
 */
export async function encodePixels(data, w, h, o = {}, sharp) {
  const jpeg = Boolean(o.opaque) && !o.lossless;
  const quality = o.quality ?? 92;
  if (sharp) {
    let img = sharp(data, { raw: { width: w, height: h, channels: 4 } });
    if (o.opaque) img = img.removeAlpha();
    const out = jpeg ? await img.jpeg({ quality, chromaSubsampling: '4:4:4' }).toBuffer() : await img.png({ compressionLevel: 6 }).toBuffer();
    return { mime: jpeg ? 'image/jpeg' : 'image/png', bytes: new Uint8Array(out.buffer, out.byteOffset, out.byteLength) };
  }
  const g = /** @type {any} */ (globalThis);
  if (typeof g.OffscreenCanvas === 'function' || typeof g.document !== 'undefined') {
    const { canvas, ctx } = canvasOf(w, h);
    ctx.putImageData(new g.ImageData(new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength), w, h), 0, 0);
    const type = jpeg ? 'image/jpeg' : 'image/png';
    const blob = typeof canvas.convertToBlob === 'function'
      ? await canvas.convertToBlob({ type, quality: quality / 100 })
      : await new Promise((resolve, reject) => canvas.toBlob((/** @type {Blob | null} */ b) => (b ? resolve(b) : reject(new Error('Canvas encoding failed'))), type, quality / 100));
    return { mime: type, bytes: new Uint8Array(await blob.arrayBuffer()) };
  }
  const { encodePngAsync } = await import('../png.js');
  return { mime: 'image/png', bytes: await encodePngAsync(new Uint8Array(data.buffer, data.byteOffset, data.byteLength), w, h, 4) };
}

/**
 * Pixels through a real JPEG encoder and back (compression artefacts):
 * libjpeg through sharp in Node, the browser's own encoder in a page.
 * Undefined where neither is available.
 *
 * @param {Uint8ClampedArray} data - RGBA (alpha ignored).
 * @param {number} w
 * @param {number} h
 * @param {number} quality - 1–100.
 * @param {boolean} subsample - 4:2:0 chroma (blocky colour).
 * @param {any} [sharp]
 * @returns {Promise<Uint8ClampedArray | undefined>} RGBA, opaque.
 */
export async function jpegRoundTrip(data, w, h, quality, subsample, sharp) {
  if (sharp) {
    const jpg = await sharp(data, { raw: { width: w, height: h, channels: 4 } }).removeAlpha().jpeg({ quality, chromaSubsampling: subsample ? '4:2:0' : '4:4:4' }).toBuffer();
    const out = await sharp(jpg).ensureAlpha().raw().toBuffer();
    return new Uint8ClampedArray(out.buffer, out.byteOffset, out.byteLength);
  }
  const g = /** @type {any} */ (globalThis);
  if (typeof g.createImageBitmap !== 'function' || (typeof g.OffscreenCanvas !== 'function' && typeof g.document === 'undefined')) return undefined;
  const { canvas, ctx } = canvasOf(w, h);
  ctx.putImageData(new g.ImageData(new Uint8ClampedArray(data), w, h), 0, 0);
  const blob = typeof canvas.convertToBlob === 'function'
    ? await canvas.convertToBlob({ type: 'image/jpeg', quality: quality / 100 })
    : await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality / 100));
  const bitmap = await g.createImageBitmap(blob);
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0);
  return new Uint8ClampedArray(ctx.getImageData(0, 0, w, h).data.buffer);
}
