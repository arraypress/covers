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
  /** White, or near-black when the accent is light: marks drawn on the accent. */
  readonly onAccent: string;
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
      onAccent?: Color;
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
  /** Neighbouring hues only: keep the colours within this many degrees (OKLCH), making neighbours when the palette has too few. */
  hueSpan?: number;
  /** Number of fields. Default 4. */
  count?: number;
  /** `'sweep'` (default): long fields along one direction, centres free to leave the frame. `'ring'`: rounder blobs round the centre. */
  arrangement?: 'sweep' | 'ring';
  /** Sweep direction, degrees. Default seeded. */
  angle?: number;
  /** How much more a sweep blurs along its direction than across. Default 1.5. */
  streak?: number;
  /** Blur std deviation. Default `'11vmax'`. */
  blur?: Length;
  /** How far fields wander, 0–1. Default 1 (sweep), 0.7 (ring). */
  spread?: number;
  /** Radius range, fractions of the longer side. Default `[0.42, 0.72]` (sweep), `[0.3, 0.52]` (ring). */
  size?: [number, number];
  /** Pull every colour into an OKLCH lightness / chroma band, keeping its hue. */
  tone?: { l?: [number, number]; c?: [number, number] };
  /** A second field meeting the first along a soft curve, with a sharper edge and a faint sheen (silk). */
  fold?: boolean | { color?: Color; to?: Color; position?: number; bend?: number; softness?: number; sheen?: number };
  /** Thin light motion streaks along the sweep. Default 0. */
  streaks?: number;
  /** Take the colours from a photo (path or bytes; needs sharp). */
  from?: string | Uint8Array;
  /** Under the fields: `'auto'` (default, a gradient across the sweep between the first two colours), `'bg'`, a colour, or `null`. */
  base?: 'auto' | 'bg' | Color | null | false;
  /** Place fields explicitly (overrides `count`). */
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
  /** `'edges'`: heavier toward the edges and corners (spray paint). */
  vary?: 'edges' | null;
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
  /** Dashed or dotted lines (or `[on, off]` lengths). */
  dash?: 'dashed' | 'dotted' | true | [Length, Length];
  /** Grid / lines: N equal cells (inner lines only) instead of `size`. */
  divisions?: number;
  /** Regions (fractions) the lines break around. */
  gaps?: Region[];
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

export interface DiagramNode {
  /** Iconify name or raw SVG; the spark when left out. */
  icon?: string;
  /** Default `'square'` (`'circle'` in the square layout, `'none'` in the hub). */
  shape?: 'square' | 'circle' | 'none';
  size?: Length;
  /** Corner brackets around the node. */
  brackets?: boolean;
}

export interface DiagramLayer extends BaseLayer {
  type: 'diagram';
  /** One icon, drawn large as line art (shortcut for one node). */
  icon?: string;
  /** For a single icon. Default `'none'`. */
  shape?: 'square' | 'circle' | 'none';
  nodes?: DiagramNode[];
  /** Default from the node count. */
  layout?: 'single' | 'row' | 'triangle' | 'square' | 'stack' | 'hub' | null;
  /** `true`: straight arrows; `'loop'`: also an elbow back (row); `'both'`: there and back (triangle); `'cycle'` (square). */
  arrows?: boolean | 'loop' | 'both' | 'cycle' | 'merge' | null;
  size?: Length;
  gap?: Length;
  /** Default `'0.3vmin'`. */
  stroke?: Length;
  /** Default white. */
  color?: Color;
  radius?: Length;
  /** Icon size inside a tile, 0–1. Default 0.44. */
  iconScale?: number;
  position?: Point;
  /** A dotted grid (4×4 cells) that breaks around the drawing. */
  grid?: boolean | { divisions?: number; opacity?: number; stroke?: Length; color?: Color; pad?: Length };
}

export interface PaperItem {
  kind?: 'rect' | 'square' | 'circle' | 'blob' | 'arch' | 'pill';
  /** Centre, fractions of the region. */
  x?: number;
  y?: number;
  width?: Length;
  height?: Length;
  size?: Length;
  rotate?: number;
  color?: Color;
}

export interface PaperLayer extends BaseLayer {
  type: 'paper';
  /** Shapes in the collage. Default 4. */
  count?: number;
  /** Default `'mixed'`. */
  kind?: 'mixed' | 'rect' | 'square' | 'circle' | 'blob' | 'arch' | 'pill';
  /** Default `#faf9f5`. */
  color?: Color;
  /** Default the middle 60%. */
  region?: Region;
  items?: PaperItem[];
  /** How rough the cut edges are, 0–1. Default 0.5. */
  wobble?: number;
}

