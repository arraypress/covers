// Renders covers inside workerd: no Node APIs, no runtime wasm compilation
// (text goes through the JavaScript outliner), Inter from the embedded module.
import { renderSvg, lint } from '../../src/index.js';

const MARK = '<path d="M256 48c-74 64-120 140-120 214a120 120 0 0 0 240 0c0-74-46-150-120-214z"/>';
const CASES = {
  bigType: { recipe: 'bigType', seed: 'worker', title: 'Rendered in a Worker', label: 'Edge', width: 600 },
  brand: { recipe: 'brand', seed: 'worker', format: 'x-header', name: 'Hollow Fern', tagline: 'Field recordings', palette: { accent: '#2f6b4f' }, mark: MARK },
  riso: { recipe: 'riso', seed: 'worker', title: 'Two inks', width: 500 },
  poster: { seed: 'worker', width: 400, height: 500, layers: [
    { type: 'solid', color: '#e5251d' },
    { type: 'text', content: 'Grid,', weight: 800, size: 133, x: 13, y: 294, width: 373, color: '#fff' },
    { type: 'shape', kind: 'circle', r: 120, fill: '#888', effects: [{ kind: 'halftone', ink: '#0078bf' }] },
  ] },
};

export default {
  async fetch(req) {
    const name = new URL(req.url).searchParams.get('case') ?? 'bigType';
    try {
      if (name === 'lint') {
        const r = await lint({ recipe: 'bigType', seed: 'w', title: 'Out now at hollowfern.com', format: 'release' });
        return Response.json(r);
      }
      return new Response(await renderSvg(CASES[name]), { headers: { 'content-type': 'image/svg+xml' } });
    } catch (e) {
      return new Response(String(e.stack ?? e), { status: 500 });
    }
  },
};
