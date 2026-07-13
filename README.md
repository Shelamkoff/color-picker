# @shelamkoff/color-picker

Framework-agnostic color picker UI plus pure HEX, RGB, HSL, and HSV conversion utilities.

## Install

```bash
npm install @shelamkoff/color-picker
```

```js
import { ColorPicker } from '@shelamkoff/color-picker'
import '@shelamkoff/color-picker/styles.css'

const picker = new ColorPicker({
  onChange: color => console.log(color),
  onApply: color => save(color),
  onRemove: () => clearColor(),
})

document.body.appendChild(picker.element)
picker.open('#3366ffcc')

// Remove owned DOM, pointer listeners, and pending EyeDropper work.
picker.destroy()
```

For runtime style injection, `colorPickerStylesUrl` points at the packaged stylesheet. CSS variables prefixed with `--oe-` may override the standalone fallback theme.

## Color utilities

```js
import { parseColorInput, formatColor, hsvToRgb } from '@shelamkoff/color-picker/color-math'

const hsva = parseColorInput('hsl(220, 100%, 60%)')
const rgb = hsvToRgb(hsva.h, hsva.s, hsva.v)
const css = formatColor(hsva.h, hsva.s, hsva.v, hsva.a, 'RGB')
```

`parseColorInput()` returns `null` for malformed or out-of-range strings. `ColorPicker.open()` throws for invalid input and clamps an explicit finite alpha value to `0..1`. `close()` hides the picker, invalidates pending EyeDropper work, and stops an active drag; `destroy()` additionally removes owned DOM and all listeners. SV, hue, and opacity controls support pointer, touch, and keyboard input.

The current package version is `1.0.0`. It is ESM and released under the MIT License.
