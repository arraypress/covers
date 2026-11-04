// Paints: a colour, 'none', or a gradient over a shape's bounds.
import type { Color, Length } from '../index.js';

/** A gradient over a shape's bounds. */
export interface GradientPaint {
  type: 'linear' | 'radial';
  colors: Color[];
  stops?: number[];
  opacities?: number[];
  /** Linear: CSS degrees. Default 180 (top to bottom). */
  angle?: number;
  /** `'reflect'` / `'repeat'` with a `length` run: holographic foil, stripes. */
  spread?: 'pad' | 'reflect' | 'repeat';
  length?: Length;
  cx?: number; cy?: number; r?: Length; fx?: number; fy?: number;
  /** Radial: elliptical radii (lengths, or fractions ≤ 1 of the box). */
  rx?: Length; ry?: Length;
}

/** A pattern repeated over a shape. */
export interface TilePaint {
  type: 'tile';
  kind?: 'checker' | 'stripes' | 'dots' | 'grid' | 'custom';
  /** One cell (or `[width, height]`). Default `'4vmin'`. */
  size?: Length | [Length, Length];
  /** `[ground, ink]`; the ground may be `'none'`. */
  colors?: [Color | 'none', Color];
  /** The stripe, dot or line share of a cell. */
  ratio?: number;
  /** Degrees. */
  angle?: number;
  /** `custom`: the tile's markup (sanitised). */
  markup?: string;
}

/** A named paint (`'chrome'`, `'steel'`, `'gold'`): a reflected-horizon gradient with its keyline; fields override it. */
export interface PresetPaint extends Partial<Omit<GradientPaint, 'type'>> {
  preset: 'chrome' | 'steel' | 'gold';
  type?: 'linear' | 'radial';
  /** The keyline it brings (`false` for none). */
  keyline?: false | { color: Color; width: Length }[];
}

/** A fill or stroke: a colour, `'none'`, a gradient, a tile or a preset. */
export type Paint = Color | 'none' | GradientPaint | TilePaint | PresetPaint;


/** A paint as an SVG fill value, plus any gradient it needs in `<defs>`. */
export function paint(v: Paint | undefined, fallback: string, o: { id: string; box: { x: number; y: number; width: number; height: number }; canvas: { width: number; height: number } }): { defs: string; value: string };
