// covers applying image-effects: masks drawn from layers, and effects
// validated in JSON recipes. The effects themselves are tested in
// @arraypress/image-effects.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { renderImage, defineRecipe, EFFECTS, EFFECT_OPTIONS } from '../src/index.js';

const root = new URL('..', import.meta.url);
const photo = await readFile(new URL('examples/photo.jpg', root));

/** Raw RGBA of a render. @param {any} input @returns {Promise<{ data: Buffer, width: number, height: number }>} */
async function raw(input) {
  const png = await renderImage(input, { format: 'png', cache: false });
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

test('masks: layers say where (luminance), on filters and on pixels', async () => {
  const mask = { layers: [{ type: 'shape', kind: 'rect', x: 80, y: 0, width: 80, height: 100, fill: '#fff' }] };
  const opts = (/** @type {any} */ e) => ({ width: 160, height: 100, layers: [{ type: 'image', src: photo, effects: e ? [e] : undefined }] });
  const plain = await raw(opts(null));
  for (const fx of [{ kind: 'invert', mask }, { kind: 'zoom', amount: 0.5, mask }]) {
    const got = await raw(opts(fx));
    let left = 0;
    let right = 0;
    let n = 0;
    for (let y = 5; y < 95; y++) for (let c = 0; c < 3; c++, n++) {
      left += Math.abs(got.data[(y * 160 + 30) * 4 + c] - plain.data[(y * 160 + 30) * 4 + c]);
      right += Math.abs(got.data[(y * 160 + 130) * 4 + c] - plain.data[(y * 160 + 130) * 4 + c]);
    }
    assert.ok(left / n <= 2.5, `${fx.kind}: left untouched (${(left / n).toFixed(2)})`);
    assert.ok(right / n > 15, `${fx.kind}: right changed (${(right / n).toFixed(2)})`);
  }
});

test('defineRecipe validates effects: kinds, their options, masks and nested layers', () => {
  const ok = { name: 'fx', layers: [{ type: 'image', src: '{photo}', effects: [{ kind: 'spin', angle: 12, mask: { gradient: 'radial', center: [0.4, 0.3], from: '8vmin', to: '30vmin' } }, 'grain', { kind: 'motion', angle: -20, mask: { layers: [{ type: 'solid', color: '#fff' }] } }, { kind: 'look', name: 'tealOrange', amount: '{opt.amount}' }] }] };
  assert.doesNotThrow(() => defineRecipe(ok));
  const bad = (/** @type {any} */ effects) => () => defineRecipe({ name: 'fx', layers: [{ type: 'solid', effects }] });
  assert.throws(bad([{ kind: 'sparkle' }]), /effects\[0\]\.kind: unknown effect "sparkle"/);
  assert.throws(bad(['sparkle']), /unknown effect "sparkle"/);
  assert.throws(bad([{ kind: 'spin', angel: 10 }]), /"spin" effects have no option "angel"/);
  assert.throws(bad([{ kind: 'blur', mask: { gradient: 'diamond' } }]), /mask\.gradient/);
  assert.throws(bad([{ kind: 'blur', mask: { layers: [{ type: 'nope' }] } }]), /mask\.layers\[0\]\.type: unknown layer type/);
  assert.throws(bad([{ kind: 'displace', map: { layers: [{ type: 'solid', colour: '#fff' }] } }]), /map\.layers\[0\]\.colour/);
  // Every kind's options are listed.
  for (const kind of EFFECTS) assert.ok(EFFECT_OPTIONS[kind], kind);
});
