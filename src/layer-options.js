/**
 * Every layer type's option names, with one-line descriptions. The JSON
 * recipe validator rejects names not listed here, and
 * `scripts/schema.mjs` builds the JSON Schema's autocomplete from it.
 * Add an option to a layer, add it here.
 *
 * @module layer-options
 */

/** @type {Record<string, Record<string, string>>} Layer options, by type: name → description. */
export const LAYER_OPTIONS = {
  solid: { color: 'Fill. Default @bg.' },
  linear: { colors: 'Two or more colours.', opacities: 'Per-stop opacity.', angle: 'CSS degrees (0 = up). Default seeded.', ease: 'Smoothstep stops. Default true.' },
  radial: { colors: 'Centre → edge.', x: 'Centre x, 0–1.', y: 'Centre y, 0–1.', radius: 'Length. Default "80vmax".', ease: 'Default true.' },
  mesh: { colors: 'Blob colours.', hues: 'Distinct colours to use. Default 3.', count: 'Blobs. Default 4.', blur: 'Length. Default "11vmax".', spread: '0–1. Default 0.7.', size: '[min, max] radius, fractions of the longer side.', base: 'Fill under the blobs; null for none.', blobs: 'Explicit [{ x, y, r, squash, rotate, color, opacity }].' },
  stripes: { direction: 'vertical | horizontal | diagonal', angle: 'For diagonal.', count: 'Stripes. Default 8.', widths: 'even | random | taper | [weights]', taper: 'Ratio for widths: taper.', colors: 'Cycled.', gap: 'Length.', radius: 'Length.', region: '{ x, y, width, height } fractions.', regionRadius: 'Length.' },
  image: { src: 'A local path, data: URI or bytes ("{image}").', fit: 'cover | contain', focus: 'An anchor, attention or entropy.', region: 'Fractions.', duotone: 'true or [shadow, highlight].', grayscale: 'boolean', normalize: 'Stretch tones first.', tint: 'A colour or { color, amount, blend }.', blur: 'Length.' },
  grain: { amount: '0–1. Default 0.08.', size: 'Grain px. Default 1.', monochrome: 'Default true.' },
  pattern: { kind: 'grid | dots | lines | rings | waves', size: 'Cell. Length.', stroke: 'Length.', color: 'Default @text.', angle: 'For lines.', center: '{ x, y } fractions.', wavelength: 'Length.', amplitude: 'Length.', fade: 'none | radial | edges | top | bottom | left | right', region: 'Fractions.' },
  shapes: { kind: 'circle | square | pill | mixed', count: 'Default 6.', size: '[min, max] lengths.', colors: 'Cycled.', placement: 'scatter | row | column', items: '[{ kind, x, y, size, color, rotate, opacity }]', region: 'Fractions.', rotate: 'Tilt squares and pills.', radius: 'Square corner, fraction of size.', outline: 'true or a width.' },
  icon: { name: 'Iconify name ("lucide:feather") or raw SVG ("{icon}").', svg: 'Raw SVG.', path: 'A path d.', viewBox: '[x, y, w, h] for path.', size: 'Length. Default "24vmin".', color: 'Default the accent on a tile, else @text.', strokeWidth: 'Stroke icons.', anchor: 'One of nine anchors.', position: '{ x, y } fractions.', offset: '{ x, y } lengths.', margin: 'Length.', tile: 'true or { size, radius, color, shadow, border }.' },
  text: { content: 'The text ("{title}").', font: 'Family. Default Inter.', weight: 'Default 600.', style: 'normal | italic', size: 'Length.', minSize: 'Shrink toward this before truncating.', lineHeight: 'Default 1.12.', letterSpacing: 'Em. Default -0.02.', color: 'Default @text.', align: 'left | center | right', anchor: 'Default bottom-left.', position: '{ x, y } fractions.', offset: '{ x, y } lengths.', margin: 'Length.', maxWidth: 'Length.', maxLines: 'Default 3.', ellipsis: "Default '…'.", balance: 'Default true.', transform: 'none | uppercase | lowercase', label: 'A string or { content, size, weight, color, letterSpacing, transform, gap }.', background: 'A colour or { color, radius, padding, opacity }.' },
  frame: { inset: 'Length.', radius: 'Length.', stroke: 'Length.', color: 'Default @text.', fill: 'A colour (a card).' },
};

/** @type {Record<string, string>} Options every layer takes (besides type, id and when). */
export const COMMON = { opacity: '0–1.', blend: 'A CSS mix-blend-mode.', seed: "This layer's own random stream." };

