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
import { LAYER_OPTIONS, COMMON } from '../src/layer-options.js';

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
  ramp: ['[from, to, steps, amount?]: steps colours from one toward the other.', { type: 'array', minItems: 3, maxItems: 4, items: { $ref: '#/$defs/value' } }],
  taper: ['[ratio, steps]: [1, ratio, ratio², …].', { type: 'array', minItems: 2, maxItems: 2, items: { $ref: '#/$defs/value' } }],
  reverse: ['An array backwards.', { $ref: '#/$defs/value' }],
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
    description: 'A cover style as data: params, vars and a stack of layers. See the README, "JSON recipes".',
    type: 'object',
    required: ['layers'],
    additionalProperties: false,
    properties: {
      $schema: { type: 'string' },
      name: { type: 'string', description: 'Shown in error messages.' },
      description: { type: 'string' },
      params: { type: 'object', description: 'Options this recipe reads, with defaults. Cover options of the same name override them; use them as "{name}".', additionalProperties: { $ref: '#/$defs/value' } },
      requires: { type: 'array', items: { type: 'string' }, description: 'Options that must be set (e.g. "image").' },
      vars: { type: 'object', description: 'Named values, resolved in order (draws use the recipe stream); use them as "$name".', additionalProperties: { $ref: '#/$defs/value' } },
      layers: { type: 'array', minItems: 1, items: { $ref: '#/$defs/layer' } },
    },
    $defs: {
      token: {
        type: 'string',
        description: '@bg @text @accent @onAccent @muted @surface @mode @colors @colors.N @width @height @u · $var · {param} {title} {label} {icon} {image} {opt.x} · a length ("12vmin", "4vw") · a colour · any text',
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
        description: '"title" (the option is set), { "background": "gradient" } (equals; "mode" is the palette\'s), { "not": … }, { "all": [...] }, { "any": [...] }.',
        anyOf: [
          { type: 'string' },
          { type: 'boolean' },
          { type: 'object', required: ['not'], additionalProperties: false, properties: { not: { $ref: '#/$defs/condition' } } },
          { type: 'object', required: ['all'], additionalProperties: false, properties: { all: { type: 'array', items: { $ref: '#/$defs/condition' } } } },
          { type: 'object', required: ['any'], additionalProperties: false, properties: { any: { type: 'array', items: { $ref: '#/$defs/condition' } } } },
          { type: 'object', minProperties: 1, not: { anyOf: [{ required: ['not'] }, { required: ['all'] }, { required: ['any'] }] }, additionalProperties: { type: ['string', 'number', 'boolean', 'array'] } },
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
              Object.entries({ ...LAYER_OPTIONS[type], ...COMMON }).map(([k, d]) => [k, { $ref: '#/$defs/value', description: d }]),
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
