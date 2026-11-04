// Fonts: loading, decoding and picking a face.
import type { FontSource } from './index.js';
import type { HarfBuzzModule } from './platform/harfbuzz.js';

/** A shaped glyph, font units. */
export interface RunGlyph {
  gid: number;
  cluster: number;
  xAdvance: number;
  xOffset: number;
  yOffset: number;
}

/** A loaded face, ready to shape with (HarfBuzz, or the JavaScript reader in Workers). */
export interface LoadedFont {
  name: string;
  weight: number;
  style: string;
  /** The harfbuzzjs Font, or the JavaScript face. */
  font: object;
  upem: number;
  ascender: number;
  descender: number;
  capHeight: number;
  /** Parsed outline commands by glyph id. */
  paths: Map<number, (string | number)[]>;
  /** Shape one line. */
  shapeRun: (text: string) => RunGlyph[];
  /** A glyph's outline, font units, y up. */
  glyphToPath: (gid: number) => string;
  axes: Record<string, { min: number; default: number; max: number }>;
  variations: Record<string, number>;
  source: FontSource;
}

/** HarfBuzz, or undefined where it can't run (Workers) or is switched off. */
export function harfbuzz(): Promise<HarfBuzzModule | undefined>;
/** The bundled Inter faces (bytes from disk in Node, else loaded on first use). */
export function bundledFonts(): FontSource[];
/** A cover's fonts, then the registered ones, then Inter. */
export function fontPool(own: FontSource[]): FontSource[];
/** Register a font for every cover. */
export function registerFont(font: FontSource): void;
/** A font source's bytes. */
export function fontBytes(source: FontSource): Promise<Uint8Array>;
/** WOFF or sfnt bytes as sfnt, synchronously (Node). */
export function decodeFont(input: Uint8Array | ArrayBuffer): Uint8Array;
/** WOFF or sfnt bytes as sfnt, on any platform. */
export function decodeFontAsync(input: Uint8Array | ArrayBuffer): Promise<Uint8Array>;
/** Load a face, optionally at a variation (`{ wght: 650, wdth: 80 }`). */
export function loadFont(source: FontSource, variations?: Record<string, number>): Promise<LoadedFont>;
/** The closest face for a family, weight and style (a variable range matches inside it). */
export function pickFont(sources: FontSource[], family: string, weight: number, style?: string): FontSource;
/** A layer's variation settings (`wght` follows the weight on a variable font). */
export function variationsFor(source: FontSource, weight: number, axes: Record<string, number> | undefined): Record<string, number> | undefined;
