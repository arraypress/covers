/**
 * @arraypress/covers — build-time cover images from a seed: mesh
 * gradients, grain, patterns, stripes, shapes, icons and type, as SVG or
 * WebP / PNG / AVIF / JPEG.
 */

/** A CSS colour: hex (3/4/6/8 digits), `rgb()`/`rgba()` or `hsl()`/`hsla()`. Alpha is ignored. */
export type Color = string;

/** Pixels, or a viewport unit of the canvas: `'6vmin'`, `'4vw'`, `'4vh'`, `'5vmax'`. */
export type Length = number | `${number}vmin` | `${number}vmax` | `${number}vw` | `${number}vh` | `${number}px`;

/** Where a box sits inside the safe area. */
export type Anchor =
  | 'top-left' | 'top' | 'top-right'
  | 'left' | 'center' | 'right'
  | 'bottom-left' | 'bottom' | 'bottom-right';

/** A CSS `mix-blend-mode`. */
export type BlendMode =
  | 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten' | 'color-dodge' | 'color-burn'
  | 'hard-light' | 'soft-light' | 'difference' | 'exclusion' | 'hue' | 'saturation' | 'color' | 'luminosity';

/** A point as fractions (0–1) of the canvas. */
export interface Point { x?: number; y?: number }

/** A rectangle as fractions (0–1) of the canvas. `width`/`height` default to the rest of the canvas. */
export interface Region { x?: number; y?: number; width?: number; height?: number }

/** A resolved palette: what every layer draws its default colours from. */
export interface Palette {
  readonly mode: 'light' | 'dark';
  /** Page colour under everything. */
  readonly bg: string;
  /** Gradient, blob, stripe and shape colours. */
  readonly colors: readonly string[];
  /** Type, readable on `bg` (7:1 when derived). */
  readonly text: string;
  /** The one strong colour. */
  readonly accent: string;
  /** Secondary type. */
  readonly muted: string;
  /** Raised things on `bg` (tiles, pills). */
  readonly surface: string;
}

/**
 * A palette as written: a preset name, one colour (an accent to derive
 * from), `[bg, ...colors]`, or a partial object.
 */
/** Built-in palette presets. */
export type PresetName = 'paper' | 'ink' | 'dawn' | 'dusk' | 'ocean' | 'ember' | 'moss' | 'carbon' | 'mono';

export type PaletteInput =
  | PresetName
  | (string & {})
  | Color[]
  | {
      bg?: Color;
      colors?: Color[];
      text?: Color;
      accent?: Color;
      muted?: Color;
      surface?: Color;
    };

/** A font the text layers can use. TrueType, OpenType or WOFF (not WOFF2). */
export interface FontSource {
  /** Family name, as text layers ask for it (`font: 'Inter'`). */
  name: string;
  data: Uint8Array | ArrayBuffer;
  /** Default 400. */
  weight?: number;
  /** Default `'normal'`. */
  style?: 'normal' | 'italic';
}

/** Options every layer takes. */
export interface BaseLayer {
  /** Names the layer, for recipe overrides (and seeds its random stream). */
  id?: string;
  /** Seeds this layer's random stream independently of the cover's (default: `id`, else type + index). */
  seed?: string;
  /** 0–1. */
  opacity?: number;
  blend?: BlendMode;
}

export interface SolidLayer extends BaseLayer {
  type: 'solid';
  /** Default `palette.bg`. */
  color?: Color;
}

export interface LinearLayer extends BaseLayer {
  type: 'linear';
  /** Default the first two palette colours. */
  colors?: Color[];
  /** Per-colour stop opacity. */
  opacities?: number[];
  /** CSS angle: 0 points up, 90 right. Default seeded. */
  angle?: number;
  /** Ease between stops (smoothstep). Default true. */
  ease?: boolean;
}

export interface RadialLayer extends BaseLayer {
  type: 'radial';
  /** Centre to edge. Default `[colors[0], bg]`. */
  colors?: Color[];
  /** Centre, fractions of the canvas. Default seeded. */
  x?: number;
  y?: number;
  /** Default `'80vmax'`. */
  radius?: Length;
  /** Default true. */
  ease?: boolean;
}

