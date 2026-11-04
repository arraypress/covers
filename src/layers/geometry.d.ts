// Shape geometry for the `shape` layer.
import type { ShapeSpec } from './shape.js';
import type { RenderContext } from '../render/context.js';

/** A shape's path data (or an opening element tag), bounds and transform. */
export function geometry(s: ShapeSpec, ctx: RenderContext): { d?: string; el?: string; transform?: string; box: { x: number; y: number; width: number; height: number } };
