// Global settings.
import type { FontSource } from '../index.js';

/** Global settings: how files load, where HarfBuzz comes from, how text is drawn. */
export interface Settings {
  /** Load a file (an image, font, audio or icon set): return bytes, an ArrayBuffer, a Blob or a Response, or undefined to fall through. */
  load?: (src: unknown, info: { kind: string }) => unknown;
  /** Allow fetching http(s) URLs (default: yes in browsers and Workers, no in Node). */
  network?: boolean;
  fetch?: typeof fetch;
  /** HarfBuzz's wasm: a URL, bytes, a compiled `WebAssembly.Module`, a `Response`, or a promise of one. */
  harfbuzz?: unknown;
  /** `'auto'` (HarfBuzz where it runs, else the JavaScript outliner), `'harfbuzz'`, `'js'`. */
  shaper?: 'auto' | 'harfbuzz' | 'js';
  text?: 'outline' | 'live';
  /** Where icon sets load from outside Node: a URL template with `{prefix}`, or a function. */
  icons?: string | ((prefix: string) => string);
  /** Fonts for every cover. */
  fonts?: FontSource[];
}


/** The current settings. */
export const settings: Settings;
/** Fonts registered for every cover. */
export const registry: FontSource[];
/** Configure loading, HarfBuzz and text rendering (merges with what's set). */
export function configure(options: Settings): void;
