/**
 * Safe zones: the box layouts fit into, scaling, and a preview overlay.
 *
 * @module formats/zones
 */

/**
 * A preview overlay of a format's zones: the safe area dashed, covered
 * areas tinted red, device crops outlined.
 *
 * @param {import('./index.js').Zones} z
 * @param {number} w @param {number} h
 * @returns {string} Markup.
 */
export function zonesOverlay(z, w, h) {
  const n = (/** @type {number} */ v) => Math.round(v * 100) / 100;
  const sw = n(Math.max(1, Math.min(w, h) / 360));
  let out = '';
  for (const c of z.crops ?? []) {
    const [x, y, cw, ch] = c.rect;
    if (c.name === 'circle') {
      out += `<path d="M0 0H${n(w)}V${n(h)}H0ZM${n(x)} ${n(y + ch / 2)}a${n(cw / 2)} ${n(ch / 2)} 0 1 0 ${n(cw)} 0a${n(cw / 2)} ${n(ch / 2)} 0 1 0 ${n(-cw)} 0Z" fill="#000" fill-opacity="0.45" fill-rule="evenodd"/>`;
    } else {
      out += `<rect x="${n(x)}" y="${n(y)}" width="${n(cw)}" height="${n(ch)}" fill="none" stroke="#00b3ff" stroke-width="${sw}" stroke-dasharray="${n(sw * 2)} ${n(sw * 3)}"/>`;
    }
  }
  for (const a of z.avoid ?? []) {
    if (a.circle) out += `<circle cx="${n(a.circle[0])}" cy="${n(a.circle[1])}" r="${n(a.circle[2])}" fill="#ff2d55" fill-opacity="0.35" stroke="#ff2d55" stroke-width="${sw}"/>`;
    if (a.rect) out += `<rect x="${n(a.rect[0])}" y="${n(a.rect[1])}" width="${n(a.rect[2])}" height="${n(a.rect[3])}" fill="#ff2d55" fill-opacity="0.3"/>`;
  }
  const [x, y, sw2, sh] = z.safe;
  out += `<rect x="${n(x)}" y="${n(y)}" width="${n(sw2)}" height="${n(sh)}" fill="none" stroke="#18e05a" stroke-width="${n(sw * 2)}" stroke-dasharray="${n(sw * 8)} ${n(sw * 5)}"/>`;
  return `<g pointer-events="none">${out}</g>`;
}

/**
 * @param {import('./index.js').Zones} z @param {number} k
 * @returns {import('./index.js').Zones}
 */
export function scaleZones(z, k) {
  if (k === 1) return z;
  const r = (/** @type {number[]} */ a) => /** @type {any} */ (a.map((v) => Math.round(v * k)));
  return { ...z, safe: r(z.safe), avoid: z.avoid?.map((a) => ({ ...a, rect: a.rect && r(a.rect), circle: a.circle && r(a.circle) })), crops: z.crops?.map((c) => ({ ...c, rect: r(c.rect) })) };
}


/**
 * The safe box of a cover, px: a format's safe zone, or a print piece's
 * trim less its safe margin. Undefined for a plain canvas.
 *
 * @param {{ width: number, height: number, print?: import('./index.js').PrintInfo, zones?: import('./index.js').Zones }} c
 * @returns {{ x: number, y: number, width: number, height: number } | undefined}
 */
export function safeBox(c) {
  if (c.zones) {
    const [x, y, width, height] = c.zones.safe;
    return { x, y, width, height };
  }
  if (c.print) {
    const i = c.print.bleed + c.print.safe;
    return { x: i, y: i, width: c.width - 2 * i, height: c.height - 2 * i };
  }
  return undefined;
}
