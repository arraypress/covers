// The `svg` layer.
import type { Color, Length, BaseLayer, Anchor } from '../index.js';
import type { RenderContext, Markup } from '../render/context.js';

/** `svg`: raw markup, the escape hatch. */
export interface SvgLayer extends BaseLayer {
  type: 'svg';
  /** Tokens: `{{@accent}}`, `{{@colors.1}}`, `{{@width}}`, `{{id}}`, `{{seed}}`; in JSON recipes `{{title}}` or any option. */
  markup: string;
  defs?: string;
  viewBox?: [number, number, number, number];
  x?: Length | `${number}%`; y?: Length | `${number}%`; width?: Length | `${number}%`; height?: Length | `${number}%`;
  fit?: 'contain' | 'cover' | 'stretch';
  align?: string;
}


/** Strip scripts, foreignObject, event handlers and links out of SVG markup. */
export function sanitize(s: string): string;
/** Shapes from a slot's markup (paths and basic shapes with geometry and paint attributes); anything else is escaped. */
export function shapesOnly(markup: string): string;
/** Draw raw markup with its tokens filled. */
export function svg(layer: SvgLayer, ctx: RenderContext): Markup;
