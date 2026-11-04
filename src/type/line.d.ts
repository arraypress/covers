// Setting one line of type.
import type { LoadedFont } from '../fonts.js';
import type { Shaped } from '../text.js';
import type { RenderContext } from '../render/context.js';

/** A face for a family, weight, style and variable axes (`'pixel'`: the built-in 5×7 face). */
export function faceFor(ctx: RenderContext, o: { font?: string; weight?: number; style?: string; axes?: Record<string, number> }): Promise<LoadedFont>;
/** Glyph outlines of a run through a map from glyph px (y down, baseline 0) to canvas px. */
export function mappedPath(face: LoadedFont, run: Shaped, size: number, map: (gx: number, gy: number, glyph: Shaped['glyphs'][number]) => [number, number], only?: (glyph: Shaped['glyphs'][number]) => boolean): string;
/** Shape, justify (`width`) and draw one line anchored at `x` by `align`. */
export function setLine(o: { face: LoadedFont; text: string; size: number; tracking: number; x: number; y: number; align: 'left' | 'center' | 'right'; width?: number; adjust?: 'spacingAndGlyphs' | 'spacing'; shape?: (tracking: number) => Shaped; only?: (glyph: Shaped['glyphs'][number]) => boolean }): { d: string; width: number; left: number; run: Shaped; scaleX: number };
