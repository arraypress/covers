/**
 * Declarative recipes: a cover style written as JSON.
 *
 * ```json
 * {
 *   "$schema": "https://unpkg.com/@arraypress/covers/schema/recipe.schema.json",
 *   "name": "poster",
 *   "params": { "background": "solid" },
 *   "vars": { "ink": { "readable": "@accent" } },
 *   "layers": [
 *     { "id": "bg", "type": "solid", "color": "@accent", "when": { "background": "solid" } },
 *     { "id": "bg", "type": "linear", "colors": ["@accent", "@colors.1"], "when": { "background": "gradient" } },
 *     { "id": "title", "type": "text", "content": "{title}", "color": "$ink", "when": "title" }
 *   ]
 * }
 * ```
 *
 * Values are resolved when the cover is built:
 *
 * | Form | Means |
 * |---|---|
 * | `"@bg"` … | palette fields (`bg`, `text`, `accent`, `onAccent`, `muted`, `surface`, `mode`, `colors`, `colors.N`) and canvas numbers (`width`, `height`, `u`) |
 * | `"$name"`, `"$name.0"` | a value from `vars` (and an item or field of it) |
 * | `"{layout.title.bottom}"`, `"{layout.title.bottom + 12}"` | where an earlier text layer's block landed (`top`, `bottom`, `left`, `right`, `width`, `height`, `x`, `y`, `baseline`, `size`, `lines`), filled in when drawn |
 * | `"{#col * 40}"` | inside a `repeat`: an expression over the instance (`i`, `row`, `col`, `n`, `odd`, …), filled when drawn |
 * | `"{title}"` | a param or content option (`title`, `label`, `icon`, `image`); `"{opt.x}"` any cover option. A whole-string token keeps the value's type; inside a longer string it's interpolated. |
 * | `{ "mix": [a, b, t, space?] }` | two colours mixed in OKLab (or `"oklch"`: hue the short way, stays vivid) |
 * | `{ "readable": c }` | white, or near-black on a light colour (`[c, light, dark]` to choose) |
 * | `{ "readable": [bgs, ratio, prefer] }` | `prefer` (`"white"`, `"black"`, a colour) if it clears `ratio` on every background, else the better of white / near-black |
 * | `{ "tone": [color, { l: [min, max], c: [min, max] }] }` | the colour pulled into an OKLCH band (its hue kept) |
 * | `{ "gradientUnder": [colors, angle, size] }` | the colours a centred square of `size` covers in a linear gradient |
 * | `{ "pick": [...] }`, `{ "range": [min, max] }`, `{ "int": [min, max] }` | seeded choices |
 * | `{ "add" \| "sub" \| "mul" \| "div" \| "min" \| "max": [a, b, …] }` | arithmetic; lengths like `"54vw"` become pixels |
 * | `{ "round" \| "floor" \| "ceil": x }` | to a whole number (a grid's row count from the canvas) |
 * | `{ "ramp": [from, to, steps, amount?] }` | `steps` colours from `from` toward `to` |
 * | `{ "taper": [ratio, steps] }` | `[1, ratio, ratio², …]` |
 * | `{ "length": value }` | characters in a string (or a number's digits), items in an array |
 * | `{ "reverse": [...] }` | the array backwards |
 * | `{ "if": cond, "then": a, "else": b }` | a choice (only the chosen side is evaluated) |
 *
 * Conditions (`when` on a layer, `if`): `"title"` (the option is set),
 * `{ "background": "gradient" }` (a param or option equals a value; `mode`
 * is the palette's, `aspect` the canvas's: `wide`, `square` or `tall`),
 * `{ "not": c }`, `{ "all": [...] }`, `{ "any": [...] }`.
 *
 * Fonts: `"fonts": [{ "name": "Fraunces", "src": "fonts/Fraunces.woff2", "weight": [100, 900] }]`
 * declares the faces a recipe uses (a path beside the recipe file, or a URL),
 * so a caller needn't register them.
 *
 * Seeding: `vars` draw from the cover's recipe stream in order; draws inside
 * a layer use that layer's own stream, so adding a layer never changes
 * another's choices.
 *
 * @module json-recipe
 */

