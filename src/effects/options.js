/**
 * Every effect kind's options, with one-line descriptions. `defineRecipe`
 * rejects kinds and options not listed here, `scripts/schema.mjs` builds
 * the JSON Schema's autocomplete from it, and the README's table follows
 * it. Add an option to an effect, add it here.
 *
 * @module effects/options
 */

/** Options every effect takes. @type {Record<string, string>} */
export const EFFECT_COMMON = {
  kind: 'The effect.',
  mask: '{ gradient: linear | radial | band, from, to, center, angle, aspect, invert, ease } or { layers, invert }: where the effect applies.',
  colorSpace: 'sRGB (default) | linearRGB: where filter primitives do their arithmetic.',
  pad: 'Filter region padding, a fraction of the canvas.',
};

const BLUR_CENTRE = 'Centre, [x, y] fractions. Default [0.5, 0.5].';

/** @type {Record<string, Record<string, string>>} */
export const EFFECT_OPTIONS = {
  // 1.1's first set.
  blur: { radius: 'Length.', x: 'Length (an axis-aligned blur).', y: 'Length.', edge: 'duplicate: hold the edge.' },
  motion: { angle: 'Degrees.', length: 'Length: the blur along the angle (a standard deviation).', spread: 'Length across.' },
  shadow: { x: 'Length.', y: 'Length.', blur: 'Length.', color: 'Colour.', opacity: '0–1.', spread: 'Length.' },
  glow: { x: 'Length.', y: 'Length.', blur: 'Length.', color: 'Colour.', opacity: '0–1.', spread: 'Length.' },
  border: { width: 'Length.', color: 'Colour.', line: 'true or a colour: the cut line.', lineWidth: 'Length.', shape: 'die | circle', cx: 'Length.', cy: 'Length.' },
  wear: { rough: 'Length.', uneven: '0–1.', specks: '0–1.', seed: 'Number.' },
  rough: { scale: 'Length.', frequency: 'Number or [x, y].', octaves: 'Number.', seed: 'Number.' },
  warp: { scale: 'Length.', frequency: 'Number or [x, y].', octaves: 'Number.', seed: 'Number.' },
  xerox: { rough: 'Length.', dropout: '0–1.', seed: 'Number.' },
  photocopy: { ink: 'Colour.', contrast: 'Number.', lift: 'Number.', noise: '0–1.', frequency: 'Number.', seed: 'Number.' },
  duotone: { colors: 'Two or more, shadows first.', contrast: 'Number.' },
  grayscale: { slope: 'Number.', intercept: 'Number.', contrast: 'Number.', brightness: 'Number.', black: 'Input black point, 0–1.', white: 'Input white point, 0–1.', gamma: 'Midtones (>1 lighter).', output: '[lo, hi] output range, 0–1.' },
  levels: { slope: 'Number.', intercept: 'Number.', contrast: 'Number.', brightness: 'Number.', black: 'Input black point, 0–1.', white: 'Input white point, 0–1.', gamma: 'Midtones (>1 lighter).', output: '[lo, hi] output range, 0–1.' },
  saturate: { amount: 'Number (1 unchanged).' },
  matrix: { values: '20 numbers.' },
  grit: { amount: '0–1.', frequency: 'Number.', seed: 'Number.' },
  halftone: { ink: 'Colour.', cell: 'Length.', angle: 'Degrees.', contrast: 'Number.', lift: 'Number.', softness: 'Number.', shape: 'dot (default) | line | square | diamond | cross' },
  dither: { ink: 'Colour.', paper: 'Colour.', cell: 'Length.', contrast: 'Number.', brightness: 'Number.', pixelate: 'Boolean.', weights: '[r, g, b].', matrix: 'bayer4 | bayer8' },
  threshold: { level: '0–1.', ink: 'Colour.', paper: 'Colour or none.' },
  filter: { markup: 'Raw filter primitives.' },
  extrude: { depth: 'Length.', angle: 'Degrees.', offset: '[x, y] lengths.', steps: 'Number.', color: 'Colour.', to: 'Colour.' },

  // Blurs.
  zoom: { center: BLUR_CENTRE, amount: '0–0.95: how much of the way to the centre each point is smeared. Default 0.2.' },
  spin: { center: BLUR_CENTRE, angle: 'Degrees of rotation. Default 12.' },
  tilt: { center: 'A point on the sharp line, [x, y] fractions.', angle: 'Degrees (0: a horizontal band).', width: 'Length: half the sharp band. Default "8vmin".', falloff: 'Length over which the blur grows. Default "22vmin".', radius: 'Length: the strongest blur. Default "1.4vmin".', saturate: 'Number (the miniature look: 1.2).' },
  lens: { radius: 'Length: the aperture. Default "1.2vmin".', blades: '0 (round) or 3–12 sides.', rotation: 'Degrees.', highlights: 'Boost of the bright parts (bokeh). Default 1.', threshold: '0–1: what counts as a highlight. Default 0.75.' },

  // Distortions.
  wave: { amplitude: 'Length.', wavelength: 'Length.', angle: 'Degrees the wave travels.', phase: '0–1 of a period.', shape: 'sine | triangle | square' },
  ripple: { center: BLUR_CENTRE, amplitude: 'Length.', wavelength: 'Length.', phase: '0–1.', radius: 'Length it fades out by.' },
  twirl: { center: BLUR_CENTRE, angle: 'Degrees at the centre. Default 180.', radius: 'Length.' },
  bulge: { center: BLUR_CENTRE, amount: '0–1.', radius: 'Length.' },
  pinch: { center: BLUR_CENTRE, amount: '0–1.', radius: 'Length.' },
  fisheye: { center: BLUR_CENTRE, amount: '0–1. Default 0.6.' },
  glass: { texture: 'frosted | reeded | pebbled', size: 'Length: grain, rib or lump.', amount: 'Frosted, pebbled: a length; reeded: 0–1.', angle: 'Reeded: rib angle, degrees.', shade: 'Reeded: rib shading, 0–1.', seed: 'Number or string.' },
  displace: { amount: 'Length.', map: '{ layers }: displace by their luminance (default seeded noise).', mode: 'gradient (default) | channels', size: 'Noise: length.', octaves: 'Noise detail.', seed: 'Number or string.' },
  kaleidoscope: { segments: 'Wedges. Default 8.', center: BLUR_CENTRE, angle: 'Degrees: where the source wedge starts (default -90, up).', scale: 'Zoom of the source. Default 1.' },
  mirror: { keep: 'left | right | top | bottom | top-left | top-right | bottom-left | bottom-right', at: 'The mirror line: a fraction, or [x, y].' },
  stretch: { at: '0–1: the row or column.', direction: 'down | up | left | right', length: '0–1 of the way to the edge.', fade: '0–1.' },
  sort: { direction: 'horizontal | vertical', threshold: '[lo, hi] luminance, 0–1.', by: 'luma | hue | saturation', reverse: 'Boolean.', length: '0–1: break runs at seeded lengths.', seed: 'Number or string.' },

  // Colour.
  curves: { points: '[[in, out], …] 0–1, all channels.', red: 'Points.', green: 'Points.', blue: 'Points.' },
  gradientMap: { colors: 'Shadows to highlights.', stops: 'Positions, 0–1.', space: 'srgb | oklab' },
  posterize: { levels: 'Tones per channel. Default 4.' },
  invert: { amount: '0–1. Default 1.' },
  hue: { angle: 'Degrees.', saturation: '-1–1.', lightness: '-1–1.' },
  vibrance: { amount: '-1–1. Default 0.5.', saturation: '-1–1.' },
  colorBalance: { shadows: '[r, g, b], -1–1.', midtones: '[r, g, b].', highlights: '[r, g, b].' },
  channelMixer: { red: '[r, g, b, constant].', green: 'Row.', blue: 'Row.', monochrome: 'Boolean.', gray: 'Row (monochrome).' },
  sepia: { amount: '0–1.' },
  look: { name: 'fade | crossProcess | bleachBypass | tealOrange | warmFilm | coolFilm | noir', amount: '0–1.' },

  // Light.
  bloom: { threshold: '0–1.', radius: 'Length.', intensity: 'Number.', color: 'Tint.' },
  halation: { threshold: '0–1.', radius: 'Length.', intensity: 'Number.', color: 'Default red-orange.' },
  vignette: { shape: 'ellipse | circle | rect', size: '0–1: where it starts.', softness: '0–1.', amount: '0–1.', color: 'Default black.', center: BLUR_CENTRE },
  lightLeak: { edge: 'left | right | top | bottom (default seeded)', colors: 'Colours.', intensity: 'Number.', seed: 'Number or string.' },
  lensFlare: { at: 'The light, [x, y] fractions.', size: 'Length.', intensity: 'Number.', color: 'Tint.', ghosts: 'Count. Default 6.', streak: 'true or a width factor: an anamorphic streak.', seed: 'Number or string.' },
  rays: { center: 'The light, [x, y] fractions (default the brightest patch).', threshold: '0–1.', length: 'How far rays reach, a fraction of the frame. Default 0.5.', intensity: 'Number.', color: 'Tint.' },

  // Texture and print.
  grain: { amount: '0–1.', size: 'Length.', color: 'Boolean: colour grain.', seed: 'Number.' },
  dust: { amount: '0–1.', scratches: 'Count.', color: 'light | dark | mixed', seed: 'Number or string.' },
  paper: { texture: 'paper | canvas', scale: 'Length.', amount: '0–1.', angle: 'Light azimuth, degrees.', seed: 'Number.' },
  scanlines: { spacing: 'Length.', thickness: '0–1.', amount: '0–1.' },
  crt: { mask: 'aperture | shadow', size: 'Length: a triad.', amount: '0–1.', scanlines: '0–1.', curvature: '0–1.' },
  vhs: { shift: 'Length: chroma shift.', bleed: 'Length: chroma smear.', jitter: 'Length.', tracking: '0–1.', noise: '0–1.', seed: 'Number or string.' },
  jpeg: { quality: '1–100. Default 12.', block: 'Length: a JPEG pixel.', passes: 'Re-saves, 1–8.', subsample: 'Boolean. Default true.' },
  newsprint: { cell: 'Length: the screen.', angles: '[c, m, y, k] degrees.', paper: 'Colour.', gain: 'Dot gain, 0–0.3.', gcr: '0–1.' },

  // Digital.
  chromatic: { amount: 'Length.', angle: 'Degrees (directional).', mode: 'directional (default) | radial', center: BLUR_CENTRE },
  rgbSplit: { amount: 'Length.', angle: 'Degrees.' },
  glitch: { amount: '0–1.', shift: 'Length.', slices: 'Count.', blocks: 'Count.', seed: 'Number or string.' },
  pixelate: { size: 'Length.', shape: 'square | hex' },
  mosaic: { size: 'Length.', shape: 'square | hex' },
  ascii: { cell: 'Length.', ramp: 'Characters, sparse to dense.', color: 'source | a colour.', background: 'Colour or none.', invert: 'Boolean.', contrast: 'Number.' },
  emboss: { angle: 'Degrees.', amount: 'Number.', radius: 'Length.', color: 'Boolean: over the layer.' },
  edges: { radius: 'Length.', amount: 'Number.', style: 'ink | glow', color: 'Ink colour.', mono: 'Boolean.' },
  sketch: { radius: 'Length.', darkness: '0–1.', color: 'Boolean: coloured pencil.' },
  sharpen: { amount: 'Number.', radius: 'Length.' },
};