export interface ScribbleLayer extends BaseLayer {
  type: 'scribble';
  /** An icon to re-draw by hand (Iconify name or raw SVG); the spark when left out. */
  icon?: string;
  /** A hand-drawn node graph instead: `true` or `{ nodes, dot }`. */
  graph?: boolean | { nodes?: number; dot?: number };
  /** Default `#faf9f5`. */
  color?: Color;
  /** Default `'1.3vmin'`. */
  stroke?: Length;
  /** Default `'46vmin'`. */
  size?: Length;
  position?: Point;
  /** 0–1. Default 0.5. */
  wobble?: number;
}

export interface InkShape {
  kind: 'circle' | 'ring' | 'half' | 'arch' | 'band' | 'rect' | 'text';
  /** Centre, fractions of the canvas (bands use `y` only). */
  x?: number;
  y?: number;
  /** Radius (circle, ring, half). Default `'30vmin'`. */
  r?: Length;
  size?: Length;
  width?: Length;
  height?: Length;
  /** Ring thickness. */
  thickness?: Length;
  rotate?: number;
  /** For `kind: 'text'`: the text, and any text-layer options. */
  content?: string;
  [option: string]: unknown;
}

export interface InkLayer extends BaseLayer {
  type: 'ink';
  /** A colour, or a riso ink: `'riso:pink'`, `'riso:blue'`, … (see `RISO_INKS`). */
  color?: Color;
  shapes?: InkShape[];
  /** Misregistration. Default seeded, 0.3–1% of the short side. */
  offset?: { x?: Length; y?: Length };
  /** Default `'grain'` (speckle). */
  texture?: 'grain' | 'halftone' | 'none';
  /** Grain: share of paper showing through. Default 0.09. */
  speckle?: number;
  /** Halftone cell, dot radius (fraction of the cell) and screen angle (0 or 45). */
  cell?: Length;
  dot?: number;
  angle?: 0 | 45;
  /** `[min, max]`: ink density across the sheet. Default `[0.78, 1]`. */
  density?: [number, number];
}

export interface DitherLayer extends BaseLayer {
  type: 'dither';
  /** `[ground, ink]`, or three colours for two dithered bands. */
  colors?: Color[];
  /** Default `'field'` (smooth noise). */
  source?: 'field' | 'linear' | 'radial';
  shape?: 'none' | 'circle' | 'sphere' | 'arch';
  size?: Length;
  center?: Point;
  /** Default `'bayer4'`. */
  matrix?: 'bayer4' | 'bayer8' | 'noise';
  /** Pixel size. Default `'0.9vmin'`. */
  cell?: Length;
  angle?: number;
  scale?: number;
  gamma?: number;
  range?: [number, number];
}

export interface ContourLayer extends BaseLayer {
  type: 'contour';
  /** Default 20. */
  levels?: number;
  color?: Color;
  stroke?: Length;
  /** The level drawn in the accent (default seeded), or `false`. */
  highlight?: number | false;
  highlightColor?: Color;
  /** Every Nth line thicker. Default 5; 0 for none. */
  index?: number;
  indexWeight?: number;
  scale?: number;
  octaves?: number;
  resolution?: number;
}

export interface WaveformLayer extends BaseLayer {
  type: 'waveform';
  /** Peak values (any scale). */
  peaks?: number[] | null;
  /** An audio file decoded at build (needs `@arraypress/waveform-gen`). */
  audio?: string | null;
  /** Default 88. */
  bars?: number;
  /** Default `'mirrored'`. */
  style?: 'mirrored' | 'bars' | 'line' | 'dots';
  color?: Color;
  region?: Region;
  gap?: number;
  round?: boolean;
  stroke?: Length;
  /** `true`: the duration (from `audio` or `duration`); or any text. */
  caption?: boolean | string | null;
  /** Seconds, or text such as `'48:12'`. */
  duration?: number | string | null;
  captionSize?: Length;
  captionColor?: Color;
}

export interface TilesLayer extends BaseLayer {
  type: 'tiles';
  cols?: number;
  rows?: number;
  /** Seeds the grid's rhythm, shared across a series. Default: the cover's own. */
  series?: string | null;
  colors?: Color[];
  ground?: Color;
  kinds?: ('quarter' | 'half' | 'circle' | 'square' | 'triangle')[];
  merge?: boolean;
  region?: Region;
}

export interface RuleLayer extends BaseLayer {
  type: 'rule';
  y?: number;
  from?: Point;
  to?: Point;
  inset?: Length;
  color?: Color;
  stroke?: Length;
}

