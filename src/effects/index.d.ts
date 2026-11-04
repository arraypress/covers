// Effects: filters, pixel effects and copies any layer takes.
import type { Color, Length, Layer } from '../index.js';
import type { RenderContext, Markup } from '../render/context.js';
export { transformAttr } from './transform.js';
export type { LayerTransform } from './transform.js';
export { paint } from './paint.js';
export type { Paint } from './paint.js';

/** A point as fractions of the canvas, `[x, y]` or `{ x, y }`. */
export type Point = [number, number] | { x: number; y: number };

/** Where an effect applies (see {@link EffectMask}). */
export type { EffectMask } from './mask.js';
import type { EffectMask } from './mask.js';
import type { LookName } from './looks.js';

/** A seed: a number, or any string (hashed). */
type Seed = number | string;

/** An effect (see the README's Effects table for each kind). */
export type Effect = (
  | { kind: 'blur'; radius?: Length; x?: Length; y?: Length; edge?: 'duplicate' }
  | { kind: 'motion'; angle?: number; length?: Length; spread?: Length }
  | { kind: 'shadow' | 'glow'; x?: Length; y?: Length; blur?: Length; color?: Color; opacity?: number; spread?: Length }
  | { kind: 'border'; width?: Length; color?: Color; line?: boolean | Color; lineWidth?: Length; shape?: 'die' | 'circle'; cx?: Length; cy?: Length }
  | { kind: 'wear'; rough?: Length; uneven?: number; specks?: number; seed?: number }
  | { kind: 'rough' | 'warp'; scale?: Length; frequency?: number | [number, number]; octaves?: number; seed?: number }
  | { kind: 'xerox'; rough?: Length; dropout?: number; seed?: number }
  | { kind: 'photocopy'; ink?: Color; contrast?: number; lift?: number; noise?: number; frequency?: number; seed?: number }
  | { kind: 'duotone'; colors?: Color[]; contrast?: number }
  | { kind: 'grayscale' | 'levels'; slope?: number; intercept?: number; contrast?: number; brightness?: number; black?: number; white?: number; gamma?: number; output?: [number, number] }
  | { kind: 'saturate'; amount?: number }
  | { kind: 'matrix'; values: string | number[] }
  | { kind: 'grit'; amount?: number; frequency?: number; seed?: number }
  | { kind: 'halftone'; ink?: Color; cell?: Length; angle?: number; contrast?: number; lift?: number; softness?: number; shape?: 'dot' | 'line' | 'square' | 'diamond' | 'cross' }
  | { kind: 'dither'; ink?: Color; paper?: Color; cell?: Length; contrast?: number; brightness?: number; pixelate?: boolean; weights?: [number, number, number]; matrix?: 'bayer4' | 'bayer8' }
  | { kind: 'threshold'; level?: number; ink?: Color; paper?: Color | 'none' }
  | { kind: 'filter'; markup: string }
  | { kind: 'extrude'; depth?: Length; angle?: number; offset?: [Length, Length]; steps?: number; color?: Color; to?: Color }
  // Blurs (pixels).
  | { kind: 'zoom'; center?: Point; amount?: number }
  | { kind: 'spin'; center?: Point; angle?: number }
  | { kind: 'tilt'; center?: Point; angle?: number; width?: Length; falloff?: Length; radius?: Length; saturate?: number }
  | { kind: 'lens'; radius?: Length; blades?: number; rotation?: number; highlights?: number; threshold?: number }
  // Distortions (pixels; mirror is copies).
  | { kind: 'wave'; amplitude?: Length; wavelength?: Length; angle?: number; phase?: number; shape?: 'sine' | 'triangle' | 'square' }
  | { kind: 'ripple'; center?: Point; amplitude?: Length; wavelength?: Length; phase?: number; radius?: Length }
  | { kind: 'twirl'; center?: Point; angle?: number; radius?: Length }
  | { kind: 'bulge' | 'pinch'; center?: Point; amount?: number; radius?: Length }
  | { kind: 'fisheye'; center?: Point; amount?: number }
  | { kind: 'glass'; texture?: 'frosted' | 'reeded' | 'pebbled'; size?: Length; amount?: Length; angle?: number; shade?: number; seed?: Seed }
  | { kind: 'displace'; amount?: Length; map?: { layers: Layer[] }; mode?: 'gradient' | 'channels'; size?: Length; octaves?: number; seed?: Seed }
  | { kind: 'kaleidoscope'; segments?: number; center?: Point; angle?: number; scale?: number }
  | { kind: 'mirror'; keep?: 'left' | 'right' | 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'; at?: number | Point }
  | { kind: 'stretch'; at?: number; direction?: 'down' | 'up' | 'left' | 'right'; length?: number; fade?: number }
  | { kind: 'sort'; direction?: 'horizontal' | 'vertical'; threshold?: [number, number]; by?: 'luma' | 'hue' | 'saturation'; reverse?: boolean; length?: number; seed?: Seed }
  // Colour (filters; vibrance on pixels).
  | { kind: 'curves'; points?: [number, number][]; red?: [number, number][]; green?: [number, number][]; blue?: [number, number][] }
  | { kind: 'gradientMap'; colors?: Color[]; stops?: number[]; space?: 'srgb' | 'oklab' }
  | { kind: 'posterize'; levels?: number }
  | { kind: 'invert'; amount?: number }
  | { kind: 'hue'; angle?: number; saturation?: number; lightness?: number }
  | { kind: 'vibrance'; amount?: number; saturation?: number }
  | { kind: 'colorBalance'; shadows?: [number, number, number]; midtones?: [number, number, number]; highlights?: [number, number, number] }
  | { kind: 'channelMixer'; red?: number[]; green?: number[]; blue?: number[]; monochrome?: boolean; gray?: number[] }
  | { kind: 'sepia'; amount?: number }
  | { kind: 'look'; name?: LookName; amount?: number }
  // Light.
  | { kind: 'bloom'; threshold?: number; radius?: Length; intensity?: number; color?: Color }
  | { kind: 'halation'; threshold?: number; radius?: Length; intensity?: number; color?: Color }
  | { kind: 'vignette'; shape?: 'ellipse' | 'circle' | 'rect'; size?: number; softness?: number; amount?: number; color?: Color; center?: Point }
  | { kind: 'lightLeak'; edge?: 'left' | 'right' | 'top' | 'bottom'; colors?: Color[]; intensity?: number; seed?: Seed }
  | { kind: 'lensFlare'; at?: Point; size?: Length; intensity?: number; color?: Color; ghosts?: number; streak?: boolean | number; seed?: Seed }
  | { kind: 'rays'; center?: Point; threshold?: number; length?: number; intensity?: number; color?: Color }
  // Texture and print.
  | { kind: 'grain'; amount?: number; size?: Length; color?: boolean; seed?: number }
  | { kind: 'dust'; amount?: number; scratches?: number; color?: 'light' | 'dark' | 'mixed'; seed?: Seed }
  | { kind: 'paper'; texture?: 'paper' | 'canvas'; scale?: Length; amount?: number; angle?: number; seed?: number }
  | { kind: 'scanlines'; spacing?: Length; thickness?: number; amount?: number }
  | { kind: 'crt'; mask?: 'aperture' | 'shadow'; size?: Length; amount?: number; scanlines?: number; curvature?: number }
  | { kind: 'vhs'; shift?: Length; bleed?: Length; jitter?: Length; tracking?: number; noise?: number; seed?: Seed }
  | { kind: 'jpeg'; quality?: number; block?: Length; passes?: number; subsample?: boolean }
  | { kind: 'newsprint'; cell?: Length; angles?: [number, number, number, number]; paper?: Color; gain?: number; gcr?: number }
  // Digital.
  | { kind: 'chromatic'; amount?: Length; angle?: number; mode?: 'directional' | 'radial'; center?: Point }
  | { kind: 'rgbSplit'; amount?: Length; angle?: number }
  | { kind: 'glitch'; amount?: number; shift?: Length; slices?: number; blocks?: number; seed?: Seed }
  | { kind: 'pixelate' | 'mosaic'; size?: Length; shape?: 'square' | 'hex' }
  | { kind: 'ascii'; cell?: Length; ramp?: string; color?: 'source' | Color; background?: Color | 'none'; invert?: boolean; contrast?: number }
  | { kind: 'emboss'; angle?: number; amount?: number; radius?: Length; color?: boolean }
  | { kind: 'edges'; radius?: Length; amount?: number; style?: 'ink' | 'glow'; color?: Color; mono?: boolean }
  | { kind: 'sketch'; radius?: Length; darkness?: number; color?: boolean }
  | { kind: 'sharpen'; amount?: number; radius?: Length }
) & {
  /** Where the effect applies: a gradient or layers (white: full). */
  mask?: EffectMask;
  /** Where filter primitives do their arithmetic. Default `'sRGB'`; `'linearRGB'` is the SVG default browsers' own filters use. */
  colorSpace?: 'sRGB' | 'linearRGB';
  /** Filter region padding, a fraction of the canvas on each side. */
  pad?: number;
};

/** An effect's kind. */
export type EffectKind = Effect['kind'];

/** Every effect kind. */
export const EFFECTS: readonly EffectKind[];
/** Every kind's options, with descriptions (validation, the schema, docs). */
export { EFFECT_OPTIONS, EFFECT_COMMON } from './options.js';
export { checkMask, RESOLVED, maskImage } from './mask.js';

/** Effects always drawn without an SVG filter (on pixels, or as copies). */
export const RASTER_EFFECTS: readonly EffectKind[];
/** Whether an effect is computed on pixels (`chromatic` only radial; `motion` only when rasterising). */
export function isPixel(fx: Effect | EffectKind | undefined, ctx?: { raster?: boolean }): boolean;
/** Whether an effect needs something that draws pixels (sharp, a canvas). */
export function needsPixels(fx: Effect | EffectKind | undefined): boolean;
/** Whether an effect is drawn without an SVG filter (pixels, copies, a round `border`). */
export function isRaster(fx: Effect | EffectKind | undefined, ctx?: { raster?: boolean }): boolean;
/** Such an effect's markup, with its mask; undefined where nothing can draw pixels (its filter is used). */
export function rasterEffect(fx: Effect, m: Markup, ctx: RenderContext, i: number): Promise<Markup | undefined>;
export { expandDropShadows } from './drop-shadow.js';

/** Wrap markup in a layer's filter effects, in order (innermost first); `content`: the box the layer paints; `prior`: the defs so far. */
export function applyEffects(body: string, list: Effect | Effect[], ctx: RenderContext, start?: number, content?: { x: number; y: number; width: number; height: number }, prior?: string): { defs: string; body: string };
