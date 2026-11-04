// A round sticker border.
import type { RenderContext, Markup } from '../render/context.js';

/** A disc under the layer, round what it paints (undefined where nothing can rasterise). */
export function roundBorder(fx: { kind: 'border'; shape: 'circle'; width?: import('../index.js').Length; color?: string; line?: boolean | string; lineWidth?: import('../index.js').Length; cx?: import('../index.js').Length; cy?: import('../index.js').Length }, m: Markup, ctx: RenderContext): Promise<Markup | undefined>;