export interface MeshBlob {
  /** Centre, fractions of the canvas. */
  x?: number;
  y?: number;
  /** Radius as a fraction of the longer side. */
  r?: number;
  /** Height-to-width ratio. */
  squash?: number;
  /** Degrees. */
  rotate?: number;
  color?: Color;
  opacity?: number;
}

export interface MeshLayer extends BaseLayer {
  type: 'mesh';
  /** Default the palette's colours. */
  colors?: Color[];
  /** How many distinct colours to use (default 3 from the palette; all of `colors` when given). */
  hues?: number;
  /** Number of blobs. Default 4. */
  count?: number;
  /** Blur std deviation. Default `'11vmax'`. */
  blur?: Length;
  /** How far blobs wander from the centre, 0–1. Default 0.7. */
  spread?: number;
  /** Radius range, fractions of the longer side. Default `[0.3, 0.52]`. */
  size?: [number, number];
  /** Fill under the blobs. Default `palette.bg`; `null` for none. */
  base?: Color | null | false;
  /** Place blobs explicitly (overrides `count`). */
  blobs?: MeshBlob[];
}

export interface StripesLayer extends BaseLayer {
  type: 'stripes';
  /** Default `'vertical'`. */
  direction?: 'vertical' | 'horizontal' | 'diagonal';
  /** For `diagonal`. Default 45. */
  angle?: number;
  /** Default 8 (or the length of `widths`). */
  count?: number;
  /** `'even'` (default), `'random'`, `'taper'` (each `taper`× the last) or relative weights. */
  widths?: 'even' | 'random' | 'taper' | number[];
  /** Ratio for `widths: 'taper'`. Default 0.78. */
  taper?: number;
  /** Cycled. Default the palette's colours. */
  colors?: Color[];
  /** Space between stripes (the background shows). Default 0. */
  gap?: Length;
  /** Stripe corner radius. */
  radius?: Length;
  /** Default the whole canvas. */
  region?: Region;
  /** Corner radius of the region. */
  regionRadius?: Length;
}

export interface ImageLayer extends BaseLayer {
  type: 'image';
  /** A local file path, a `data:` URI, or bytes. Never fetched from the network. */
  src: string | Uint8Array;
  /** Default `'cover'`. */
  fit?: 'cover' | 'contain';
  /** Crop focus: an anchor, or (with sharp) `'attention'` / `'entropy'`. Default `'center'`. */
  focus?: Anchor | 'attention' | 'entropy';
  /** Default the whole canvas. */
  region?: Region;
  /** Map tones to two colours (shadows, highlights); `true` derives them from the palette. */
  duotone?: boolean | [Color, Color];
  grayscale?: boolean;
  /** Stretch tones before mapping (needs sharp). Default true with `duotone`/`grayscale`. */
  normalize?: boolean;
  /** A colour wash over the image. */
  tint?: Color | { color?: Color; amount?: number; blend?: BlendMode };
  blur?: Length;
}

export interface GrainLayer extends BaseLayer {
  type: 'grain';
  /** Strength, 0–1. Default 0.08. */
  amount?: number;
  /** Grain size in px. Default 1. */
  size?: number;
  /** Default true. */
  monochrome?: boolean;
  /** Default `'overlay'`. In raster output: normal, multiply, screen, overlay, soft-light. */
  blend?: 'normal' | 'multiply' | 'screen' | 'overlay' | 'soft-light';
}

export interface PatternLayer extends BaseLayer {
  type: 'pattern';
  /** Default `'grid'`. */
  kind?: 'grid' | 'dots' | 'lines' | 'rings' | 'waves';
  /** Cell / spacing. Default `'8.33vmin'` (`'3.2vmin'` dots, `'7vmin'` rings). */
  size?: Length;
  /** Line width (dot radius for dots). */
  stroke?: Length;
  /** Default `palette.text`. */
  color?: Color;
  /** Default 0.14. */
  opacity?: number;
  /** For `lines`, degrees. */
  angle?: number;
  /** Centre of rings / grid alignment, fractions. Default the middle. */
  center?: Point;
  /** For `waves`. */
  wavelength?: Length;
  amplitude?: Length;
  /** Fade out with a mask. Default `'none'`. */
  fade?: 'none' | 'radial' | 'edges' | 'top' | 'bottom' | 'left' | 'right';
  region?: Region;
}

