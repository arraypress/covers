# Effects

`effects: [{ kind, … }]` on any layer or group, applied in order: 74 kinds of blur, distortion (fluted glass among them), colour grading, light, texture and print, and digital effects, from [`@logomarks/image-effects`](https://github.com/Logomarks/image-effects/blob/main/docs/effects.md) (a dependency; its docs list every kind with its options, and it works on its own for photos outside covers). Most are SVG filters (vector, sized in the layer's units); the ones filters can't do are computed on pixels: the layer is drawn once at the pixels it's shown at (sharp in Node, a canvas in the browser), processed and embedded as one image. `extrude` and `mirror` redraw the layer's own markup.

```js
{ type: 'image', src: photo, effects: [{ kind: 'look', name: 'warmFilm' }, { kind: 'tilt', center: [0.5, 0.6] }, 'grain'] }
```

**`mask`, on any effect**: where it applies, from none to full: a gradient (`linear`, `radial`, `band`), or `{ layers: [...] }` (their luminance; any covers layers). "The left half motion-blurred, the face sharp" is `{ kind: 'motion', length: '6vmin', mask: { gradient: 'linear', from: [0.4, 0.5], to: [0.25, 0.5] } }`. `displace` takes `map: { layers }` the same way.

Numbers are in the layer's units: inside a group, its grid's, so an effect looks the same at every output size. Random ones take a `seed` (else the layer's stream). JSON recipes are validated kind by kind (`EFFECT_OPTIONS`). Where nothing can draw pixels (a Worker), `lens` falls back to a Gaussian blur, `tilt` to one through its band, and the other ◆ effects are left out.

## Paints

`fill` and `stroke` on shapes, text and icons:

| Paint | |
|---|---|
| A colour, `'none'` | |
| `{ type: 'linear', colors, stops, opacities, angle, spread, length }` | Over the shape's bounds (a text block's whole box); `spread: 'reflect'` with a `length` is foil. |
| `{ type: 'radial', colors, stops, opacities, cx, cy, r, rx, ry, fx, fy }` | `rx`/`ry` (lengths, or fractions of the box) make it elliptical. |
| `{ type: 'tile', kind, size, colors, ratio, angle, markup }` | A pattern from the shape's corner: `checker`, `stripes`, `dots`, `grid`, or a `custom` tile of markup. |
| `{ preset: 'chrome' \| 'steel' \| 'gold', … }` | Y2K metal as it's painted: sky, a sharp dark horizon at ~55%, warm ground, a light bounce; with its keyline (`keyline: false` for none). Fields override it. |
