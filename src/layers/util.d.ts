// Helpers the poster layers share.

/** A coordinate: px, `'50%'` of the canvas along `axis`, or a length. */
export function pos(v: unknown, axis: 'x' | 'y', canvas: { width: number; height: number }): number;
/** Markup wrapped in the layer's opacity and blend (when it has them). */
export function wrap(layer: { opacity?: number; blend?: string }, body: string): string;
/** The text of a string-or-object option. */
export function contentOf(v: unknown): string | undefined;