import { readTextSync, node } from './platform/index.js';
import { readableText } from '@arraypress/color-utils';
import { createRng } from '@logomarks/image-effects/rng';
import { len } from '@logomarks/image-effects/length';
import { ANCHORS } from './geometry.js';
import { toHex, mixOklab, mixOklch, onBackground, gradientAt } from '@logomarks/image-effects/color';
import { LAYERS, toneColor } from './layers.js';
import { LAYER_OPTIONS, COMMON, MOTION_OPTIONS } from './layer-options.js';
import { EFFECT_OPTIONS, EFFECT_COMMON, MASK_GRADIENTS } from '@logomarks/image-effects';
import { shapesOnly } from './layers/svg.js';
import { LAYOUT_FIELDS } from './type/layout-ref.js';
import { MOTION_PRESETS } from './animate/timing.js';
import { checkControls } from './params.js';

/** Options every recipe can read without declaring them. */
const CONTENT = ['title', 'label', 'icon', 'image', 'name', 'mark', 'photo', 'cutout', 'date', 'dates', 'time', 'venue', 'address', 'lines', 'lineup', 'tracklist', 'price', 'meta', 'page'];

/** `@` tokens. */
const PALETTE = ['bg', 'text', 'accent', 'onAccent', 'muted', 'surface', 'mode', 'colors'];
const CANVAS = ['width', 'height', 'u', 'bleed', 'safe', 'mm', 'dpi', 'trimWidth', 'trimHeight', 'safeX', 'safeY', 'safeWidth', 'safeHeight'];

/** Value operators, by name, with their argument arity. */
const OPS = /** @type {Record<string, [number, number]>} */ ({
  mix: [3, 4], readable: [1, 3], gradientUnder: [3, 3], tone: [2, 2], length: [1, 1], pick: [1, Infinity], range: [2, 2], int: [2, 2],
  add: [1, Infinity], sub: [2, Infinity], mul: [1, Infinity], div: [2, 2], min: [1, Infinity], max: [1, Infinity],
  round: [1, 1], floor: [1, 1], ceil: [1, 1],
  ramp: [3, 4], taper: [2, 2], reverse: [1, 1],
  join: [1, 2], upper: [1, 1], lower: [1, 1], slice: [2, 3],
});

/** Layer options holding nested layers. */
const NESTED = ['layers', 'mask', 'knockout', 'clip'];

/** svg-layer options holding raw markup (their `{{name}}` slots are filled; nothing else is touched). */
const MARKUP = ['markup', 'defs'];

/** Keys of a layer that aren't layer options. */
const LAYER_META = new Set(['id', 'type', 'when']);

/** Top-level keys of a recipe document. */
const TOP = new Set(['$schema', 'name', 'description', 'params', 'controls', 'requires', 'vars', 'output', 'layers', 'pages', 'fonts']);

/** Recipes defined from the same JSON object are reused. */
const defined = new WeakMap();

/**
 * The value of a content-like option for conditions: a string, number or
 * bytes as-is; an override object's `content`, `name`, `svg` or `src`.
 *
 * @param {unknown} v
 * @returns {unknown}
 */
function valueOf(v) {
  if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Uint8Array)) {
    const o = /** @type {any} */ (v);
    return o.content ?? o.name ?? o.svg ?? o.src;
  }
  return v;
}

/** @param {unknown} v @returns {boolean} */
const truthy = (v) => {
  const x = valueOf(v);
  return x !== undefined && x !== null && x !== false && x !== '' && !(Array.isArray(x) && x.length === 0);
};

/** @param {unknown} v @returns {v is Record<string, any>} */
const isPlain = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Uint8Array);

/**
 * Turn a JSON recipe into a recipe function. The document is validated
 * first; any problem throws with the recipe's name and the JSON path.
 *
 * @param {import('./index.js').RecipeJson} json - The recipe document.
 * @returns {import('./index.js').Recipe} The recipe (with `.recipeName` and `.json`).
 * @throws {TypeError} On an invalid document.
 *
 * @example
 * const poster = defineRecipe({ name: 'poster', layers: [{ type: 'solid', color: '@accent' }] });
 * await renderSvg({ recipe: poster, seed: 'x' });
 */
export function defineRecipe(json) {
  if (defined.has(json)) return defined.get(json);
  validate(json);
  const name = json.name ?? 'custom';
  /** @type {any} */
  const recipe = (/** @type {Record<string, unknown>} */ options, /** @type {any} */ c) => build(json, name, options ?? {}, c);
  recipe.recipeName = name;
  recipe.json = json;
  defined.set(json, recipe);
  return recipe;
}

/**
 * Read and define a JSON recipe file (synchronous, for use in configs).
 *
 * @param {string | URL} path - A `.json` file.
 * @returns {import('./index.js').Recipe} The recipe.
 * @throws {TypeError} On invalid JSON or an invalid recipe (the message names the file).
 *
 * @example
 * const house = loadRecipe('./src/covers/house.json');
 */
