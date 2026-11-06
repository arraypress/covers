/**
 * Builds `schema/recipe.schema.json`, the JSON Schema for recipe documents.
 *
 *   node scripts/schema.mjs          # write it
 *   (tests/json-recipes.test.js checks the committed file matches)
 *
 * Every layer option accepts a token or operator as well as a literal, so
 * option values are `$ref: value`; what the schema adds is the list of
 * layer types and each type's option names, for editor autocomplete.
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { LAYER_OPTIONS, COMMON, MOTION_OPTIONS } from '../src/layer-options.js';
import { MOTION_PRESETS } from '../src/animate/timing.js';
import { PARAM_TYPES } from '../src/params.js';
import { EFFECT_OPTIONS, EFFECT_COMMON } from '@logomarks/image-effects';

/** Operators: name → [description, argument schema]. */
const OPS = {
  mix: ['Mix two colours: [a, b, t] in OKLab, or [a, b, t, "oklch"] (hue the short way, stays vivid).', { type: 'array', minItems: 3, maxItems: 4, items: { $ref: '#/$defs/value' } }],
  readable: ['White, or near-black on a light colour: c, [c, light, dark], or [backgrounds, ratio, prefer] (prefer "white" | "black" | a colour when it clears ratio on every background).', { $ref: '#/$defs/value' }],
  tone: ['[color, { l: [min, max], c: [min, max] }]: the colour pulled into an OKLCH band, hue kept.', { type: 'array', minItems: 2, maxItems: 2, items: { $ref: '#/$defs/value' } }],
  gradientUnder: ['[colors, angle, size]: the colours a centred square of that size covers in a linear gradient.', { type: 'array', minItems: 3, maxItems: 3, items: { $ref: '#/$defs/value' } }],
  pick: ['One item, seeded.', { type: 'array', minItems: 1, items: { $ref: '#/$defs/value' } }],
  range: ['A float in [min, max), seeded.', { type: 'array', minItems: 2, maxItems: 2, items: { $ref: '#/$defs/value' } }],
  int: ['An integer in [min, max], seeded.', { type: 'array', minItems: 2, maxItems: 2, items: { $ref: '#/$defs/value' } }],
  add: ['Sum (lengths become px).', { type: 'array', minItems: 1, items: { $ref: '#/$defs/value' } }],
  sub: ['First minus the rest.', { type: 'array', minItems: 2, items: { $ref: '#/$defs/value' } }],
  mul: ['Product.', { type: 'array', minItems: 1, items: { $ref: '#/$defs/value' } }],
  div: ['a / b.', { type: 'array', minItems: 2, maxItems: 2, items: { $ref: '#/$defs/value' } }],
  min: ['Smallest.', { type: 'array', minItems: 1, items: { $ref: '#/$defs/value' } }],
  max: ['Largest.', { type: 'array', minItems: 1, items: { $ref: '#/$defs/value' } }],
  round: ['To the nearest whole number.', { $ref: '#/$defs/value' }],
  floor: ['Down to a whole number.', { $ref: '#/$defs/value' }],
  ceil: ['Up to a whole number.', { $ref: '#/$defs/value' }],
  ramp: ['[from, to, steps, amount?]: steps colours from one toward the other.', { type: 'array', minItems: 3, maxItems: 4, items: { $ref: '#/$defs/value' } }],
  taper: ['[ratio, steps]: [1, ratio, ratio², …].', { type: 'array', minItems: 2, maxItems: 2, items: { $ref: '#/$defs/value' } }],
  length: ['Characters in a string (a number\'s digits) or items in an array.', { $ref: '#/$defs/value' }],
  reverse: ['An array backwards.', { $ref: '#/$defs/value' }],
  join: ['[array, separator?]: items joined into one string (default a space).', { type: 'array', minItems: 1, maxItems: 2, items: { $ref: '#/$defs/value' } }],
  upper: ['A string in capitals.', { $ref: '#/$defs/value' }],
  lower: ['A string in lower case.', { $ref: '#/$defs/value' }],
  slice: ['[array or string, start, end?].', { type: 'array', minItems: 2, maxItems: 3, items: { $ref: '#/$defs/value' } }],
};

