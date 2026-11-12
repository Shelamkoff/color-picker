import {
  parseColorInput,
  formatColor,
  hsvToRgb,
  type ColorFormat,
} from '@shelamkoff/color-picker/color-math'

// The headless entry point must remain usable without the DOM TypeScript lib.
const format: ColorFormat = 'RGB'
const hsva = parseColorInput('oklch(65% .1 230 / 80%)')
if (hsva) {
  const rgb: { r: number, g: number, b: number } = hsvToRgb(hsva.h, hsva.s, hsva.v)
  const css: string = formatColor(hsva.h, hsva.s, hsva.v, hsva.a, format)
  void [rgb, css]
}
