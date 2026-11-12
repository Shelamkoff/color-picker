# @shelamkoff/color-picker

[![npm version](https://img.shields.io/npm/v/%40shelamkoff%2Fcolor-picker)](https://www.npmjs.com/package/@shelamkoff/color-picker)
[![Live demo](https://img.shields.io/badge/demo-live-4357b4)](https://shelamkoff.github.io/color-picker/)
[![MIT license](https://img.shields.io/badge/license-MIT-2ea44f)](./LICENSE)

Accessible framework-agnostic color picker with optional EyeDropper integration, pure color utilities, and HEX, RGB, HSL, named-color, and OKLCH input. Published as an ESM package for modern browsers.

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

Add an inline mount point:

```html
<div id="color-picker-mount"></div>
<style>
  #color-picker-mount > .oe-color-dropdown {
    position: static;
    transform: none;
  }
</style>
```

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

document.querySelector('#color-picker-mount').append(picker.element)
picker.open('#3366ffcc')
```

The component is created hidden. Call `open()` whenever the UI must be shown and `destroy()` when its owner is disposed.

The default stylesheet positions the picker as an absolute dropdown below a positioned parent. The inline example overrides only positioning; avoid overriding `display`, because `open()` and `close()` own visibility. For a popup, mount the element inside a relatively positioned anchor and let the host manage placement, outside-click dismissal, initial focus, and focus restoration.

## Options

| Option | Type | Default | Purpose |
| --- | --- | --- | --- |
| `onChange` | `(color: string) => void` | no-op | Receives every committed control change as a CSS color string. |
| `onApply` | `(color: string) => void` | no-op | Receives a valid value when Apply or Enter is pressed. |
| `onRemove` | `() => void` | no-op | Runs when the Remove button is pressed. |
| `onFormatChange` | `(color: string, format: ColorFormat) => void` | no-op | Runs after the user switches the output format. |
| `showRemove` | `boolean` | `true` | Shows or hides the Remove action. |

## Instance API

| Member | Description |
| --- | --- |
| `element` | Root `HTMLElement` owned by the picker. |
| `open(color, alpha?)` | Validates the supplied color and optional alpha, ends earlier interactions, synchronizes the controls, and shows the picker. |
| `close()` | Hides the picker, ends an active drag, and aborts pending EyeDropper work. |
| `destroy()` | Removes owned DOM and listeners. It is safe to call repeatedly; `open()` throws after destruction. |

`open()` accepts the formats listed below. Invalid color or non-finite alpha throws without changing the current state. A separately supplied finite alpha value is clamped to `0..1`.

## Color utilities

Utilities are available from both the package root and the smaller `color-math` entry point:

```js
import {
  parseColorInput,
  formatColor,
  hsvToRgb,
} from '@shelamkoff/color-picker/color-math'

const hsva = parseColorInput('oklch(65% .15 250 / 80%)')
if (hsva) {
  const rgb = hsvToRgb(hsva.h, hsva.s, hsva.v)
  const css = formatColor(hsva.h, hsva.s, hsva.v, hsva.a, 'RGB')
  console.log(rgb, css)
}
```

Exports include `COLOR_FORMATS`, `ColorFormat`, `hsvToHex`, `rgbToHsv`, `hexToHsv`, `hsvToRgb`, `hsvToHsl`, `formatColor`, `roundAlpha`, `parseRgbCss`, and `parseColorInput`.

`parseColorInput()` accepts these standalone color values and returns sRGB-based HSVA:

| Input | Examples and rules |
| --- | --- |
| HEX | `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`; short forms duplicate each digit, including alpha. |
| RGB(A) | `rgb(255, 0, 128)`, `rgba(100%, 0%, 50%, .5)`, `rgb(255 0 50% / 80%)`. Numeric channels can be fractional. Modern syntax can mix numbers and percentages; comma syntax uses one channel representation throughout. |
| HSL(A) | `hsl(220, 100%, 60%)`, `hsl(.5turn 100% 50% / 25%)`. Modern saturation/lightness accept percentages or numbers on the same `0..100` scale; comma syntax requires percentages. |
| Named colors | All 148 standard CSS color names, including aliases such as `gray`/`grey` and `rebeccapurple`. `transparent` resolves to transparent black. |
| OKLCH | `oklch(65% .15 250 / 80%)`. Lightness `100%` equals `1`; chroma `100%` equals `.4`. Chroma is nonnegative and has no fixed upper limit. |

Alpha accepts a number in `0..1` or a percentage in `0..100%`. HSL and OKLCH hue accepts degrees without a suffix or `deg`, `grad`, `rad`, and `turn`, with circular normalization. Signed numbers and scientific notation are supported. Modern syntax accepts `none`, resolved to zero for standalone conversion. Leading/trailing whitespace and letter case are ignored. Commas cannot be mixed with space/slash syntax.

OKLCH input is converted into the picker's sRGB/HSV model. Colors outside sRGB are mapped using the CSS Color 4 binary-search algorithm with local MINDE; in-gamut colors are converted directly. This does not preserve the original OKLCH coordinates or turn the picker into a wide-gamut editor. The output-format cycle remains HEX, RGB, and HSL. See the [CSS Color 4 syntax](https://www.w3.org/TR/css-color-4/) and [gamut-mapping algorithm](https://www.w3.org/TR/css-color-4/#binsearch).

Validation retains the API's strict range checks: RGB channels must be in `0..255` or `0..100%`, HSL saturation/lightness in `0..100`, OKLCH lightness in `0..1`, and alpha in `0..1`. Malformed, non-finite, unsupported, or out-of-range input returns `null`, rather than applying the browser's range clamping. Context-dependent expressions such as `currentColor`, `var()`, `calc()`, and relative color syntax are not evaluated.

`parseRgbCss()` is a separate compatibility helper for both modern and comma-separated RGB(A), including percentages. It clamps channels and alpha; malformed or unsupported input returns `{ hex: '#ffffff', alpha: 1 }`. Use `parseColorInput()` when validation failures must be distinguishable from white. `hexToHsv()` accepts only six-digit hex, with an optional `#`, and throws for invalid input.

`hsvToHsl()` and HSL formatting round hue, saturation, and lightness to integers; RGB/HSL formatting and callbacks round alpha to two decimal places. HEX formatting uses an 8-bit alpha channel. These formats can therefore be lossy. Switching the picker format and applying an untouched field preserves its internal color instead of reparsing the rounded display.

## Interaction and lifecycle

- Saturation/value, hue, and alpha controls support pointer, touch, and keyboard input.
- EyeDropper is shown only when the browser exposes the native API. Opening again, closing, or destroying the picker aborts pending selection and ignores stale results.
- Escape closes the picker from any control. Invalid text is marked with `aria-invalid` and cannot be applied. Enter during IME composition does not apply a color.
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

## Development checks

```bash
npm ci
npm test
npm run test:package
npx playwright install chromium
npm run test:browser
```

`npm test` runs color conversion/parser tests, local demo-server regressions, and lifecycle/input tests in Happy DOM. The DOM tests use explicit geometry fixtures and do not validate rendering or native pointer capture.

`test:package` builds and installs a real tarball into a temporary consumer, checks DOM-free ESM imports and the stylesheet export, and compiles the public types in strict NodeNext and Bundler modes.

`test:browser` starts a local server and runs the shared lifecycle scenarios, trusted mouse input, keyboard behavior, and demo layout checks in Chromium. It also compares 240 colors with an independent browser sRGB Canvas result: all 148 names, in-gamut OKLCH, and the new syntax forms. Unsupported native syntax is listed separately; insufficient OKLCH oracle coverage fails the check. Set `COLOR_PICKER_BROWSER=firefox` or `webkit` to use another installed Playwright browser. `COLOR_PICKER_BROWSER_EXECUTABLE_PATH` selects an existing browser executable. Browser launch failures fail the check; they are never treated as successful tests.

Run `npm run check` for all three gates before release. Native EyeDropper UI and assistive technology behavior also require manual verification on the target platforms.

## Package entry points

- `@shelamkoff/color-picker` — component, types, stylesheet URL, and color utilities.
- `@shelamkoff/color-picker/color-math` — conversion and parsing utilities without the UI component.
- `@shelamkoff/color-picker/styles.css` — component styles.

## License

MIT.
