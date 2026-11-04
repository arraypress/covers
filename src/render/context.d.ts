// What a layer renderer receives and returns (types only).
import type { Palette, Rng, FontSource, Layer } from '../index.js';

/** A rendered layer: markup for `<defs>` and for the body. */
export interface Markup {
  defs: string;
  body: string;
  /** Mesh layers: the blur's 3σ padding, for the padded raster path. */
  pad?: number;
  /** Mesh layers: the finest blur, px. */
  finest?: number;
}

/** A text block as drawn, reported to `lint`. */
export interface DrawnText {
  kind: 'text';
  id?: string;
  content: string;
  /** Type size, canvas px (the first line, stretched). */
  size: number;
  /** The smallest line's capital height, canvas px (stretched, through every group and transform). */
  capHeight: number;
  box: { x: number; y: number; width: number; height: number } | null;
  /** The narrowest horizontal scale a line was set at (justification, stretch). */
  squeeze?: number;
}

/** An image as drawn, reported to `lint`. */
export interface DrawnImage {
  kind: 'image';
  id?: string;
  /** Its box at the cover's size, canvas px. */
  drawn: { width: number; height: number };
  /** The source's pixels. */
  source?: { width: number; height: number };
  /** The pixels embedded. */
  embedded?: { width: number; height: number };
  fit: 'cover' | 'contain' | 'stretch';
}

/** Everything a layer renderer needs. */
export interface RenderContext {
  /** Canvas width, px (a group's grid width inside a group). */
  width: number;
  height: number;
  canvas: { width: number; height: number };
  palette: Palette;
  /** This layer's own seeded stream. */
  rng: Rng;
  /** A unique id prefix for this layer's defs. */
  id: string;
  /** Available fonts, Inter last. */
  fonts: FontSource[];
  /** The sharp module, when loaded (Node). */
  sharp?: unknown;
  /** Print: bleed plus safe margin, px (anchored text and icons default their margin to it). */
  inset?: number;
  /** `'live'` draws text as `<text>`. */
  textRender?: 'outline' | 'live';
  /** Collects what was drawn, for `lint`. */
  report?: (entry: DrawnText | DrawnImage) => void;
  /** Canvas px per unit here, the larger axis (images and raster effects resample for it). */
  res?: number;
  /** This context's units to canvas px. */
  matrix?: [number, number, number, number, number, number];
  /** Drawn for `renderImage` (librsvg): effects may take their faster forms. */
  raster?: boolean;
  /** The print format's trim and die-cut, canvas px. */
  cut?: { x: number; y: number; width: number; height: number; cut?: import('../formats/cut.js').Cut; mm: number };
  /** Where text blocks landed, by layer id, for `{layout.<id>.<field>}`. */
  layout?: Map<string, Record<string, number>>;
  /** Named layers (`defs`) and drawn copies, for `use`. */
  defs?: Map<string, unknown>;
  /** Identity of the document being rendered (one `@font-face` per face per document). */
  doc?: object;
  /** The average colour under a box (`color: 'auto'`), top-level layers only. */
  backdrop?: (box: { x: number; y: number; width: number; height: number }) => Promise<string | undefined>;
  /** Render a nested stack (groups, masks). */
  stack?: (layers: Layer[], sub: { tag: string; width?: number; height?: number; scale?: number; res?: number; matrix?: [number, number, number, number, number, number] }) => Promise<(Markup & { layer: Layer })[]>;
  /** A group's scale to canvas px. */
  scale?: number;
}
