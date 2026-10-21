/**
 * Flatten SVG shapes to polylines, so they can be redrawn by hand (jittered
 * and stroked unevenly) by the `scribble` layer.
 *
 * Reads the elements an icon set uses: `path` (every command, including
 * arcs, absolute and relative), `circle`, `ellipse`, `rect` (with `rx`),
 * `line`, `polyline` and `polygon`.
 *
 * @module flatten
 */

/** @typedef {[number, number][]} Polyline */

/**
 * Flatten an icon body to polylines, in its own units.
 *
 * @param {string} body - SVG markup.
 * @param {number} [step=0.6] - Target segment length, in the icon's units.
 * @returns {{ lines: Polyline[], closed: boolean[] }}
 */
export function flattenBody(body, step = 0.6) {
  /** @type {Polyline[]} */
  const lines = [];
  /** @type {boolean[]} */
  const closed = [];
  const attr = (/** @type {string} */ tag, /** @type {string} */ name) => {
    const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`));
    return m ? m[1] : undefined;
  };
  const numAttr = (/** @type {string} */ tag, /** @type {string} */ name, d = 0) => parseFloat(attr(tag, name) ?? `${d}`) || d;
  for (const m of body.matchAll(/<(path|circle|ellipse|rect|line|polyline|polygon)\b[^>]*>/g)) {
    const tag = m[0];
    const kind = m[1];
    if (kind === 'path') {
      for (const sub of flattenPath(attr(tag, 'd') ?? '', step)) {
        lines.push(sub.points);
        closed.push(sub.closed);
      }
    } else if (kind === 'circle' || kind === 'ellipse') {
      const cx = numAttr(tag, 'cx');
      const cy = numAttr(tag, 'cy');
      const rx = kind === 'circle' ? numAttr(tag, 'r') : numAttr(tag, 'rx');
      const ry = kind === 'circle' ? rx : numAttr(tag, 'ry');
      const n = Math.max(12, Math.ceil((2 * Math.PI * Math.max(rx, ry)) / step));
      lines.push(Array.from({ length: n + 1 }, (_, i) => [cx + rx * Math.cos((i / n) * 2 * Math.PI), cy + ry * Math.sin((i / n) * 2 * Math.PI)]));
      closed.push(true);
    } else if (kind === 'rect') {
      const x = numAttr(tag, 'x');
      const y = numAttr(tag, 'y');
      const w = numAttr(tag, 'width');
      const h = numAttr(tag, 'height');
      const r = Math.min(numAttr(tag, 'rx', numAttr(tag, 'ry')), w / 2, h / 2);
      const d = r > 0
        ? `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`
        : `M${x} ${y}H${x + w}V${y + h}H${x}Z`;
      for (const sub of flattenPath(d, step)) {
        lines.push(sub.points);
        closed.push(true);
      }
    } else if (kind === 'line') {
      lines.push(densify([[numAttr(tag, 'x1'), numAttr(tag, 'y1')], [numAttr(tag, 'x2'), numAttr(tag, 'y2')]], step));
      closed.push(false);
    } else {
      const nums = (attr(tag, 'points') ?? '').split(/[\s,]+/).filter(Boolean).map(Number);
      /** @type {Polyline} */
      const pts = [];
      for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
      if (kind === 'polygon' && pts.length) pts.push(pts[0]);
      lines.push(densify(pts, step));
      closed.push(kind === 'polygon');
    }
  }
  return { lines: lines.filter((l) => l.length > 1), closed };
}

/**
 * Add points along straight segments so no segment is longer than `step`.
 *
 * @param {Polyline} pts
 * @param {number} step
 * @returns {Polyline}
 */
export function densify(pts, step) {
  /** @type {Polyline} */
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    if (i === 0) { out.push(pts[0]); continue; }
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step));
    for (let k = 1; k <= n; k++) out.push([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n]);
  }
  return out;
}

/**
 * Flatten path data into sub-paths.
 *
 * @param {string} d - Path data.
 * @param {number} step - Target segment length.
 * @returns {{ points: Polyline, closed: boolean }[]}
 */
export function flattenPath(d, step) {
  const tokens = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) ?? [];
  /** @type {{ points: Polyline, closed: boolean }[]} */
  const subs = [];
  /** @type {Polyline} */
  let cur = [];
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  let cmd = '';
  let lastCtrl = /** @type {[number, number] | null} */ (null);
  let lastQ = /** @type {[number, number] | null} */ (null);
  let i = 0;
  const next = () => parseFloat(tokens[i++]);
  const isNum = () => i < tokens.length && !/^[a-zA-Z]$/.test(tokens[i]);
  const flush = (closedPath = false) => {
    if (cur.length > 1) subs.push({ points: cur, closed: closedPath });
    cur = [];
  };
  const lineTo = (nx, ny) => {
    const seg = densify([[x, y], [nx, ny]], step);
    cur.push(...seg.slice(1));
    x = nx; y = ny;
  };
  const cubic = (x1, y1, x2, y2, nx, ny) => {
    const n = Math.max(4, Math.ceil((Math.hypot(x1 - x, y1 - y) + Math.hypot(x2 - x1, y2 - y1) + Math.hypot(nx - x2, ny - y2)) / step));
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      const u = 1 - t;
      cur.push([u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * nx, u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * ny]);
    }
    lastCtrl = [x2, y2];
    x = nx; y = ny;
  };
  const quad = (x1, y1, nx, ny) => {
    const n = Math.max(4, Math.ceil((Math.hypot(x1 - x, y1 - y) + Math.hypot(nx - x1, ny - y1)) / step));
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      const u = 1 - t;
      cur.push([u * u * x + 2 * u * t * x1 + t * t * nx, u * u * y + 2 * u * t * y1 + t * t * ny]);
    }
    lastQ = [x1, y1];
    x = nx; y = ny;
  };
  const arc = (rx, ry, rot, large, sweep, nx, ny) => {
    // Endpoint to centre parameterisation (SVG implementation notes, F.6.5).
    if (rx === 0 || ry === 0) return lineTo(nx, ny);
    rx = Math.abs(rx); ry = Math.abs(ry);
    const phi = (rot * Math.PI) / 180;
    const cos = Math.cos(phi);
    const sin = Math.sin(phi);
    const dx = (x - nx) / 2;
    const dy = (y - ny) / 2;
    const x1p = cos * dx + sin * dy;
    const y1p = -sin * dx + cos * dy;
    const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
    if (lambda > 1) { rx *= Math.sqrt(lambda); ry *= Math.sqrt(lambda); }
    const sign = large === sweep ? -1 : 1;
    const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
    const coef = sign * Math.sqrt(Math.max(0, num / (rx * rx * y1p * y1p + ry * ry * x1p * x1p)));
    const cxp = (coef * rx * y1p) / ry;
    const cyp = (-coef * ry * x1p) / rx;
    const cx = cos * cxp - sin * cyp + (x + nx) / 2;
    const cy = sin * cxp + cos * cyp + (y + ny) / 2;
    const angle = (ux, uy, vx, vy) => {
      const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
      return a;
    };
    const t1 = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
    let dt = angle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
    if (!sweep && dt > 0) dt -= 2 * Math.PI;
    if (sweep && dt < 0) dt += 2 * Math.PI;
    const n = Math.max(4, Math.ceil((Math.abs(dt) * Math.max(rx, ry)) / step));
    for (let k = 1; k <= n; k++) {
      const t = t1 + (dt * k) / n;
      cur.push([cx + rx * Math.cos(t) * cos - ry * Math.sin(t) * sin, cy + rx * Math.cos(t) * sin + ry * Math.sin(t) * cos]);
    }
    x = nx; y = ny;
  };

  while (i < tokens.length) {
    if (!isNum()) cmd = tokens[i++];
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    const ox = rel ? x : 0;
    const oy = rel ? y : 0;
    if (C !== 'C' && C !== 'S') lastCtrl = null;
    if (C !== 'Q' && C !== 'T') lastQ = null;
    switch (C) {
      case 'M': {
        flush();
        x = ox + next(); y = oy + next();
        sx = x; sy = y;
        cur = [[x, y]];
        cmd = rel ? 'l' : 'L';
        break;
      }
      case 'L': lineTo(ox + next(), oy + next()); break;
      case 'H': lineTo(ox + next(), y); break;
      case 'V': lineTo(x, (rel ? y : 0) + next()); break;
      case 'C': { const a = [ox + next(), oy + next(), ox + next(), oy + next(), ox + next(), oy + next()]; cubic(a[0], a[1], a[2], a[3], a[4], a[5]); break; }
      case 'S': {
        const [rx1, ry1] = lastCtrl ? [2 * x - lastCtrl[0], 2 * y - lastCtrl[1]] : [x, y];
        const a = [ox + next(), oy + next(), ox + next(), oy + next()];
        cubic(rx1, ry1, a[0], a[1], a[2], a[3]);
        break;
      }
      case 'Q': { const a = [ox + next(), oy + next(), ox + next(), oy + next()]; quad(a[0], a[1], a[2], a[3]); break; }
      case 'T': {
        const [qx, qy] = lastQ ? [2 * x - lastQ[0], 2 * y - lastQ[1]] : [x, y];
        quad(qx, qy, ox + next(), oy + next());
        break;
      }
      case 'A': {
        const a = [next(), next(), next(), next(), next()];
        arc(a[0], a[1], a[2], a[3] ? 1 : 0, a[4] ? 1 : 0, ox + next(), oy + next());
        break;
      }
      case 'Z': {
        lineTo(sx, sy);
        flush(true);
        cur = [[sx, sy]];
        break;
      }
      default:
        i++;
    }
  }
  flush();
  return subs;
}
