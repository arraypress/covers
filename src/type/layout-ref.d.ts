// Text layout later layers can read: {layout.<id>.<field>}.

/** Fields a reference can read. */
export const LAYOUT_FIELDS: readonly ('x' | 'y' | 'top' | 'bottom' | 'left' | 'right' | 'width' | 'height' | 'baseline' | 'size' | 'lines')[];
/** Whether a value holds a layout reference (outside nested layers). */
export function hasLayoutRef(v: unknown): boolean;
/** A layer with its layout references replaced by numbers. */
export function resolveLayoutRefs<T>(v: T, layout: Map<string, Record<string, number>>): T;
/** Record a text block's layout for later layers. */
export function recordLayout(ctx: { layout?: Map<string, Record<string, number>> }, id: string | undefined, box: { x: number; y: number; width: number; height: number }, more: { x: number; y: number; baseline: number; size: number; lines: number }): void;
