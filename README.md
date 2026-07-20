# @shelamkoff/color-picker

[![npm version](https://img.shields.io/npm/v/%40shelamkoff%2Fcolor-picker)](https://www.npmjs.com/package/@shelamkoff/color-picker)
[![Live demo](https://img.shields.io/badge/demo-live-4357b4)](https://shelamkoff.github.io/color-picker/)
[![MIT license](https://img.shields.io/badge/license-MIT-2ea44f)](./LICENSE)

Accessible framework-agnostic color picker with optional EyeDropper integration and pure HEX, RGB, HSL, and HSV conversion utilities. Published as an ESM package for modern browsers.

[Live demo](https://shelamkoff.github.io/color-picker/) · [npm](https://www.npmjs.com/package/@shelamkoff/color-picker) · [Русская версия](./README.ru.md)

## Highlights

- Saturation/value, hue, alpha, and output-format controls.
- Pointer, touch, and keyboard interaction with optional native EyeDropper support.
- Pure color parsing, formatting, and conversion utilities in a separate entry point.
- Framework-independent lifecycle with callbacks and explicit cleanup.

## Installation

```bash
npm install @shelamkoff/color-picker
```

Import the stylesheet once in the application:

```js
import '@shelamkoff/color-picker/styles.css'
```

`colorPickerStylesUrl` is also exported when a host needs to create a `<link>` element at runtime.

## Quick start

```js
import { ColorPicker } from '@shelamkoff/color-picker'
import '@shelamkoff/color-picker/styles.css'

const picker = new ColorPicker({
  onChange(color) {
    preview.style.color = color
  },
  onApply(color) {
    saveColor(color)
    picker.close()
  },
  onRemove() {
    clearColor()
  },
  showRemove: true,
})

document.body.append(picker.element)
picker.open('#3366ffcc')
```

The component is created hidden. Call `open()` whenever the UI must be shown and `destroy()` when its owner is disposed.

## Options

| Option | Type | Default | Purpose |
| --- | --- | --- | --- |
| `onChange` | `(color: string) => void` | no-op | Receives every committed control change as a CSS color string. |
| `onApply` | `(color: string) => void` | no-op | Receives the value when the Apply button is pressed. |
| `onRemove` | `() => void` | no-op | Runs when the Remove button is pressed. |
| `onFormatChange` | `(color: string, format: ColorFormat) => void` | no-op | Runs after the user switches the output format. |
| `showRemove` | `boolean` | `true` | Shows or hides the Remove action. |

## Instance API

| Member | Description |
| --- | --- |
| `element` | Root `HTMLElement` owned by the picker. |
| `open(color, alpha?)` | Parses the supplied CSS color, optionally overrides alpha, synchronizes the controls, and shows the picker. |
| `close()` | Hides the picker, ends an active drag, and invalidates pending EyeDropper work. |
| `destroy()` | Removes owned DOM and listeners. It is safe to call repeatedly; `open()` throws after destruction. |

`open()` accepts supported HEX, RGB(A), and HSL(A) strings. An invalid string throws. A separately supplied finite alpha value is clamped to `0..1`.

## Color utilities

Utilities are available from both the package root and the smaller `color-math` entry point:

```js
import {
  parseColorInput,
  formatColor,
  hsvToRgb,
} from '@shelamkoff/color-picker/color-math'

const hsva = parseColorInput('hsl(220, 100%, 60%)')
if (hsva) {
  const rgb = hsvToRgb(hsva.h, hsva.s, hsva.v)
  const css = formatColor(hsva.h, hsva.s, hsva.v, hsva.a, 'RGB')
  console.log(rgb, css)
}
```

Exports include `COLOR_FORMATS`, `ColorFormat`, `hsvToHex`, `rgbToHsv`, `hexToHsv`, `hsvToRgb`, `hsvToHsl`, `formatColor`, `roundAlpha`, `parseRgbCss`, and `parseColorInput`. Parsers return `null` for malformed or out-of-range input instead of silently correcting it.

## Interaction and lifecycle

- Saturation/value, hue, and alpha controls support pointer, touch, and keyboard input.
- EyeDropper is shown only when the browser exposes the native API. Closing or destroying the picker invalidates a pending result.
- The picker never persists values itself. `onApply`, `onChange`, and `onRemove` are integration callbacks owned by the host.
- CSS custom properties prefixed with `--oe-` can override the standalone fallback theme.

## Demo

[Open the live demo](https://shelamkoff.github.io/color-picker/) to try color selection, alpha, format switching, and the native EyeDropper when supported.

To run the same demo locally:

```bash
npm install
npm run demo
```

Open `http://127.0.0.1:4173/demo.html`.

## Package entry points

- `@shelamkoff/color-picker` — component, types, stylesheet URL, and color utilities.
- `@shelamkoff/color-picker/color-math` — conversion and parsing utilities without the UI component.
- `@shelamkoff/color-picker/styles.css` — component styles.

## License

MIT.