export function loadRecipe(path) {
  let json;
  try {
    json = JSON.parse(readTextSync(path));
  } catch (err) {
    throw new TypeError(`Couldn't read recipe ${String(path)}: ${/** @type {Error} */ (err).message}`);
  }
  if (isPlain(json) && !json.name) json.name = String(path).split('/').pop()?.replace(/\.json$/, '');
  // Fonts given as paths are beside the recipe.
  const p = node('path');
  if (isPlain(json) && Array.isArray(json.fonts) && p) {
    const dir = p.dirname(path instanceof URL ? path.pathname : String(path));
    json.fonts = json.fonts.map((/** @type {any} */ f) => (isPlain(f) && typeof f.src === 'string' && !/^[a-z][\w+.-]*:|^\//i.test(f.src) ? { ...f, src: p.resolve(dir, f.src) } : f));
  }
  return defineRecipe(json);
}

// ---------------------------------------------------------------------------
// Building
// ---------------------------------------------------------------------------

/**
 * @typedef {object} Scope
 * @property {string} name
 * @property {Record<string, unknown>} options
 * @property {Record<string, unknown>} params
 * @property {Record<string, unknown>} vars
 * @property {any} c - The recipe context.
 * @property {() => import('@logomarks/image-effects/rng').Rng} rng - The current stream.
 */

/**
 * Expand a recipe document into layers.
 *
 * @param {import('./index.js').RecipeJson} json
 * @param {string} name
 * @param {Record<string, unknown>} options
 * @param {any} c
 * @returns {import('./index.js').Layer[]}
 */
function build(json, name, options, c) {
  const params = { ...(json.params ?? {}) };
  for (const k of Object.keys(params)) if (options[k] !== undefined) params[k] = options[k];
  /** @type {Scope} */
  const scope = { name, options, params, vars: {}, c, rng: () => c.rng };

  for (const req of json.requires ?? []) {
    if (!truthy(lookup(scope, req))) throw new TypeError(`Recipe "${name}" needs the "${req}" option`);
  }
  for (const [k, v] of Object.entries(json.vars ?? {})) scope.vars[k] = resolve(scope, v);

  /** @type {Record<string, number>} */
  const seen = {};
  const layers = [];
  for (const layer of json.layers) {
    const n = (seen[layer.type] = (seen[layer.type] ?? -1) + 1);
    let stream;
    const own = { ...scope, rng: () => (stream ??= createRng(`${c.seed ?? ''}:recipe:${layer.id ?? `${layer.type}#${n}`}`)) };
    if (layer.when !== undefined && !test(own, layer.when)) continue;
    layers.push(/** @type {any} */ (resolveLayer(own, layer)));
  }
  return layers;
}

/**
 * Resolve one layer's options (and any layers nested in it).
 *
 * @param {Scope} s
 * @param {any} layer
 * @returns {Record<string, unknown>}
 */
function resolveLayer(s, layer) {
  /** @type {Record<string, unknown>} */
  const out = { ...(layer.id ? { id: layer.id } : {}), type: layer.type };
  for (const [k, v] of Object.entries(layer)) {
    if (LAYER_META.has(k)) continue;
    let r;
    if (NESTED.includes(k) && Array.isArray(v) && v.every((x) => isPlain(x) && typeof x.type === 'string')) {
      r = v.filter((x) => x.when === undefined || test(s, x.when)).map((x) => resolveLayer(s, x));
    } else if (k === 'layer' && isPlain(v) && typeof v.type === 'string') {
      r = resolveLayer(s, v);
    } else if (layer.type === 'svg' && MARKUP.includes(k) && typeof v === 'string') {
      r = fillSlots(s, v);
    } else {
      r = resolve(s, v);
    }
    if (r !== undefined) out[k] = r;
  }
  return out;
}

/**
 * Fill `{{name}}` slots in raw markup: options and params (escaped; a
 * markup value such as `{{mark}}` between elements goes in as sanitised
 * shapes), vars (`{{$name}}`). Palette and canvas tokens (`{{@accent}}`), `{{id}}` and
 * `{{seed}}` are left for the layer to fill when it's drawn.
 *
 * @param {Scope} s
 * @param {string} markup
 * @returns {string}
 */
function fillSlots(s, markup) {
  return markup.replace(/\{\{\s*([$\w.]+)\s*\}\}/g, (m, k, at) => {
    if (k === 'id' || k === 'seed') return m;
    const v = k.startsWith('$') ? resolveString(s, k) : valueOf(lookup(s, k));
    if (v == null) return '';
    // Between elements, a value that is markup (a mark's paths) goes in as shapes; anything else is text.
    const inTag = markup.lastIndexOf('<', at) > markup.lastIndexOf('>', at);
    if (!inTag && /^\s*</.test(String(v))) return shapesOnly(String(v));
    return String(v).replace(/[&<>"']/g, (ch) => /** @type {Record<string, string>} */ ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  });
}

/**
 * Look up a template name: a param, a content option, or `opt.<key>`.
 *
 * @param {Scope} s
 * @param {string} key
 * @returns {unknown}
 */
function lookup(s, key) {
  if (key.startsWith('opt.')) return s.options[key.slice(4)];
  if (Object.hasOwn(s.params, key)) return s.params[key];
  if (Object.hasOwn(s.options, key) || !key.includes('.')) return s.options[key];
  // A path into an option: "lineup.0", "meta.venue".
  const [head, ...rest] = key.split('.');
  const base = Object.hasOwn(s.params, head) ? s.params[head] : s.options[head];
  return rest.reduce((/** @type {any} */ acc, k) => acc?.[k], base);
}

/**
 * Resolve one value.
 *
 * @param {Scope} s
 * @param {unknown} v
 * @returns {unknown}
 */
function resolve(s, v) {
  if (typeof v === 'string') return resolveString(s, v);
  if (Array.isArray(v)) return v.map((x) => resolve(s, x));
  if (!isPlain(v)) return v;
  if ('if' in v) return test(s, v.if) ? resolve(s, v.then) : resolve(s, v.else);
  const keys = Object.keys(v);
  if (keys.length === 1 && Object.hasOwn(OPS, keys[0])) return op(s, keys[0], v[keys[0]]);
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [k, x] of Object.entries(v)) {
    const r = resolve(s, x);
    if (r !== undefined) out[k] = r;
  }
  return out;
}

/**
 * @param {Scope} s
 * @param {string} str
 * @returns {unknown}
 */
function resolveString(s, str) {
  if (str.startsWith('@@') || str.startsWith('$$')) return str.slice(1);
  if (str.startsWith('@')) {
    const [head, idx] = str.slice(1).split('.');
    if (CANVAS.includes(head)) return s.c[head];
    const p = s.c.palette;
    if (head === 'colors' && idx !== undefined) return p.colors[Number(idx) % p.colors.length];
    return head === 'colors' ? p.colors.slice() : p[head];
  }
  if (str.startsWith('$')) {
    const [head, ...path] = str.slice(1).split('.');
    return path.reduce((/** @type {any} */ acc, k) => acc?.[k], s.vars[head]);
  }
  // Layout references are filled in when the cover is drawn.
  if (/^\{layout\.[\w-]+\.\w+\s*(?:[+-]\s*[\d.]+)?\}$/.test(str)) return str;
  const whole = str.match(/^\{([\w.]+)\}$/);
  if (whole) return lookup(s, whole[1]);
  return str.replace(/\{([\w.]+)\}/g, (m, k) => {
    if (k.startsWith('layout.')) return m;
    const x = valueOf(lookup(s, k));
    return x == null ? '' : String(x);
  });
}

/**
 * Evaluate an operator.
 *
 * @param {Scope} s
 * @param {string} name
 * @param {any} raw - Its arguments, unresolved.
 * @returns {unknown}
 */
function op(s, name, raw) {
  if (name === 'reverse') {
    const arr = resolve(s, raw);
    if (!Array.isArray(arr)) throw new TypeError(`Recipe "${s.name}": "reverse" needs an array`);
    return arr.slice().reverse();
  }
  if (name === 'pick') {
    const items = Array.isArray(raw) ? raw : resolve(s, raw);
    return resolve(s, s.rng().pick(/** @type {unknown[]} */ (items)));
  }
  if (name === 'join' || name === 'slice' || name === 'upper' || name === 'lower') {
    const a = Array.isArray(raw) && (name !== 'upper' && name !== 'lower') ? raw.map((x) => resolve(s, x)) : [resolve(s, raw)];
    return op2(name, /** @type {any[]} */ (a));
  }
  const args = /** @type {any[]} */ ([].concat(resolve(s, raw)));
  const nums = () => args.map((a) => (typeof a === 'number' ? a : len(a, s.c)));
  switch (name) {
    case 'readable': {
      // [backgrounds, ratio, prefer]: prefer a colour that clears a ratio (3 for icons).
      if (typeof args[1] === 'number') return onBackground(args[0], args[1], args[2] ?? 'white');
      return readableText(toHex(args[0]), args[1] ? toHex(args[1]) : '#ffffff', args[2] ? toHex(args[2]) : '#111111');
    }
    case 'length': return Array.isArray(resolve(s, raw)) ? /** @type {unknown[]} */ (resolve(s, raw)).length : String(args[0] ?? '').length;
    case 'tone': return toneColor(toHex(args[0]), args[1] ?? {});
    case 'gradientUnder': {
      // The colours a centred square of `size` sits on in a linear gradient at `angle`.
      const [colors, angle, size] = args;
      const box = typeof size === 'number' ? size : len(size, s.c);
      const a = (Number(angle) * Math.PI) / 180;
      const line = Math.abs(s.c.width * Math.sin(a)) + Math.abs(s.c.height * Math.cos(a));
      const half = ((box / 2) * (Math.abs(Math.sin(a)) + Math.abs(Math.cos(a)))) / line;
      return [-1, -0.5, 0, 0.5, 1].map((k) => gradientAt(colors, 0.5 + k * half));
    }
    case 'mix': {
      const mixer = args[3] === 'oklch' ? mixOklch : mixOklab;
      if (args[3] !== undefined && args[3] !== 'oklch' && args[3] !== 'oklab') throw new TypeError(`Recipe "${s.name}": mix space must be "oklab" or "oklch"`);
      return mixer(toHex(args[0]), toHex(args[1]), Number(args[2]));
    }
    case 'range': { const [a, b] = nums(); return s.rng().range(a, b); }
    case 'int': { const [a, b] = nums(); return s.rng().int(a, b); }
    case 'add': return nums().reduce((a, b) => a + b);
    case 'sub': return nums().reduce((a, b) => a - b);
    case 'mul': return nums().reduce((a, b) => a * b);
    case 'div': { const [a, b] = nums(); return a / b; }
    case 'min': return Math.min(...nums());
    case 'max': return Math.max(...nums());
    case 'round': return Math.round(nums()[0]);
    case 'floor': return Math.floor(nums()[0]);
    case 'ceil': return Math.ceil(nums()[0]);
    case 'ramp': {
      const [from, to, steps, amount = 1] = args;
      return Array.from({ length: steps }, (_, i) => mixOklab(toHex(from), toHex(to), (i / steps) * amount));
    }
    case 'taper': { const [ratio, steps] = nums(); return Array.from({ length: steps }, (_, i) => ratio ** i); }
    default: throw new TypeError(`Unknown operator "${name}"`);
  }
}

/**
 * Evaluate a condition.
 *
 * @param {Scope} s
 * @param {unknown} cond
 * @returns {boolean}
 */
function test(s, cond) {
  if (typeof cond === 'string') return truthy(lookup(s, cond));
  if (typeof cond === 'boolean') return cond;
  if (!isPlain(cond)) return false;
  if ('not' in cond) return !test(s, cond.not);
  if ('all' in cond) return cond.all.every((/** @type {unknown} */ c) => test(s, c));
  if ('any' in cond) return cond.any.some((/** @type {unknown} */ c) => test(s, c));
  return Object.entries(cond).every(([k, want]) => {
    const ratio = s.c.width / s.c.height;
    const have = k === 'page' ? s.options.page ?? 'front'
      : k === 'format' ? s.c.format
      : k === 'mode' ? s.c.palette.mode
      : k === 'aspect' ? (ratio > 1.15 ? 'wide' : ratio < 0.87 ? 'tall' : 'square')
      : valueOf(lookup(s, k));
    return Array.isArray(want) ? want.includes(have) : have === want;
  });
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Check a recipe document, throwing on the first problem.
 *
 * @param {any} json
 * @returns {void}
 * @throws {TypeError}
 */
export function validate(json) {
  if (!isPlain(json)) throw new TypeError('A JSON recipe must be an object');
  const name = typeof json.name === 'string' ? json.name : 'custom';
  const fail = (/** @type {string} */ path, /** @type {string} */ msg) => {
    throw new TypeError(`Recipe "${name}": ${path ? `${path}: ` : ''}${msg}`);
  };

  for (const k of Object.keys(json)) if (!TOP.has(k)) fail(k, `unknown key (expected ${[...TOP].join(', ')})`);
  if (json.params !== undefined && !isPlain(json.params)) fail('params', 'must be an object of defaults');
  if (json.output !== undefined && !(isPlain(json.output) && Object.keys(json.output).every((k) => k === 'lossless'))) fail('output', 'is { "lossless": true | false }');
  if (json.vars !== undefined && !isPlain(json.vars)) fail('vars', 'must be an object');
  if (json.pages !== undefined && !(Array.isArray(json.pages) && json.pages.every((/** @type {unknown} */ p) => typeof p === 'string'))) fail('pages', 'must be an array of page names (["front", "back"])');
  if (json.requires !== undefined && !(Array.isArray(json.requires) && json.requires.every((/** @type {unknown} */ r) => typeof r === 'string'))) fail('requires', 'must be an array of option names');
  if (!Array.isArray(json.layers) || json.layers.length === 0) fail('layers', 'must be a non-empty array');
  if (json.fonts !== undefined) {
    if (!Array.isArray(json.fonts)) fail('fonts', 'must be an array of { name, src, weight, style, axes }');
    json.fonts.forEach((/** @type {any} */ f, /** @type {number} */ i) => {
      if (!isPlain(f) || typeof f.name !== 'string' || typeof f.src !== 'string') fail(`fonts[${i}]`, 'needs a name and a src (a path, beside the recipe, or a URL)');
      for (const k of Object.keys(f)) if (!['name', 'src', 'weight', 'style', 'axes', 'fallback'].includes(k)) fail(`fonts[${i}].${k}`, 'unknown key (name, src, weight, style, axes, fallback)');
    });
  }

  const names = new Set([...Object.keys(json.params ?? {}), ...CONTENT]);
  const vars = new Set();
  const checkName = (/** @type {string} */ path, /** @type {string} */ key) => {
    if (!key.startsWith('opt.') && !names.has(key.split('.')[0])) {
      fail(path, `unknown param "${key}" (declare it in "params", or use "{opt.${key}}" for any cover option)`);
    }
  };

  const checkCond = (/** @type {string} */ path, /** @type {any} */ c) => {
    if (typeof c === 'string') return checkName(path, c);
    if (typeof c === 'boolean') return;
    if (!isPlain(c) || Object.keys(c).length === 0) return fail(path, 'a condition is an option name, { "not": … }, { "all": [...] }, { "any": [...] } or { "option": value }');
    if ('not' in c) return checkCond(`${path}.not`, c.not);
    for (const k of ['all', 'any']) {
      if (k in c) {
        if (!Array.isArray(c[k])) return fail(`${path}.${k}`, 'must be an array of conditions');
        return c[k].forEach((/** @type {unknown} */ x, /** @type {number} */ i) => checkCond(`${path}.${k}[${i}]`, x));
      }
    }
    for (const k of Object.keys(c)) if (k !== 'mode' && k !== 'aspect' && k !== 'page' && k !== 'format') checkName(`${path}.${k}`, k);
  };

  const checkValue = (/** @type {string} */ path, /** @type {any} */ v) => {
    if (typeof v === 'string') {
      if (v.startsWith('@@') || v.startsWith('$$')) return;
      if (v.startsWith('@')) {
        const [head, idx, extra] = v.slice(1).split('.');
        const ok = extra === undefined && (CANVAS.includes(head) ? idx === undefined : PALETTE.includes(head) && (idx === undefined || (head === 'colors' && /^\d+$/.test(idx))));
        if (!ok) fail(path, `unknown token "${v}" (use @${PALETTE.join(', @')}, @colors.N, @${CANVAS.join(', @')})`);
        return;
      }
      if (v.startsWith('$')) {
        const head = v.slice(1).split('.')[0];
        if (!vars.has(head)) fail(path, `unknown var "${v}" (declare it in "vars" first)`);
        return;
      }
      for (const m of v.matchAll(/\{([^{}]*)\}/g)) {
        // `{#…}`: a repeat instance's expression, filled when drawn.
        if (m[1].startsWith('#')) continue;
        if (/^layout\.[\w-]+\.\w+\s*(?:[+-]\s*[\d.]+)?$/.test(m[1])) {
          const field = m[1].split('.')[2].replace(/[\s+-].*$/, '');
          if (!LAYOUT_FIELDS.includes(/** @type {any} */ (field))) fail(path, `unknown layout field "${field}" (${LAYOUT_FIELDS.join(', ')})`);
          continue;
        }
        if (!/^[\w.]+$/.test(m[1])) fail(path, `bad template "{${m[1]}}"`);
        checkName(path, m[1]);
      }
      return;
    }
    if (Array.isArray(v)) return v.forEach((x, i) => checkValue(`${path}[${i}]`, x));
    if (!isPlain(v)) return;
    if ('if' in v) {
      for (const k of Object.keys(v)) if (!['if', 'then', 'else'].includes(k)) fail(path, `unexpected "${k}" in an "if" (use if, then, else)`);
      if (!('then' in v)) fail(path, '"if" needs a "then"');
      checkCond(`${path}.if`, v.if);
      checkValue(`${path}.then`, v.then);
      if ('else' in v) checkValue(`${path}.else`, v.else);
      return;
    }
    const keys = Object.keys(v);
    if (keys.length === 1 && Object.hasOwn(OPS, keys[0])) {
      const [lo, hi] = OPS[keys[0]];
      const arg = v[keys[0]];
      const count = Array.isArray(arg) ? arg.length : 1;
      // `reverse` takes one array (literal or computed); the rest take argument lists.
      if (keys[0] !== 'reverse' && (count < lo || count > hi)) fail(`${path}.${keys[0]}`, `takes ${lo === hi ? lo : `${lo}${hi === Infinity ? '+' : `–${hi}`}`} argument${hi === 1 ? '' : 's'}, got ${count}`);
      if (keys[0] === 'mix' && typeof arg[3] === 'string' && !['oklab', 'oklch'].includes(arg[3])) fail(`${path}.mix`, 'the space is "oklab" or "oklch"');
      if (keys[0] === 'pick' && Array.isArray(arg) && arg.length === 0) fail(`${path}.pick`, 'needs at least one item');
      return checkValue(`${path}.${keys[0]}`, arg);
    }
    for (const [k, x] of Object.entries(v)) checkValue(`${path}.${k}`, x);
  };

  for (const [k, v] of Object.entries(json.params ?? {})) checkValue(`params.${k}`, v);
  for (const r of json.requires ?? []) checkName('requires', r);
  if (json.controls !== undefined) checkControls(json.controls, names, fail);
  for (const [k, v] of Object.entries(json.vars ?? {})) {
    checkValue(`vars.${k}`, v);
    vars.add(k);
  }
  const checkLayer = (/** @type {string} */ path, /** @type {any} */ layer) => {
    if (!isPlain(layer)) return fail(path, 'must be an object');
    if (!Object.hasOwn(LAYERS, layer.type)) fail(`${path}.type`, `unknown layer type "${layer.type}" (${Object.keys(LAYERS).join(', ')})`);
    if (layer.id !== undefined && typeof layer.id !== 'string') fail(`${path}.id`, 'must be a string');
    if (layer.when !== undefined) checkCond(`${path}.when`, layer.when);
    const known = { ...LAYER_OPTIONS[layer.type], ...COMMON };
    for (const [k, v] of Object.entries(layer)) {
      if (LAYER_META.has(k)) continue;
      if (!Object.hasOwn(known, k)) fail(`${path}.${k}`, `"${layer.type}" layers have no option "${k}" (${Object.keys(known).join(', ')})`);
      if (k === 'effects') {
        checkEffects(`${path}.effects`, v);
      } else if (k === 'motion') {
        checkMotion(`${path}.motion`, v);
      } else if (NESTED.includes(k) && Array.isArray(v) && v.every((x) => isPlain(x) && typeof x.type === 'string')) {
        v.forEach((x, j) => checkLayer(`${path}.${k}[${j}]${x.id ? ` (${x.id})` : ''}`, x));
      } else if (k === 'layer' && isPlain(v) && typeof v.type === 'string') {
        checkLayer(`${path}.layer`, v);
      } else if (layer.type === 'svg' && MARKUP.includes(k) && typeof v === 'string') {
        for (const m of v.matchAll(/\{\{\s*([$@\w.]+)\s*\}\}/g)) {
          const t = m[1];
          if (t === 'id' || t === 'seed' || t.startsWith('@')) continue;
          if (t.startsWith('$')) { if (!vars.has(t.slice(1).split('.')[0])) fail(`${path}.${k}`, `unknown var "{{${t}}}"`); continue; }
          checkName(`${path}.${k}`, t);
        }
      } else {
        checkValue(`${path}.${k}`, v);
        checkAnchor(`${path}.${k}`, layer.type, k, v);
      }
    }
  };
  // Effects: known kinds, their options, masks and nested layers (computed values are checked when drawn).
  const checkEffects = (/** @type {string} */ path, /** @type {any} */ v) => {
    if (!Array.isArray(v)) return checkValue(path, v);
    v.forEach((e, i) => {
      const at = `${path}[${i}]`;
      if (typeof e === 'string') {
        if (!/[{$@]/.test(e) && !Object.hasOwn(EFFECT_OPTIONS, e)) fail(at, `unknown effect "${e}" (${Object.keys(EFFECT_OPTIONS).join(', ')})`);
        return;
      }
      if (!isPlain(e) || typeof e.kind !== 'string' || 'if' in e) return checkValue(at, e);
      if (!/[{$@]/.test(e.kind) && !Object.hasOwn(EFFECT_OPTIONS, e.kind)) fail(`${at}.kind`, `unknown effect "${e.kind}" (${Object.keys(EFFECT_OPTIONS).join(', ')})`);
      const known = { ...(EFFECT_OPTIONS[e.kind] ?? {}), ...EFFECT_COMMON };
      for (const [k, x] of Object.entries(e)) {
        if (Object.hasOwn(EFFECT_OPTIONS, e.kind) && !Object.hasOwn(known, k)) fail(`${at}.${k}`, `"${e.kind}" effects have no option "${k}" (${Object.keys(known).join(', ')})`);
        if (k === 'mask' && isPlain(x)) checkEffectMask(`${at}.mask`, x);
        else if (k === 'map' && isPlain(x) && Array.isArray(x.layers)) x.layers.forEach((/** @type {any} */ l, /** @type {number} */ j) => checkLayer(`${at}.map.layers[${j}]`, l));
        else checkValue(`${at}.${k}`, x);
      }
    });
  };
  // Motion: known presets and options (values are checked as values).
  const checkMotion = (/** @type {string} */ path, /** @type {any} */ v) => {
    (Array.isArray(v) ? v : [v]).forEach((m, i) => {
      const at = Array.isArray(v) ? `${path}[${i}]` : path;
      const preset = typeof m === 'string' ? m : m?.preset;
      if (typeof preset === 'string' && !/[{$@]/.test(preset) && !Object.hasOwn(MOTION_PRESETS, preset)) fail(at, `unknown motion preset "${preset}" (${Object.keys(MOTION_PRESETS).join(', ')})`);
      if (!isPlain(m)) return checkValue(at, m);
      for (const [k, x] of Object.entries(m)) {
        if (!Object.hasOwn(MOTION_OPTIONS, k)) fail(`${at}.${k}`, `motions have no option "${k}" (${Object.keys(MOTION_OPTIONS).join(', ')})`);
        checkValue(`${at}.${k}`, x);
      }
    });
  };
  const checkEffectMask = (/** @type {string} */ path, /** @type {any} */ m) => {
    const keys = ['gradient', 'from', 'to', 'center', 'angle', 'aspect', 'invert', 'ease', 'layers'];
    for (const k of Object.keys(m)) if (!keys.includes(k)) fail(`${path}.${k}`, `unknown mask option (${keys.join(', ')})`);
    if (Array.isArray(m.layers)) return m.layers.forEach((/** @type {any} */ l, /** @type {number} */ j) => checkLayer(`${path}.layers[${j}]`, l));
    if (typeof m.gradient !== 'string' || (!/[{$@]/.test(m.gradient) && !MASK_GRADIENTS.includes(m.gradient))) fail(`${path}.gradient`, `"${m.gradient}" (${MASK_GRADIENTS.join(', ')}), or give layers`);
    for (const [k, x] of Object.entries(m)) checkValue(`${path}.${k}`, x);
  };
  // Anchors, as literal strings (templates are checked when drawn).
  const checkAnchor = (/** @type {string} */ path, /** @type {string} */ type, /** @type {string} */ k, /** @type {any} */ v) => {
    if (typeof v !== 'string' || /[{$@]/.test(v)) return;
    const allowed = k === 'anchor' || (k === 'align' && type === 'group') ? Object.keys(ANCHORS) : k === 'focus' && type === 'image' ? [...Object.keys(ANCHORS), 'attention', 'entropy'] : null;
    if (allowed && !allowed.includes(v)) fail(path, `unknown anchor "${v}" (${allowed.join(', ')})`);
  };
  json.layers.forEach((/** @type {any} */ layer, /** @type {number} */ i) => checkLayer(`layers[${i}]${layer?.id ? ` (${layer.id})` : ''}`, layer));
}

/**
 * The string and list operators.
 *
 * @param {string} name
 * @param {any[]} args
 * @returns {unknown}
 */
function op2(name, args) {
  switch (name) {
    case 'join': return Array.isArray(args[0]) ? args[0].map((x) => valueOf(x)).join(args[1] ?? ' ') : String(valueOf(args[0]) ?? '');
    case 'upper': return String(valueOf(args[0]) ?? '').toUpperCase();
    case 'lower': return String(valueOf(args[0]) ?? '').toLowerCase();
    default: return Array.isArray(args[0]) || typeof args[0] === 'string' ? args[0].slice(args[1], args[2]) : args[0];
  }
}
