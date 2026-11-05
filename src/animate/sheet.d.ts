// The stylesheet an animated SVG carries.

/** The placeholder prefix animation names carry until the document is named. */
export const NS: string;

/** Keyframes and animation rules, each written once. */
export interface Sheet {
  /** Add an animation: `[progress 0–1, CSS declarations]` frames and its timing. Returns the class attribute for the element. */
  animation(frames: [number, string][], timing: string): string;
  /** Nothing added yet. */
  readonly empty: boolean;
  /** The stylesheet, with the `prefers-reduced-motion` rule that stops it. */
  css(): string;
}

/** A stylesheet to collect animations into. */
export function createSheet(): Sheet;
/** Give a finished document's animation names their prefix (`cv` and a hash of the document). */
export function nameSheet(svg: string): string;
