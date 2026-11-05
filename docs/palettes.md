# Palettes

| Input | Means |
|---|---|
| `'dusk'` | A preset: `paper`, `ink`, `dawn`, `dusk`, `ocean`, `ember`, `moss`, `carbon`, `mono`. |
| `'#2563eb'` | One colour: an accent to derive a palette from. |
| `['#0c0d12', '#3d5afe', '#ff6b3d']` | `[bg, ...colors]`. |
| `{ bg, colors, text, accent, muted, surface }` | Any subset; the rest is derived. |

Resolved, a palette has `mode`, `bg`, `colors`, `text` (7:1 on `bg` when derived), `accent`, `onAccent` (white, or near-black when the accent is light), `muted` and `surface`.

From a theme's tokens:

```js
import { derivePalette } from '@arraypress/covers';

const palette = derivePalette({ accent: '#2563eb', bg: '#fdfdfd', text: '#1d1d1f' });
// or just: derivePalette({ accent: 'rgb(209 254 23)', mode: 'dark' })
```

The gradient colours are built in OKLCH around the accent's hue (the accent, two neighbours ±40° and a quiet complement), pastel on light backgrounds and deep on dark ones. Colours can be hex, `rgb()` or `hsl()`; alpha is ignored.
