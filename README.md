# @shelamkoff/color-picker

Framework-agnostic color picker with an optional EyeDropper integration and pure HEX, RGB, HSL, and HSV conversion utilities. Version `1.0.0` is an ESM package for modern browsers.

[Русская версия](./README.ru.md)

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

From this package directory:

```bash
npm run demo
```

From the workspace root, use `npm run demo:color-picker`. The command opens the demo URL through the local workspace server.

## Package entry points

- `@shelamkoff/color-picker` — component, types, stylesheet URL, and color utilities.
- `@shelamkoff/color-picker/color-math` — conversion and parsing utilities without the UI component.
- `@shelamkoff/color-picker/styles.css` — component styles.

## License

MIT.
