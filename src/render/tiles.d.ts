// Large SVGs with filters, rasterised in tiles.

/** An SVG document's RGBA pixels at its own size (in tiles when large and filtered). */
export function svgPixels(sharp: unknown, svg: string, width: number, height: number, known?: number): Promise<Uint8Array>;
/** How far any filter in a document reaches, output px, estimated from its markup. */
export function reach(svg: string): number;