/**
 * The schema.
 *
 * @returns {object}
 */
export function buildSchema() {
  const types = Object.keys(LAYER_OPTIONS);
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://unpkg.com/@arraypress/covers/schema/recipe.schema.json',
    title: '@arraypress/covers recipe',
    description: 'A cover style as data: params, vars and a stack of layers. See docs/json-recipes.md.',
    type: 'object',
    required: ['layers'],
    additionalProperties: false,
    properties: {
      $schema: { type: 'string' },
      name: { type: 'string', description: 'Shown in error messages.' },
      description: { type: 'string' },
      params: { type: 'object', description: 'Options this recipe reads, with defaults. Cover options of the same name override them; use them as "{name}".', additionalProperties: { $ref: '#/$defs/value' } },
      controls: {
        type: 'object',
        description: 'Hints for editors, by param (describeParams() reads them): an enum\'s choices, a slider\'s range, that an empty default is a colour.',
        additionalProperties: {
          type: 'object', additionalProperties: false,
          properties: {
            type: { enum: [...PARAM_TYPES], description: 'The control, where the default doesn\'t imply it.' },
            label: { type: 'string' },
            enum: { type: 'array', minItems: 1, items: { type: ['string', 'number'] }, description: 'The choices.' },
            min: { type: 'number' },
            max: { type: 'number' },
            step: { type: 'number' },
            help: { type: 'string' },
            hidden: { type: 'boolean', description: 'Leave the param out of forms.' },
          },
        },
      },
      requires: { type: 'array', items: { type: 'string' }, description: 'Options that must be set (e.g. "image").' },
      vars: { type: 'object', description: 'Named values, resolved in order (draws use the recipe stream); use them as "$name".', additionalProperties: { $ref: '#/$defs/value' } },
      output: { type: 'object', additionalProperties: false, description: 'The encoding this style prefers in renderImage (options passed to renderImage win).', properties: { lossless: { type: 'boolean', description: 'Lossless WebP/AVIF: for flat or 1-bit art (dither).' } } },
      pages: { type: 'array', items: { type: 'string' }, description: 'The pages of a two-sided piece (["front", "back"]); a layer picks its page with when: { "page": "back" }. renderPages() renders each.' },
      fonts: {
        type: 'array',
        description: 'Fonts the recipe uses, loaded when it renders: a path beside the recipe file, or a URL (TTF, OTF, WOFF or WOFF2).',
        items: {
          type: 'object', required: ['name', 'src'], additionalProperties: false,
          properties: {
            name: { type: 'string', description: 'The family, as text layers ask for it.' },
            src: { type: 'string', description: 'A path (beside the recipe) or a URL.' },
            weight: { oneOf: [{ type: 'number' }, { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 }], description: 'A weight, or a variable font\'s range.' },
            style: { enum: ['normal', 'italic'] },
            axes: { type: 'object', additionalProperties: { type: 'number' }, description: 'Variable axes applied whenever this face is used.' },
            fallback: { type: 'boolean', description: 'Use this face for characters other fonts lack.' },
          },
        },
      },
      layers: { type: 'array', minItems: 1, items: { $ref: '#/$defs/layer' } },
    },
    $defs: {
      token: {
        type: 'string',
        description: '@bg @text @accent @onAccent @muted @surface @mode @colors @colors.N @width @height @u (print: @bleed @safe @mm @dpi @trimWidth @trimHeight) · $var · {param} {title} {label} {icon} {image} {name} {mark} {photo} {cutout} {lineup.0} {opt.x} · a length ("12vmin", "4vw") or "50%" · a colour · any text',
      },
      value: {
        anyOf: [
          { $ref: '#/$defs/token' },
          { type: ['number', 'boolean', 'null'] },
          { type: 'array', items: { $ref: '#/$defs/value' } },
          { $ref: '#/$defs/if' },
          ...Object.entries(OPS).map(([name, [description, args]]) => ({
            type: 'object', description, required: [name], additionalProperties: false, properties: { [name]: args },
          })),
          { type: 'object', additionalProperties: { $ref: '#/$defs/value' } },
        ],
      },
      if: {
        type: 'object',
        description: 'A choice: only the chosen side is evaluated.',
        required: ['if', 'then'],
        additionalProperties: false,
        properties: { if: { $ref: '#/$defs/condition' }, then: { $ref: '#/$defs/value' }, else: { $ref: '#/$defs/value' } },
      },
      condition: {
        description: '"title" (the option is set), { "background": "gradient" } (equals; "mode" is the palette\'s, "aspect" the canvas\'s: wide | square | tall, "page" the page being drawn: front | back), { "not": … }, { "all": [...] }, { "any": [...] }.',
        anyOf: [
          { type: 'string' },
          { type: 'boolean' },
          { type: 'object', required: ['not'], additionalProperties: false, properties: { not: { $ref: '#/$defs/condition' } } },
          { type: 'object', required: ['all'], additionalProperties: false, properties: { all: { type: 'array', items: { $ref: '#/$defs/condition' } } } },
          { type: 'object', required: ['any'], additionalProperties: false, properties: { any: { type: 'array', items: { $ref: '#/$defs/condition' } } } },
          { type: 'object', minProperties: 1, not: { anyOf: [{ required: ['not'] }, { required: ['all'] }, { required: ['any'] }] }, additionalProperties: { type: ['string', 'number', 'boolean', 'array'] } },
        ],
      },
      effects: {
        if: { type: 'array' },
        then: { items: { if: { type: 'object', required: ['kind'] }, then: { $ref: '#/$defs/effect' }, else: { $ref: '#/$defs/value' } } },
        else: { $ref: '#/$defs/value' },
      },
      effect: {
        type: 'object',
        required: ['kind'],
        properties: { kind: { enum: Object.keys(EFFECT_OPTIONS) } },
        allOf: Object.keys(EFFECT_OPTIONS).map((kind) => ({
          if: { properties: { kind: { const: kind } }, required: ['kind'] },
          then: {
            properties: Object.fromEntries(Object.entries({ ...EFFECT_OPTIONS[kind], ...EFFECT_COMMON }).filter(([k]) => k !== 'kind').map(([k, d]) => [k, { $ref: '#/$defs/value', description: d }])),
            propertyNames: { enum: [...Object.keys(EFFECT_OPTIONS[kind]), ...Object.keys(EFFECT_COMMON)] },
          },
        })),
      },
      motion: {
        anyOf: [{ $ref: '#/$defs/motionItem' }, { type: 'array', items: { $ref: '#/$defs/motionItem' } }],
      },
      motionItem: {
        anyOf: [
          { enum: Object.keys(MOTION_PRESETS), description: 'A preset with its defaults.' },
          {
            type: 'object',
            additionalProperties: false,
            properties: Object.fromEntries(Object.entries(MOTION_OPTIONS).map(([k, d]) => [k, k === 'preset' ? { enum: Object.keys(MOTION_PRESETS), description: d } : { $ref: '#/$defs/value', description: d }])),
          },
        ],
      },
      layer: {
        type: 'object',
        required: ['type'],
        properties: {
          type: { enum: types },
          id: { type: 'string', description: 'Names the layer for overrides (cover({ <id>: {...} | false })).' },
          when: { $ref: '#/$defs/condition', description: 'Include the layer only when this holds.' },
        },
        allOf: types.map((type) => ({
          if: { properties: { type: { const: type } }, required: ['type'] },
          then: {
            properties: Object.fromEntries(
              Object.entries({ ...LAYER_OPTIONS[type], ...COMMON }).map(([k, d]) => [k, k === 'effects' ? { $ref: '#/$defs/effects', description: d } : k === 'motion' ? { $ref: '#/$defs/motion', description: d } : { $ref: '#/$defs/value', description: d }]),
            ),
            propertyNames: { enum: ['type', 'id', 'when', ...Object.keys(LAYER_OPTIONS[type]), ...Object.keys(COMMON)] },
          },
        })),
      },
    },
  };
}

/** The schema file's text. */
export const schemaText = () => `${JSON.stringify(buildSchema(), null, 2)}\n`;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(new URL('../schema/recipe.schema.json', import.meta.url), schemaText());
  console.log('schema/recipe.schema.json written');
}
