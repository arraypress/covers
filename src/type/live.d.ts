// Live text: @font-face rules.
import type { LoadedFont } from '../fonts.js';
import type { RenderContext } from '../render/context.js';

/** The face's `@font-face` rule (empty when this document has it already) and its family name. */
export function fontFace(face: LoadedFont, ctx: RenderContext): Promise<{ family: string; css: string }>;
