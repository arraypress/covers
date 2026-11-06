/**
 * A JSON recipe's editable options, described for a form: each param's
 * type, default, choices and range, from its default value, how the layers
 * use it, and the recipe's optional `controls` (hints that a default can't
 * carry: an enum's choices, a slider's range, that an empty string is a
 * colour). An editor builds its panel from this instead of by hand.
 *
 * @module params
 */

/** The kinds of control a param can take. */
export const PARAM_TYPES = /** @type {const} */ ([
  'text', 'multiline', 'lines', 'rich-lines', 'table', 'color', 'number', 'boolean', 'enum', 'font', 'image', 'mark', 'marks', 'value',
]);

/** The keys a `controls` entry may have. */
export const CONTROL_KEYS = /** @type {const} */ (['type', 'label', 'enum', 'min', 'max', 'step', 'help', 'hidden']);

/** Options every recipe can read without declaring them (kept in step with json-recipe.js). */
const CONTENT = new Set(['title', 'label', 'icon', 'image', 'name', 'mark', 'photo', 'cutout', 'date', 'dates', 'time', 'venue', 'address', 'lines', 'lineup', 'tracklist', 'price', 'meta', 'page']);

/** A hex colour (#rgb, #rgba, #rrggbb, #rrggbbaa). */
const HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** @param {unknown} v @returns {v is Record<string, any>} */
const isPlain = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

/**
 * A param name as a label: `markColor` → `Mark color`, `fade_end` → `Fade end`.
 *
 * @param {string} name
 * @returns {string}
 */
