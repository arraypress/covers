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
 * | `"{title}"` | a param or content option (`title`, `label`, `icon`, `image`); `"{opt.x}"` any cover option. A whole-string token keeps the value's type; inside a longer string it's interpolated. |
 * | `{ "mix": [a, b, t, space?] }` | two colours mixed in OKLab (or `"oklch"`: hue the short way, stays vivid) |
 * | `{ "readable": c }` | white, or near-black on a light colour (`[c, light, dark]` to choose) |
 * | `{ "readable": [bgs, ratio, prefer] }` | `prefer` (`"white"`, `"black"`, a colour) if it clears `ratio` on every background, else the better of white / near-black |
 * | `{ "tone": [color, { l: [min, max], c: [min, max] }] }` | the colour pulled into an OKLCH band (its hue kept) |
 * | `{ "gradientUnder": [colors, angle, size] }` | the colours a centred square of `size` covers in a linear gradient |
 * | `{ "pick": [...] }`, `{ "range": [min, max] }`, `{ "int": [min, max] }` | seeded choices |
 * | `{ "add" \| "sub" \| "mul" \| "div" \| "min" \| "max": [a, b, …] }` | arithmetic; lengths like `"54vw"` become pixels |
 * | `{ "ramp": [from, to, steps, amount?] }` | `steps` colours from `from` toward `to` |
 * | `{ "taper": [ratio, steps] }` | `[1, ratio, ratio², …]` |
 * | `{ "reverse": [...] }` | the array backwards |
 * | `{ "if": cond, "then": a, "else": b }` | a choice (only the chosen side is evaluated) |
 *
 * Conditions (`when` on a layer, `if`): `"title"` (the option is set),
 * `{ "background": "gradient" }` (a param or option equals a value; `mode`
 * is the palette's), `{ "not": c }`, `{ "all": [...] }`, `{ "any": [...] }`.
 *
 * Seeding: `vars` draw from the cover's recipe stream in order; draws inside
 * a layer use that layer's own stream, so adding a layer never changes
 * another's choices.
 *
 * @module json-recipe
 */

import { readFileSync } from 'node:fs';
import { readableText } from '@arraypress/color-utils';
import { createRng } from './rng.js';
import { len } from './geometry.js';
import { toHex, mixOklab, mixOklch, onBackground, gradientAt } from './color.js';
import { LAYERS, toneColor } from './layers.js';
import { LAYER_OPTIONS, COMMON } from './layer-options.js';

/** Options every recipe can read without declaring them. */
const CONTENT = ['title', 'label', 'icon', 'image'];

/** `@` tokens. */
const PALETTE = ['bg', 'text', 'accent', 'onAccent', 'muted', 'surface', 'mode', 'colors'];
const CANVAS = ['width', 'height', 'u'];

/** Value operators, by name, with their argument arity. */
const OPS = /** @type {Record<string, [number, number]>} */ ({
  mix: [3, 4], readable: [1, 3], gradientUnder: [3, 3], tone: [2, 2], pick: [1, Infinity], range: [2, 2], int: [2, 2],
  add: [1, Infinity], sub: [2, Infinity], mul: [1, Infinity], div: [2, 2], min: [1, Infinity], max: [1, Infinity],
  ramp: [3, 4], taper: [2, 2], reverse: [1, 1],
});

/** Keys of a layer that aren't layer options. */
const LAYER_META = new Set(['id', 'type', 'when']);

/** Top-level keys of a recipe document. */
const TOP = new Set(['$schema', 'name', 'description', 'params', 'requires', 'vars', 'layers']);

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
    json = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    throw new TypeError(`Couldn't read recipe ${String(path)}: ${/** @type {Error} */ (err).message}`);
  }
  if (isPlain(json) && !json.name) json.name = String(path).split('/').pop()?.replace(/\.json$/, '');
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
 * @property {() => import('./rng.js').Rng} rng - The current stream.
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
    /** @type {Record<string, unknown>} */
    const out = { ...(layer.id ? { id: layer.id } : {}), type: layer.type };
    for (const [k, v] of Object.entries(layer)) {
      if (LAYER_META.has(k)) continue;
      const r = resolve(own, v);
      if (r !== undefined) out[k] = r;
    }
    layers.push(/** @type {any} */ (out));
  }
  return layers;
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
  return s.options[key];
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
  const whole = str.match(/^\{([\w.]+)\}$/);
  if (whole) return lookup(s, whole[1]);
  return str.replace(/\{([\w.]+)\}/g, (_, k) => {
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
  const args = /** @type {any[]} */ ([].concat(resolve(s, raw)));
  const nums = () => args.map((a) => (typeof a === 'number' ? a : len(a, s.c)));
  switch (name) {
    case 'readable': {
      // [backgrounds, ratio, prefer]: prefer a colour that clears a ratio (3 for icons).
      if (typeof args[1] === 'number') return onBackground(args[0], args[1], args[2] ?? 'white');
      return readableText(toHex(args[0]), args[1] ? toHex(args[1]) : '#ffffff', args[2] ? toHex(args[2]) : '#111111');
    }
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
    const have = k === 'mode' ? s.c.palette.mode : valueOf(lookup(s, k));
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
  if (json.vars !== undefined && !isPlain(json.vars)) fail('vars', 'must be an object');
  if (json.requires !== undefined && !(Array.isArray(json.requires) && json.requires.every((/** @type {unknown} */ r) => typeof r === 'string'))) fail('requires', 'must be an array of option names');
  if (!Array.isArray(json.layers) || json.layers.length === 0) fail('layers', 'must be a non-empty array');

  const names = new Set([...Object.keys(json.params ?? {}), ...CONTENT]);
  const vars = new Set();
  const checkName = (/** @type {string} */ path, /** @type {string} */ key) => {
    if (!key.startsWith('opt.') && !names.has(key)) {
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
    for (const k of Object.keys(c)) if (k !== 'mode') checkName(`${path}.${k}`, k);
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
  for (const [k, v] of Object.entries(json.vars ?? {})) {
    checkValue(`vars.${k}`, v);
    vars.add(k);
  }
  json.layers.forEach((/** @type {any} */ layer, /** @type {number} */ i) => {
    const path = `layers[${i}]${layer?.id ? ` (${layer.id})` : ''}`;
    if (!isPlain(layer)) return fail(path, 'must be an object');
    if (!Object.hasOwn(LAYERS, layer.type)) fail(`${path}.type`, `unknown layer type "${layer.type}" (${Object.keys(LAYERS).join(', ')})`);
    if (layer.id !== undefined && typeof layer.id !== 'string') fail(`${path}.id`, 'must be a string');
    if (layer.when !== undefined) checkCond(`${path}.when`, layer.when);
    const known = { ...LAYER_OPTIONS[layer.type], ...COMMON };
    for (const [k, v] of Object.entries(layer)) {
      if (LAYER_META.has(k)) continue;
      if (!Object.hasOwn(known, k)) fail(`${path}.${k}`, `"${layer.type}" layers have no option "${k}" (${Object.keys(known).join(', ')})`);
      checkValue(`${path}.${k}`, v);
    }
  });
}
