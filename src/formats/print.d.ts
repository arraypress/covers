// Print set-up: sizes at a dpi, bleed, safe margin, crop marks, die lines.
import type { Zones, FormatName, Format } from './presets.js';

/** Print set-up, px. */
export interface PrintInfo {
  dpi: number;
  unit: 'mm' | 'in';
  trimWidth: number;
  trimHeight: number;
  bleed: number;
  safe: number;
  slug: number;
  cropMarks: boolean;
  cut?: import('./cut.js').Cut;
  cutLine: boolean;
  mm: number;
}


/** A length in a unit as px at a dpi. */
export function toPx(v: number, unit: string, dpi: number): number;
/** A cover's `format` as its canvas, print set-up and zones (undefined without one). */
export function resolveFormat(o: { format?: FormatName | (Partial<Format> & { width: number; height: number }); width?: number; height?: number; dpi?: number; bleed?: number | false; safe?: number; cropMarks?: boolean; cutLine?: boolean; cut?: import('./cut.js').Cut }): { width: number; height: number; format?: string; zones?: Zones; print?: PrintInfo } | undefined;
/** Crop marks (slug coordinates) and the die line (bleed-box coordinates). */
export function printMarks(p: PrintInfo, w: number, h: number): { marks: string; cut: string };