export interface ShapeItem {
  kind?: 'circle' | 'square' | 'pill';
  /** Centre, fractions of the region. */
  x?: number;
  y?: number;
  size?: Length;
  color?: Color;
  rotate?: number;
  opacity?: number;
}

export interface ShapesLayer extends BaseLayer {
  type: 'shapes';
  /** Default `'circle'`. */
  kind?: 'circle' | 'square' | 'pill' | 'mixed';
  /** Default 6. */
  count?: number;
  /** `[min, max]`. Default `['7vmin', '20vmin']`. */
  size?: [Length, Length];
  colors?: Color[];
  /** Default `'scatter'` (spread out, avoiding overlaps). */
  placement?: 'scatter' | 'row' | 'column';
  /** Place shapes one by one (overrides `count`/`placement`). */
  items?: ShapeItem[];
  region?: Region;
  /** Random tilt for squares and pills. Default true. */
  rotate?: boolean;
  /** Square corner radius as a fraction of size. Default 0.22. */
  radius?: number;
  /** Draw outlines of this width instead of fills. */
  outline?: boolean | Length;
}

export interface IconTile {
  /** Default `size / 0.5`. */
  size?: Length;
  radius?: Length;
  /** Default `palette.surface`. */
  color?: Color;
  /** Default `'soft'`. */
  shadow?: 'soft' | 'none';
  /** Hairline border colour; `false` for none. */
  border?: Color | false;
}

export interface IconLayer extends BaseLayer {
  type: 'icon';
  /** An Iconify name: `'lucide:feather'`, `'simple-icons:github'`. */
  name?: string;
  /** A raw SVG string. */
  svg?: string;
  /** A bare path `d` (filled with the colour). */
  path?: string;
  /** For `path`. Default `[0, 0, 24, 24]`. */
  viewBox?: [number, number, number, number];
  /** Default `'24vmin'` (`'15vmin'` on a tile). */
  size?: Length;
  /** Default the accent on a tile, else `palette.text`. */
  color?: Color;
  /** Override stroke icons' `stroke-width` (in icon units). */
  strokeWidth?: number;
  /** Default `'center'`. */
  anchor?: Anchor;
  /** Explicit centre-of-anchor placement, fractions. */
  position?: Point;
  offset?: { x?: Length; y?: Length };
  margin?: Length;
  tile?: boolean | IconTile;
}

export interface TextLabel {
  content: string;
  font?: string;
  /** Default 500. */
  weight?: number;
  style?: 'normal' | 'italic';
  size?: Length;
  /** Default `palette.muted`. */
  color?: Color;
  /** Em. Default 0.08. */
  letterSpacing?: number;
  /** Default `'uppercase'`. */
  transform?: 'none' | 'uppercase' | 'lowercase';
  lineHeight?: number;
  maxLines?: number;
  /** Space between the label and the text. */
  gap?: Length;
}

export interface TextLayer extends BaseLayer {
  type: 'text';
  content: string;
  /** Family. Default `'Inter'` (bundled). */
  font?: string;
  /** Default 600. */
  weight?: number;
  style?: 'normal' | 'italic';
  /** Default 6% of the design unit (`sqrt(width × height)`). */
  size?: Length;
  /** Shrink toward this before truncating. */
  minSize?: Length;
  /** Default 1.12. */
  lineHeight?: number;
  /** Em. Default -0.02. */
  letterSpacing?: number;
  /** Default `palette.text`. */
  color?: Color;
  /** Default from the anchor. */
  align?: 'left' | 'center' | 'right';
  /** Default `'bottom-left'`. */
  anchor?: Anchor;
  position?: Point;
  offset?: { x?: Length; y?: Length };
  /** Safe margin. Default 7% of the design unit. */
  margin?: Length;
  /** Default the canvas width less the margins. */
  maxWidth?: Length;
  /** Default 3. */
  maxLines?: number;
  /** Default `'…'`. */
  ellipsis?: string;
  /** Even out line lengths. Default true. */
  balance?: boolean;
  transform?: 'none' | 'uppercase' | 'lowercase';
  /** A small line above (a string, or its options). */
  label?: string | TextLabel;
  /** A pill or box behind the block. */
  background?: Color | { color?: Color; radius?: Length; padding?: Length | [Length, Length]; opacity?: number };
}

