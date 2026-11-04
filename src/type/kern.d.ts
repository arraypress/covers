// Pair kerning from a TrueType font.

/** A pair's X advance adjustment, font units (GPOS pair adjustment, else `kern`). */
export function pairKerning(v: DataView, tables: Record<string, number>): (a: number, b: number) => number;