export type Layer =
  | InkLayer | DitherLayer | ContourLayer | WaveformLayer | TilesLayer | RuleLayer
  | DiagramLayer | PaperLayer | ScribbleLayer
  | SolidLayer | LinearLayer | RadialLayer | MeshLayer | StripesLayer | ImageLayer
  | GrainLayer | PatternLayer | ShapesLayer | IconLayer | TextLayer | FrameLayer;

/** Built-in recipe names. */
export type RecipeName = 'aurora' | 'gridTitle' | 'iconTile' | 'bigType' | 'stripes' | 'duotone' | 'mark' | 'diagram' | 'cutout' | 'riso' | 'dither' | 'contour' | 'waveform' | 'bauhaus' | 'issue' | 'photo';

/** What a recipe function receives besides the options. */
export interface RecipeContext {
  width: number;
  height: number;
  palette: Palette;
  rng: Rng;
  /** `sqrt(width × height)`. */
  u: number;
  /** The cover's seed. */
  seed?: string;
}

/** A custom recipe. JSON recipes defined with {@link defineRecipe} also carry `recipeName` and `json`. */
export type Recipe = ((options: RecipeOptions, context: RecipeContext) => Layer[]) & { recipeName?: string; json?: RecipeJson };

/**
 * A recipe value in JSON: a literal, a token (`"@accent"`, `"$var"`,
 * `"{title}"`), or an operator object (`{ "mix": [a, b, t] }`, `{ "if": … }`).
 */
export type RecipeValue =
  | string | number | boolean | null
  | RecipeValue[]
  | { if: RecipeCondition; then: RecipeValue; else?: RecipeValue }
  | { mix: [RecipeValue, RecipeValue, RecipeValue] | [RecipeValue, RecipeValue, RecipeValue, 'oklab' | 'oklch'] }
  | { readable: RecipeValue }
  | { gradientUnder: [RecipeValue, RecipeValue, RecipeValue] }
  | { tone: [RecipeValue, RecipeValue] }
  | { length: RecipeValue }
  | { pick: RecipeValue[] }
  | { range: [RecipeValue, RecipeValue] }
  | { int: [RecipeValue, RecipeValue] }
  | { add: RecipeValue[] } | { sub: RecipeValue[] } | { mul: RecipeValue[] } | { div: [RecipeValue, RecipeValue] }
  | { min: RecipeValue[] } | { max: RecipeValue[] }
  | { ramp: RecipeValue[] }
  | { taper: [RecipeValue, RecipeValue] }
  | { reverse: RecipeValue }
  | { [key: string]: RecipeValue };

/** A condition: an option name (set?), `{ name: value }` (equals; `mode` is the palette's), `not`, `all`, `any`. */
export type RecipeCondition =
  | string
  | boolean
  | { not: RecipeCondition }
  | { all: RecipeCondition[] }
  | { any: RecipeCondition[] }
  | { [option: string]: string | number | boolean | (string | number | boolean)[] };

/** One layer of a JSON recipe: a layer type, its options as recipe values, and an optional `when`. */
export interface RecipeJsonLayer {
  type: Layer['type'];
  id?: string;
  when?: RecipeCondition;
  [option: string]: RecipeValue | RecipeCondition | undefined;
}

