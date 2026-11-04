// The `table` layer.
import type { Color, Length, BaseLayer, Anchor } from '../index.js';
import type { RenderContext, Markup } from '../render/context.js';

/** A table cell: text, or text with its own style. */
export type TableCell = string | number | { content: string | number; weight?: number; size?: Length; color?: Color; align?: 'left' | 'center' | 'right'; font?: string; opacity?: number; width?: Length };

export interface TableLayer extends BaseLayer {
  type: 'table';
  rows: (TableCell[] | string | Record<string, TableCell>)[];
  columns?: { x?: Length | `${number}%`; align?: 'left' | 'center' | 'right'; width?: Length; key?: string; weight?: number; size?: Length; color?: Color; font?: string; letterSpacing?: number; transform?: 'uppercase'; opacity?: number; lengthAdjust?: 'spacingAndGlyphs' | 'spacing' }[];
  x?: Length | `${number}%`;
  /** First baseline. */
  y?: Length | `${number}%`;
  size?: Length; lineHeight?: Length; rowHeight?: Length; rowGap?: Length;
  font?: string; weight?: number; style?: 'normal' | 'italic'; axes?: Record<string, number>;
  color?: Color; letterSpacing?: number;
  header?: Record<string, unknown>;
  rules?: boolean | { at?: 'between' | 'each' | 'top'; color?: Color; width?: Length; opacity?: number; x1?: Length; x2?: Length; above?: number };
  columnWidth?: Length;
}


/** Draw text on a grid. */
export function table(layer: TableLayer, ctx: RenderContext): Promise<Markup>;