export interface FrameLayer extends BaseLayer {
  type: 'frame';
  /** Default `'3.5vmin'`. */
  inset?: Length;
  /** Default `'2vmin'`. */
  radius?: Length;
  /** Default `'0.15vmin'`; 0 for none. */
  stroke?: Length;
  /** Default `palette.text` (at opacity 0.22). */
  color?: Color;
  /** Fill the inset rectangle (a card). */
  fill?: Color;
}

export type Layer =
  | SolidLayer | LinearLayer | RadialLayer | MeshLayer | StripesLayer | ImageLayer
  | GrainLayer | PatternLayer | ShapesLayer | IconLayer | TextLayer | FrameLayer;

/** Built-in recipe names. */
export type RecipeName = 'aurora' | 'gridTitle' | 'iconTile' | 'bigType' | 'stripes' | 'duotone';

/** What a recipe function receives besides the options. */
export interface RecipeContext {
  width: number;
  height: number;
  palette: Palette;
  rng: Rng;
  /** `sqrt(width × height)`. */
  u: number;
}

/** A custom recipe. */
export type Recipe = (options: RecipeOptions, context: RecipeContext) => Layer[];

/** Per-layer customisation: a string is the layer's content, an object is merged in, `false` removes it. */
export type LayerOverride = string | false | null | Partial<Layer> | Record<string, unknown>;

/** Options recipes read, plus overrides by layer id. */
export interface RecipeOptions {
  /** Headline (or the title layer's options). */
  title?: string | Partial<TextLayer>;
  /** Small line above the title. */
  label?: string | TextLabel;
  /** Iconify name for `iconTile` / `stripes`, or the icon layer's options. */
  icon?: string | Partial<IconLayer>;
  /** Image for `duotone`: a path or bytes, or the image layer's options. */
  image?: string | Uint8Array | Partial<ImageLayer>;
  /** `stripes`: which side the band runs down. */
  side?: 'left' | 'right';
  /** Any recipe layer by id: `mesh`, `grid`, `grain`, `bg`, `glow`, `rings`, `wash`, `stripes`, `spot`, `scrim`… */
  [layerId: string]: unknown;
}

/** A cover as written. */
export interface CoverOptions extends RecipeOptions {
  /** Default 1200 (or from `height` and `aspect`). */
  width?: number;
  height?: number;
  /** `'1:1'` (default), `'16:9'`, `'4:5'`, `'3:2'`, `'4:3'`, `'2:1'`, `'9:16'`, `'og'` (1200×630), any `'w:h'`, or a number. */
  aspect?: keyof typeof ASPECTS | `${number}:${number}` | number;
  /** Drives every random choice. Use the post's slug. Default the title. */
  seed?: string | number;
  palette?: PaletteInput | Palette;
  /** A built-in recipe or your own. */
  recipe?: RecipeName | Recipe;
  /** Without a recipe: the whole stack. With one: extra layers painted on top. */
  layers?: Layer[];
  /** Extra fonts. Inter 400/500/600/700 is always available. */
  fonts?: FontSource[];
  /** Accessible name in the SVG `<title>`. Default the title. */
  alt?: string;
  /** Round the cover's corners (transparent outside; use PNG/WebP/AVIF). */
  radius?: Length;
}