/** A recipe as data (see `schema/recipe.schema.json`). */
export interface RecipeJson {
  $schema?: string;
  name?: string;
  description?: string;
  /** Options this recipe reads, with defaults; cover options of the same name override them. */
  params?: Record<string, RecipeValue>;
  /** Options that must be set. */
  requires?: string[];
  /** The encoding this style prefers (renderImage options win). */
  output?: { lossless?: boolean };
  /** Named values, resolved in order; referenced as `"$name"`. */
  vars?: Record<string, RecipeValue>;
  layers: RecipeJsonLayer[];
}

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
  /** `mark`: the accent (`'solid'`, default) or an accent gradient. */
  background?: 'solid' | 'gradient';
  /** `mark` gradient angle (CSS degrees). Default 135. */
  angle?: number;
  /** `mark` gradient colours. Default the accent → a mix toward the palette's second colour. */
  colors?: Color[];
  /** `diagram` nodes, layout and arrows (see {@link DiagramLayer}). */
  nodes?: DiagramNode[];
  layout?: DiagramLayer['layout'];
  arrows?: DiagramLayer['arrows'];
  /** `cutout`: a hand-cut panel on the page colour instead of a full field. */
  panel?: boolean;
  /** `cutout`: paper shapes (default 3, none on a panel). */
  shapes?: number;
  /** `cutout`: a hand-drawn node graph instead of an icon. */
  graph?: boolean;
  /** `cutout`: line colour, light (paper) or dark (ink). Default from the composition. */
  stroke?: 'light' | 'dark';
  /** `riso`: inks (colours or `'riso:<name>'`), texture, and a third ink. */
  inks?: Color[];
  texture?: 'grain' | 'halftone' | 'none';
  third?: boolean;
  /** `dither`: matrix, cell, source, shape, three colours. */
  matrix?: 'bayer4' | 'bayer8' | 'noise';
  cell?: Length;
  source?: 'field' | 'linear' | 'radial';
  shape?: 'none' | 'circle' | 'sphere' | 'arch';
  three?: boolean;
  /** `contour`: how many isolines. */
  levels?: number;
  /** `waveform`: peaks, or an audio file; duration; style; field. */
  peaks?: number[];
  audio?: string;
  duration?: number | string;
  style?: 'mirrored' | 'bars' | 'line' | 'dots';
  field?: 'flat' | 'toned';
  /** `bauhaus`: a series seed (shared grid rhythm). */
  series?: string;
  /** `issue`: number, masthead, date, and the "No." prefix. */
  number?: number | string;
  masthead?: string;
  date?: string;
  prefix?: boolean;
  /** `photo`: `'blur'` shows the photo blurred instead of a field of its colours. */
  show?: 'blur';
  /** `mark` icon colour. `'auto'` (default): white whenever it clears 3:1 against everything under the icon, else near-black. */
  iconColor?: 'auto' | 'white' | 'black' | Color;
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
  /** A built-in recipe, your own function, or a JSON recipe document. */
  recipe?: RecipeName | Recipe | RecipeJson;
  /** Without a recipe: the whole stack. With one: extra layers painted on top. */
  layers?: Layer[];
  /** Extra fonts. Inter 400/500/600/700 is always available. */
  fonts?: FontSource[];
  /** Accessible name in the SVG `<title>`. Default the title. */
  alt?: string;
  /** Round the cover's corners (transparent outside; use PNG/WebP/AVIF). */
  radius?: Length;
  /** Preferred encoding, overriding the recipe's. */
  output?: { lossless?: boolean };
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
  /** Preferred encoding (from the recipe, or set here). */
  output?: { lossless?: boolean };
}

export interface RenderImageOptions {
  /** Default `'webp'`. */
  format?: 'webp' | 'png' | 'avif' | 'jpeg';
  /** Default 90 for WebP, 72 for AVIF, 88 for JPEG (high enough to keep the grain; see README). */
  quality?: number;
  /** Lossless WebP / AVIF (default: the recipe's preference, else lossy). */
  lossless?: boolean;
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

/** Turn a JSON recipe into a recipe function (validated; throws with the JSON path on a problem). */
export function defineRecipe(json: RecipeJson): Recipe;

/** Read and define a JSON recipe file (synchronous). */
export function loadRecipe(path: string | URL): Recipe;

/** Default encoder quality, by format. */
export const DEFAULT_QUALITY: Readonly<{ webp: number; avif: number; jpeg: number; png: number }>;

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
/** `prefer` if it clears `ratio` on every background, else the better of white and near-black (3:1 suits icons, WCAG 1.4.11). */
export function onBackground(backgrounds: Color | Color[], ratio?: number, prefer?: 'white' | 'black' | Color): string;
/** The colour of an eased multi-stop gradient at t (0–1), as the gradient layers draw it. */
export function gradientAt(colors: Color[], t: number, ease?: boolean): string;
/** Mix two colours in OKLCH (hue the short way; stays vivid). */
export function mixOklch(a: Color, b: Color, t: number): string;

/** Register an Iconify icon set (no `@iconify-json/*` install needed). */
export function registerIcons(set: IconSet): void;

/** Pixel size from `width` / `height` / `aspect`. */
export function resolveSize(options?: { width?: number; height?: number; aspect?: string | number }): { width: number; height: number };

/** Named aspect ratios (width / height). */
export const ASPECTS: Readonly<{ '1:1': number; '16:9': number; '4:5': number; '3:2': number; '4:3': number; '2:1': number; '9:16': number; og: number }>;

/** A seeded random stream (for custom recipes). */
export function createRng(seed: string | number): Rng;

/** Dominant colours of a photo, most common first (needs sharp). */
export function extractPalette(src: string | Uint8Array, options?: { count?: number }): Promise<string[]>;

/** Classic risograph inks, by name (approximations). */
export const RISO_INKS: Readonly<Record<'pink' | 'blue' | 'yellow' | 'teal' | 'red' | 'green' | 'orange' | 'purple' | 'navy' | 'black', string>>;

/** Hash a string to a 32-bit unsigned integer. */
export function hashString(str: string, salt?: number): number;

/** The layer renderers, by type (for introspection). */
export const layers: Readonly<Record<Layer['type'], (layer: any, context: any) => unknown>>;
