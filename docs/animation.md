# Animation

`motion` on any layer plays in the SVG itself, as CSS keyframes: a plain `<img>` or inline SVG animates with no script, and `prefers-reduced-motion` stops it (the SVG's own attributes are the still).

```js
await renderSvg({ width: 400, height: 500, layers: [
  { type: 'mesh', blobs: [{ x: 0.22, y: 0.66, r: 0.22 }], blur: '15vw',
    motion: { translate: ['5vw', '-4vw'], scale: 1.08, origin: ['22%', '66%'], duration: 26, easing: 'inOut', direction: 'alternate' } },
  { type: 'text', content: 'HALDEN · SOUND SYSTEM · ', path: { kind: 'circle', r: 120 }, fitPath: 4, motion: { preset: 'spin', duration: 50 } },
  { type: 'shape', kind: 'rect', x: 92, y: 430, width: 8, height: 13, fill: '#ffb31a', motion: 'blink' },
] });
```

| Motion | |
|---|---|
| `translate` | `[x, y]` to move by (px in the layer's grid, `'%'`, lengths), or points to visit `[[0, 0], [x, y], …]`. |
| `path` | Travel a path from where the layer is: path data, `{ d }`, or a text-path kind (`{ kind: 'ellipse', rx, ry }`). |
| `rotate`, `scale`, `scaleX`, `scaleY` | To a value, or a list; about `origin` (`[x, y]`, default the centre). |
| `opacity` | To a value (times the layer's own), or a list. |
| `marquee` | `true`: text on a path runs along it, one repeat of its words per `duration` (they must repeat), looping seamlessly. |
| `vary` | Layer options as lists of stops (`{ axes: { wdth: [62, 150] } }`), drawn `frames` times a stop (default 12) and played as outline morphs. |
| `duration`, `delay`, `easing`, `direction`, `iterations` | As CSS: seconds; `linear`, `ease`, `in`, `out`, `inOut`, `step` or `[x1, y1, x2, y2]` between each pair of stops; `normal`, `reverse`, `alternate`, `alternate-reverse`; a number or `'infinite'` (the default). |
| `preset` | `drift`, `spin`, `breathe`, `blink`, `marquee`: defaults under whatever else you set (`motion: 'blink'` alone works). |

A single value moves from the layer at rest; a list is stops evenly spaced in time. Motion moves the whole layer, its effects and masks with it. Text is outlines, so `vary` can't animate a font: it draws the layer at each frame and morphs the outlines (`d: path()`), which is how a variable font interpolates its masters, so a width axis breathes as the font draws it. Browsers without the CSS `d` property (Safari, as of writing) show the still for a `vary`.

`renderImage` (librsvg doesn't animate), `renderBlob` and `animate: false` draw a still: the `poster` frame, else the layers at rest. `renderSvg(cover, { t })` draws any frame; frames from `t` follow CSS timing, so they match what a browser shows at `t`.

Any option can also be keyframed against `t` (`{ "keyframes": [[t, value], …], "ease", "loop" }`, seconds), for frames drawn one at a time; numbers, colours (OKLab) and same-unit lengths interpolate. Encoding frames to video (WebCodecs in browsers, ffmpeg in Node) is a later phase.
