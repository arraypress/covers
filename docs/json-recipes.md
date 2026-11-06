# JSON recipes

A cover style can be data: a JSON document, in a `.json` file or in a theme's config. The built-ins are written this way (`recipes/*.json`; read them for worked examples). Point `$schema` at the bundled schema for autocomplete and checking in your editor.

```json
{
  "$schema": "https://unpkg.com/@arraypress/covers/schema/recipe.schema.json",
  "name": "house",
  "params": { "background": "solid", "angle": 135 },
  "vars": {
    "ink": { "readable": "@accent" },
    "lean": { "range": [-8, 8] }
  },
  "layers": [
    { "id": "bg", "type": "solid", "color": "@accent", "when": { "background": "solid" } },
    { "id": "bg", "type": "linear", "when": { "background": "gradient" },
      "angle": { "add": ["{angle}", "$lean"] },
      "colors": ["@accent", { "mix": ["@accent", "@colors.1", 0.5, "oklch"] }] },
    { "id": "grid", "type": "pattern", "kind": "grid", "color": "$ink", "fade": "edges",
      "opacity": { "if": { "mode": "dark" }, "then": 0.16, "else": 0.12 } },
    { "id": "grain", "type": "grain", "amount": 0.05 },
    { "id": "title", "type": "text", "when": "title", "content": "{title}", "label": "{label}",
      "color": "$ink", "size": { "mul": ["@u", 0.066] }, "maxLines": 3 }
  ]
}
```

```js
import { loadRecipe, renderImage } from '@arraypress/covers';

const house = loadRecipe('./src/covers/house.json'); // or defineRecipe(json), or pass the object as `recipe`
await renderImage({ recipe: house, seed: 'my-post', title: 'Hello', background: 'gradient' });
```

A layer is any [layer](layers.md) plus an optional `id` and `when`. Its option values can be literals or:

