import {
  ColorPicker,
  COLOR_FORMATS,
  colorPickerStylesUrl,
  formatColor,
  type ColorFormat,
  type ColorPickerOptions,
} from '@shelamkoff/color-picker'
import { parseColorInput, type ColorFormat as MathFormat } from '@shelamkoff/color-picker/color-math'

const options: ColorPickerOptions = {
  onChange(color) {
    const accepted: string = color
    void accepted
  },
  onFormatChange(value, format) {
    const accepted: MathFormat = format
    void [value, accepted]
  },
  showRemove: false,
}
const picker = new ColorPicker(options)
picker.open('#ff000080', 0.5)
picker.open('oklch(65% .1 230 / 80%)')
picker.open('rebeccapurple')
const element: HTMLElement = picker.element
const url: string = colorPickerStylesUrl
const format: ColorFormat = COLOR_FORMATS[0]!
const hsva = parseColorInput('hsl(120, 100%, 50%)')
if (hsva) formatColor(hsva.h, hsva.s, hsva.v, hsva.a, format)
picker.close()
picker.destroy()
void [element, url]

// @ts-expect-error Callbacks must be functions.
new ColorPicker({ onChange: 1 })
// @ts-expect-error Visibility options must be booleans.
new ColorPicker({ showRemove: 'yes' })
// @ts-expect-error Unsupported output formats are rejected.
formatColor(0, 1, 1, 1, 'LAB')
// @ts-expect-error Alpha is a number.
picker.open('#fff', '0.5')
// @ts-expect-error Format names are immutable.
COLOR_FORMATS.push('RGB')
