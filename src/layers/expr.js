/**
 * Per-instance values for `repeat`: `{#…}` expressions over the instance's
 * variables (`i`, `row`, `col`, `n`, `rows`, `cols`, `angle`, `x`, `y`,
 * `odd`), with `+ - * / %`, parentheses, comparisons, `a ? b : c` and
 * `min`, `max`, `abs`, `floor`, `round`, `sin`, `cos`, `pick(i, a, b, …)`.
 * No other code runs: it's a small parser, not `eval`.
 *
 * @module layers/expr
 */

/** Functions an expression can call. */
const FNS = /** @type {Record<string, (...a: any[]) => any>} */ ({
  min: Math.min, max: Math.max, abs: Math.abs, floor: Math.floor, ceil: Math.ceil, round: Math.round,
  sin: (/** @type {number} */ d) => Math.sin((d * Math.PI) / 180), cos: (/** @type {number} */ d) => Math.cos((d * Math.PI) / 180),
  pick: (/** @type {number} */ i, /** @type {any[]} */ ...xs) => xs[((Math.floor(i) % xs.length) + xs.length) % xs.length],
});

/** @param {string} src @returns {string[]} */
function tokens(src) {
  const out = [];
  const re = /\s*(?:(\d*\.?\d+(?:e[+-]?\d+)?)|([A-Za-z_]\w*)|('[^']*'|"[^"]*")|(<=|>=|==|!=|&&|\|\||[-+*/%()?:,<>!]))/gy;
  let m;
  let at = 0;
  while (at < src.length && (m = re.exec(src))) {
    out.push(m[0].trim());
    at = re.lastIndex;
  }
  if (src.slice(at).trim()) throw new TypeError(`Can't read "${src.slice(at).trim()}" in {#${src}}`);
  return out;
}

/**
 * Evaluate an expression.
 *
 * @param {string} src
 * @param {Record<string, number | string | boolean>} vars
 * @returns {any}
 * @throws {TypeError} On an unknown name or bad syntax.
 */
export function evaluate(src, vars) {
  const t = tokens(src);
  let k = 0;
  const peek = () => t[k];
  const take = (/** @type {string} */ want) => { if (t[k] !== want) throw new TypeError(`Expected "${want}" in {#${src}}`); k++; };
  /** @returns {any} */
  const ternary = () => {
    const c = or();
    if (peek() !== '?') return c;
    k++;
    const a = ternary();
    take(':');
    const b = ternary();
    return c ? a : b;
  };
  const or = () => { let v = and(); while (peek() === '||') { k++; const r = and(); v = v || r; } return v; };
  const and = () => { let v = cmp(); while (peek() === '&&') { k++; const r = cmp(); v = v && r; } return v; };
  const cmp = () => {
    let v = add();
    while (['<', '>', '<=', '>=', '==', '!='].includes(peek())) {
      const op = t[k++];
      const r = add();
      v = op === '<' ? v < r : op === '>' ? v > r : op === '<=' ? v <= r : op === '>=' ? v >= r : op === '==' ? v === r : v !== r;
    }
    return v;
  };
  const add = () => { let v = mul(); while (peek() === '+' || peek() === '-') { const op = t[k++]; const r = mul(); v = op === '+' ? v + r : v - r; } return v; };
  const mul = () => { let v = unary(); while (peek() === '*' || peek() === '/' || peek() === '%') { const op = t[k++]; const r = unary(); v = op === '*' ? v * r : op === '/' ? v / r : ((v % r) + r) % r; } return v; };
  /** @returns {any} */
  const unary = () => {
    if (peek() === '-') { k++; return -unary(); }
    if (peek() === '!') { k++; return !unary(); }
    return atom();
  };
  const atom = () => {
    const tok = t[k++];
    if (tok === undefined) throw new TypeError(`Unexpected end of {#${src}}`);
    if (tok === '(') { const v = ternary(); take(')'); return v; }
    if (/^\d|^\./.test(tok)) return Number(tok);
    if (/^['"]/.test(tok)) return tok.slice(1, -1);
    if (peek() === '(') {
      if (!Object.hasOwn(FNS, tok)) throw new TypeError(`Unknown function "${tok}" in {#${src}} (${Object.keys(FNS).join(', ')})`);
      k++;
      const args = [];
      if (peek() !== ')') { args.push(ternary()); while (peek() === ',') { k++; args.push(ternary()); } }
      take(')');
      return FNS[tok](...args);
    }
    if (!Object.hasOwn(vars, tok)) throw new TypeError(`Unknown name "${tok}" in {#${src}} (${Object.keys(vars).join(', ')})`);
    return vars[tok];
  };
  const v = ternary();
  if (k < t.length) throw new TypeError(`Unexpected "${t[k]}" in {#${src}}`);
  return v;
}

/** A whole-value expression, or one inside a string. */
const WHOLE = /^\{#([^{}]+)\}$/;
const INSIDE = /\{#([^{}]+)\}/g;

/**
 * A value with its `{#…}` expressions evaluated (a whole-string expression
 * keeps its type). Nested layers are left alone: an inner `repeat` fills
 * its own.
 *
 * @param {any} v
 * @param {Record<string, number | string | boolean>} vars
 * @returns {any}
 */
export function fill(v, vars) {
  if (typeof v === 'string') {
    const whole = WHOLE.exec(v);
    if (whole) return evaluate(whole[1], vars);
    return v.includes('{#') ? v.replace(INSIDE, (_, e) => String(evaluate(e, vars))) : v;
  }
  if (Array.isArray(v)) return v.map((x) => fill(x, vars));
  if (v && typeof v === 'object' && !(v instanceof Uint8Array)) {
    if (v.type === 'repeat') return v;
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fill(x, vars)]));
  }
  return v;
}
