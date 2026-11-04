// A brand kit in one call.
import type { CoverOptions, Recipe, RecipeJson, RecipeName, FormatName } from '../index.js';

/** The formats a kit renders by default, by group. */
export const KIT_FORMATS: Readonly<{ social: readonly FormatName[]; release: readonly FormatName[]; print: readonly FormatName[] }>;

/** One rendered piece: SVG (or image bytes), or its pages. */
export type KitFile = string | Uint8Array | Record<string, string | Uint8Array>;

/** Render a brand on many formats at once. */
export function kit(brand: CoverOptions, options?: {
  formats?: FormatName[];
  /** One recipe for all, or by format (with `default`). Default the built-in `brand`. */
  recipe?: RecipeName | Recipe | RecipeJson | Partial<Record<FormatName | 'default', RecipeName | Recipe | RecipeJson>>;
  /** Pages per format (business cards are `['front', 'back']` by default). */
  pages?: Partial<Record<FormatName, string[]>>;
  /** `'svg'` (default) or an image format (Node). */
  render?: 'svg' | 'webp' | 'png' | 'jpeg' | 'avif';
  overlay?: boolean;
}): Promise<Partial<Record<FormatName, KitFile>>>;