export function paramLabel(name) {
  const words = name.replace(/[_-]+/g, ' ').replace(/([a-z\d])([A-Z])/g, '$1 $2').trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * How the layers use each option: the ones drawn as an image's `src`, as a
 * mark's `markup`, and every option named in a `{token}`.
 *
 * @param {any} json - The recipe document.
 * @returns {{ images: Set<string>, markups: Set<string>, used: Set<string> }}
 */
function usage(json) {
  const images = new Set();
  const markups = new Set();
  const used = new Set();
  /** @param {any} v @param {string} key @param {any} layer */
  const walk = (v, key, layer) => {
    if (typeof v === 'string') {
      for (const m of v.matchAll(/\{([\w]+)[\w.]*\}/g)) {
        used.add(m[1]);
        if (v === m[0] && layer?.type === 'image' && key === 'src') images.add(m[1]);
        if (v === m[0] && key === 'markup') markups.add(m[1]);
      }
      return;
    }
    if (Array.isArray(v)) return v.forEach((x) => walk(x, key, layer));
    if (!isPlain(v)) return;
    const isLayer = typeof v.type === 'string' && key !== 'effects';
    for (const [k, x] of Object.entries(v)) walk(x, ['if', 'then', 'else'].includes(k) ? key : k, isLayer ? v : layer);
  };
  walk(json.vars ?? {}, '', undefined);
  walk(json.layers ?? [], '', undefined);
  return { images, markups, used };
}

/**
 * The type a default value implies.
 *
 * @param {unknown} v
 * @returns {import('./index.js').ParamType}
 */
function typeOf(v) {
  if (typeof v === 'boolean') return 'boolean';
  if (typeof v === 'number') return 'number';
  if (typeof v === 'string') return HEX.test(v) ? 'color' : v.includes('\n') ? 'multiline' : 'text';
  if (Array.isArray(v)) {
    if (v.every((x) => typeof x === 'string')) return 'lines';
    if (v.every((x) => Array.isArray(x))) return 'table';
    if (v.every((x) => typeof x === 'string' || (isPlain(x) && typeof x.content === 'string'))) return 'rich-lines';
  }
  return 'value';
}

/**
 * A slider's range for a number with no declared one: 0 up to about three
 * times the default (or 1 for a fraction), in whole steps for a whole number.
 *
 * @param {number} v
 * @returns {{ min: number, max: number, step: number }}
 */
function rangeOf(v) {
  if (v > 0 && v <= 1 && !Number.isInteger(v)) return { min: 0, max: 1, step: 0.01 };
  const max = v === 0 ? 10 : Math.ceil(Math.abs(v) * 3);
  return { min: v < 0 ? -max : 0, max, step: Number.isInteger(v) ? 1 : 0.01 };
}

/**
 * Describe a JSON recipe's editable params: every declared param (in
 * order), then the content options its layers read without declaring them
 * (a `photo`, a `cutout`, the `mark`). Each has a control type, its default,
 * and, where it applies, its choices or range; `controls` in the recipe
 * refines any of them, and `hidden: true` leaves one out.
 *
 * Types: `text`, `multiline` (a default with a line break), `lines` (an
 * array of strings), `rich-lines` (lines that may be `{ content, bold }`),
 * `table` (rows of cells), `color` (a hex default, or declared), `number`,
 * `boolean`, `enum`, `font` (a family name), `image` (drawn as an image
 * layer's `src`), `mark` (a mark's paths, drawn as `markup`), `marks`
 * (several), and `value` for anything else.
 *
 * @param {import('./index.js').Recipe | import('./index.js').RecipeJson} recipe - A recipe from {@link defineRecipe}, or its JSON.
 * @returns {import('./index.js').ParamSpec[]} The editable params.
 * @throws {TypeError} When the recipe isn't a JSON recipe.
 *
 * @example
 * const recipe = defineRecipe(json);
 * for (const p of describeParams(recipe)) addControl(p.name, p.type, p.default, p);
 */
export function describeParams(recipe) {
  const json = /** @type {any} */ (typeof recipe === 'function' ? /** @type {any} */ (recipe).json : recipe);
  if (!isPlain(json) || !Array.isArray(json.layers)) throw new TypeError('describeParams() takes a JSON recipe (from defineRecipe or loadRecipe) or its document');
  const params = isPlain(json.params) ? json.params : {};
  const controls = isPlain(json.controls) ? json.controls : {};
  const requires = new Set(Array.isArray(json.requires) ? json.requires : []);
  const { images, markups, used } = usage(json);

  const names = [...Object.keys(params)];
  for (const n of used) if (CONTENT.has(n) && !names.includes(n) && (images.has(n) || markups.has(n) || n === 'marks')) names.push(n);
  for (const n of requires) if (!names.includes(n)) names.push(n);

  /** @type {import('./index.js').ParamSpec[]} */
  const out = [];
  for (const name of names) {
    const c = isPlain(controls[name]) ? controls[name] : {};
    if (c.hidden) continue;
    const def = params[name];
    /** @type {import('./index.js').ParamType} */
    let type = c.type ?? (images.has(name) ? 'image' : markups.has(name) ? (name === 'marks' ? 'marks' : 'mark') : name === 'marks' ? 'marks' : Array.isArray(c.enum) ? 'enum' : typeOf(def));
    if (type === 'value' && def === undefined) type = 'text';
    /** @type {import('./index.js').ParamSpec} */
    const spec = { name, label: c.label ?? paramLabel(name), type, default: def };
    if (Array.isArray(c.enum)) spec.enum = c.enum;
    if (type === 'number') Object.assign(spec, rangeOf(typeof def === 'number' ? def : 0), ...['min', 'max', 'step'].filter((k) => typeof c[k] === 'number').map((k) => ({ [k]: c[k] })));
    if (def === '' || def === undefined || (Array.isArray(def) && def.length === 0)) spec.optional = true;
    if (requires.has(name)) spec.required = true;
    if (typeof c.help === 'string') spec.help = c.help;
    out.push(spec);
  }
  return out;
}

/**
 * Check a recipe's `controls` (called by the recipe validator).
 *
 * @param {any} controls
 * @param {Set<string>} names - The params the recipe declares, and the content options.
 * @param {(path: string, msg: string) => never} fail
 * @returns {void}
 */
export function checkControls(controls, names, fail) {
  if (!isPlain(controls)) fail('controls', 'must be an object of { param: { type, label, enum, min, max, step, help, hidden } }');
  for (const [name, c] of Object.entries(controls)) {
    const path = `controls.${name}`;
    if (!names.has(name)) fail(path, `unknown param "${name}" (declare it in "params" first)`);
    if (!isPlain(c)) fail(path, 'must be an object');
    for (const k of Object.keys(c)) if (!(/** @type {readonly string[]} */ (CONTROL_KEYS)).includes(k)) fail(`${path}.${k}`, `unknown key (${CONTROL_KEYS.join(', ')})`);
    if (c.type !== undefined && !(/** @type {readonly string[]} */ (PARAM_TYPES)).includes(c.type)) fail(`${path}.type`, `unknown type "${c.type}" (${PARAM_TYPES.join(', ')})`);
    if (c.enum !== undefined && !(Array.isArray(c.enum) && c.enum.length > 0 && c.enum.every((/** @type {unknown} */ x) => typeof x === 'string' || typeof x === 'number'))) fail(`${path}.enum`, 'must be a non-empty array of strings or numbers');
    for (const k of ['min', 'max', 'step']) if (c[k] !== undefined && typeof c[k] !== 'number') fail(`${path}.${k}`, 'must be a number');
    for (const k of ['label', 'help']) if (c[k] !== undefined && typeof c[k] !== 'string') fail(`${path}.${k}`, 'must be a string');
    if (c.hidden !== undefined && typeof c.hidden !== 'boolean') fail(`${path}.hidden`, 'must be true or false');
  }
}