| Form | Means |
|---|---|
| `"@bg"`, `"@text"`, `"@accent"`, `"@onAccent"`, `"@muted"`, `"@surface"`, `"@mode"`, `"@colors"`, `"@colors.N"` | The palette (`colors.N` wraps around). |
| `"@width"`, `"@height"`, `"@u"` | The canvas in px (`u` = `sqrt(width × height)`, the unit the built-ins size type with). |
| `"@safeX"`, `"@safeY"`, `"@safeWidth"`, `"@safeHeight"` | The safe box: a format's safe zone, a print piece's trim less its safe margin, else the canvas. |
| `"@bleed"`, `"@safe"`, `"@trimWidth"`, `"@trimHeight"`, `"@mm"`, `"@dpi"` | Print set-up, px (undefined off print formats). |
| `"{name}"`, `"{mark}"`, `"{photo}"`, `"{cutout}"`, `"{lines}"`, `"{lineup}"`, `"{dates}"`, `"{tracklist}"`, `"{venue}"`, `"{address}"`, `"{date}"`, `"{time}"`, `"{price}"`, `"{meta}"` | Brand and event data, readable without declaring them. `"{lineup.0}"`, `"{meta.venue}"` reach into lists and objects. |
| `{ "join": [list, sep] }`, `{ "upper": s }`, `{ "lower": s }`, `{ "slice": [v, start, end] }` | Lists and strings. |
| `{ "keyframes": [[t, value], …], "ease": "inOut", "loop": true }` | An animated value (see [Animation](animation.md)). |
| `"$name"`, `"$name.0"`, `"$name.x"` | A var (or an item or field of it). |
| `"{layout.title.bottom}"`, `"{layout.title.bottom + 12}"` | Where an earlier text layer's block landed, filled in when drawn. |
| `"{#col * 42 + 8}"` | Inside a `repeat`: an expression over the instance, filled in when drawn. |
| `"{title}"`, `"{label}"`, `"{icon}"`, `"{image}"`, `"{param}"`, `"{opt.anything}"` | A cover option. A whole-string token keeps the value's type (a number stays a number, a label object stays an object); inside longer text it's interpolated (`"Read {title}"`). An unset option drops the key. |
| `{ "mix": [a, b, t] }`, `{ "mix": [a, b, t, "oklch"] }` | Two colours mixed in OKLab, or in OKLCH (hue the short way, so far-apart hues stay vivid). |
| `{ "readable": c }`, `{ "readable": [c, light, dark] }` | White (or `light`), or near-black (or `dark`), whichever reads better on `c`. |
| `{ "readable": [backgrounds, ratio, prefer] }` | `prefer` (`"white"`, `"black"` or a colour) when it clears `ratio` on every background (one colour or a list), else the better of white and near-black. `[c, 3, "white"]` is the icon rule. |
| `{ "tone": [color, { l: [min, max], c: [min, max] }] }` | The colour pulled into an OKLCH band, its hue kept. |
| `{ "gradientUnder": [colors, angle, size] }` | The colours a centred square of `size` covers in a linear gradient (five samples, eased as drawn). Pair it with `readable`. |
| `{ "pick": [...] }`, `{ "range": [min, max] }`, `{ "int": [min, max] }` | Seeded choices. |
| `{ "add" / "sub" / "mul" / "div" / "min" / "max": [...] }` | Arithmetic. Lengths (`"54vw"`, `"12vmin"`) become px first. |
| `{ "round" / "floor" / "ceil": x }` | A whole number: a grid's row count from the canvas (`{ "round": { "div": ["@height", 62.5] } }`). |
| `{ "ramp": [from, to, steps, amount?] }` | `steps` colours from `from` toward `to` (`amount` of the way). |
| `{ "taper": [ratio, steps] }` | `[1, ratio, ratio², …]`, e.g. stripe widths. |
| `{ "length": value }` | Characters in a string (a number's digits) or items in an array. |
| `{ "reverse": array }` | |
| `{ "if": condition, "then": a, "else": b }` | A choice. Only the chosen side is evaluated (and draws from the stream). |
| `"@@x"`, `"$$x"` | A literal `@x` / `$x`. |

Conditions (a layer's `when`, an `if`): `"title"` (the option is set; an override object counts when it has `content`, `name`, `svg` or `src`), `{ "background": "gradient" }` (equals; an array means any of; `mode` is the palette's, `aspect` the canvas's: `'wide'`, `'square'` or `'tall'`, `format` the format's name, `page` the page being drawn), `{ "not": c }`, `{ "all": [...] }`, `{ "any": [...] }`.

Layers nest (`group.layers`, `knockout`, `clip`, `mask`) and are validated the same way, `when` included. An `svg` layer's `markup` and `defs` are left alone except for `{{name}}` slots, which are filled from the options (escaped) and vars (`{{$name}}`); `{{@accent}}`, `{{id}}` and `{{seed}}` are filled when it's drawn.

- **`params`** are the options a recipe reads, with defaults; a cover option of the same name overrides one. `title`, `label`, `icon` and `image` are always available. **`requires`** lists options that must be set (`["image"]`).
- **`controls`** are hints for editors, by param: what a default can't say. `{ "preset": { "enum": ["fluted", "reeded-deep"] }, "cells": { "min": 5, "max": 24, "step": 1 }, "dots": { "type": "color", "help": "Empty: the ground." }, "focus": { "hidden": true } }`. Keys: `type`, `label`, `enum`, `min`, `max`, `step`, `help`, `hidden`. They change nothing in the render.
- **`vars`** are resolved once, in order, before the layers; their draws use the cover's recipe stream. Draws inside a layer use that layer's own stream, so adding a layer never changes another's choices.
- **`output`** (`{ "lossless": true }`) sets the encoding the style prefers in `renderImage`.
- **`pages`** (`["front", "back"]`) makes the style two-sided (see [Two-sided pages](formats.md#print-pages)).
- **`fonts`** (`[{ "name": "Fraunces", "src": "fonts/Fraunces.woff2", "weight": [100, 900] }]`) declares the faces the style uses: a path beside the recipe file, or a URL. Callers don't register them.
- **Overrides by id** work exactly as for the built-ins (`grain: false`, `mesh: { blur: 30 }`), and so do extra `layers`.
- **Validation** runs when the recipe is defined, and stops at the first problem with the recipe's name, the JSON path and what to do: `Recipe "house": layers[2] (grid).blurr: "pattern" layers have no option "blurr" (kind, size, …)`, `unknown token "@bgg"`, `unknown param "subtitle" (declare it in "params", or use "{opt.subtitle}")`.
- The schema is exported as `@arraypress/covers/recipe.schema.json`, and the built-ins as `@arraypress/covers/recipes/<name>.json` to copy and edit.

## Describing params for an editor

`describeParams(recipe)` lists a JSON recipe's editable params, so a form can be built from the recipe rather than by hand: every declared param in order, then the content options its layers read without declaring them (an image layer's `{photo}` or `{cutout}`, a `{mark}` drawn as `markup`, `{marks}`).

```js
import { defineRecipe, describeParams } from '@arraypress/covers';
describeParams(defineRecipe(json));
// [{ name: 'headline', label: 'Headline', type: 'rich-lines', default: [...] },
//  { name: 'wash', label: 'Wash', type: 'color', default: '#ff5a1f' },
//  { name: 'cells', label: 'Cells', type: 'number', default: 11, min: 5, max: 24, step: 1 },
//  { name: 'photo', label: 'Photo', type: 'image', default: undefined, optional: true }, …]
```

Each type comes from the default (a hex string is a `color`, a string with a line break `multiline`, an array of strings `lines`, lines that may be `{ content, bold }` `rich-lines`, rows of cells `table`, then `number`, `boolean`, `text`) or from how the layers use it (`image`, `mark`, `marks`), and `controls` refine it (`enum`, `font`, a colour with an empty default, a range). A number with no declared range gets 0 to about three times its default. `optional` marks an empty default (`''` or `[]`: usually "automatic"), `required` an option the recipe `requires`. The Swiss-grid posters and the neo-Swiss flyers declare their controls.

All seventeen built-ins are JSON, with no JS fallback. The tests check that six of them render byte-identical SVG to JavaScript versions kept as a fixture, across palettes, aspects and options, object overrides included (the other ten were written as JSON from the start).