/** A resolved cover (from {@link cover}). */
export interface Cover {
  width: number;
  height: number;
  seed: string;
  palette: Palette;
  layers: Layer[];
  fonts: FontSource[];
  alt?: string;
  radius?: Length;
}

export interface RenderImageOptions {
  /** Default `'webp'`. */
  format?: 'webp' | 'png' | 'avif' | 'jpeg';
  /** Default 90 for WebP, 72 for AVIF, 88 for JPEG (high enough to keep the grain; see README). */
  quality?: number;
  /** Encoder effort (WebP/AVIF 0–9, PNG compression 0–9). */
  effort?: number;
  /** Cache renders by content hash: `true` for `node_modules/.cache/covers`, or a directory. */
  cache?: boolean | string;
}

/** Seeded random stream. */
export interface Rng {
  next(): number;
  range(min: number, max: number): number;
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  shuffle<T>(items: readonly T[]): T[];
  chance(p?: number): boolean;
}

/** An Iconify JSON set (`@iconify-json/<prefix>/icons.json`). */
export interface IconSet {
  prefix: string;
  icons: Record<string, { body: string; width?: number; height?: number; left?: number; top?: number }>;
  aliases?: Record<string, { parent: string; width?: number; height?: number }>;
  width?: number;
  height?: number;
  left?: number;
  top?: number;
}

/** Resolve a cover's size and palette and expand its recipe. Pure and synchronous. */
export function cover(options: CoverOptions | Cover): Cover;

/** Render to an SVG string (text and icons as outlines; byte-identical for the same input). */
export function renderSvg(input: CoverOptions | Cover): Promise<string>;

/** Render to image bytes with sharp (a peer dependency). */
export function renderImage(input: CoverOptions | Cover, options?: RenderImageOptions): Promise<Buffer>;

/** The content-hash cache key for a cover and output options (40 hex chars). */
export function coverKey(input: CoverOptions | Cover, options?: RenderImageOptions): Promise<string>;

/** Output MIME types. */
export const MIME: Readonly<{ webp: 'image/webp'; png: 'image/png'; avif: 'image/avif'; jpeg: 'image/jpeg' }>;

/** This package's version. */
export const VERSION: string;

/** The built-in recipes. */
export const recipes: Readonly<Record<RecipeName, Recipe>>;

/** Curated palette presets. */
export const palettes: Readonly<Record<PresetName, Readonly<{ bg: string; colors: readonly string[]; text: string; accent: string }>>>;

/** Resolve any palette input. */
export function resolvePalette(input?: PaletteInput | Palette): Palette;

/** Derive a palette from a theme's tokens (or just an accent). */
export function derivePalette(tokens: { accent: Color; bg?: Color; text?: Color; colors?: Color[]; mode?: 'light' | 'dark' }): Palette;

/** Parse a CSS colour to `#rrggbb`. */
export function toHex(color: Color): string;
/** A colour in OKLCH (lightness 0–1, chroma, hue in degrees). */
export function toOklch(color: Color): { l: number; c: number; h: number };
/** OKLCH to `#rrggbb` (chroma reduced to fit sRGB). */
export function fromOklch(lch: { l: number; c: number; h: number }): string;
/** Mix two colours in OKLab. */
export function mixOklab(a: Color, b: Color, t: number): string;

/** Register an Iconify icon set (no `@iconify-json/*` install needed). */
export function registerIcons(set: IconSet): void;

/** Pixel size from `width` / `height` / `aspect`. */
export function resolveSize(options?: { width?: number; height?: number; aspect?: string | number }): { width: number; height: number };

/** Named aspect ratios (width / height). */
export const ASPECTS: Readonly<{ '1:1': number; '16:9': number; '4:5': number; '3:2': number; '4:3': number; '2:1': number; '9:16': number; og: number }>;

/** A seeded random stream (for custom recipes). */
export function createRng(seed: string | number): Rng;

/** Hash a string to a 32-bit unsigned integer. */
export function hashString(str: string, salt?: number): number;

/** The layer renderers, by type (for introspection). */
export const layers: Readonly<Record<Layer['type'], (layer: any, context: any) => unknown>>;
