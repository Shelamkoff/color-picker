import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import * as picker from '@shelamkoff/color-picker'
import * as math from '@shelamkoff/color-picker/color-math'

assert.equal(globalThis.window, undefined)
assert.equal(globalThis.document, undefined)
assert.equal(typeof picker.ColorPicker, 'function')
for (const [name, value] of Object.entries(math)) {
  assert.equal(picker[name], value, `Root export differs from color-math: ${name}`)
}
assert.deepEqual(math.parseColorInput('#ff000080'), { h: 0, s: 1, v: 1, a: 128 / 255 })

// Exercise the new parser modules from the installed tarball, not the checkout.
for (const [source, expected, alpha] of [
  ['#0f08', { r: 0, g: 255, b: 0 }, 8 / 15],
  ['rgb(255 0 128 / 25%)', { r: 255, g: 0, b: 128 }, 0.25],
  ['hsl(.5turn 100% 50%)', { r: 0, g: 255, b: 255 }, 1],
  ['RebeccaPurple', { r: 102, g: 51, b: 153 }, 1],
  ['transparent', { r: 0, g: 0, b: 0 }, 0],
  ['oklch(62.79553606145516% 0.2576833077361567 29.233885192342633 / 75%)', { r: 255, g: 0, b: 0 }, 0.75],
]) {
  const parsed = math.parseColorInput(source)
  assert.ok(parsed, `Packaged parser rejected ${source}`)
  assert.deepEqual(math.hsvToRgb(parsed.h, parsed.s, parsed.v), expected, source)
  assert.equal(parsed.a, alpha, source)
}

const cssPath = createRequire(import.meta.url).resolve('@shelamkoff/color-picker/styles.css')
assert.equal(pathToFileURL(cssPath).href, picker.colorPickerStylesUrl)
assert.ok(readFileSync(cssPath, 'utf8').trim().length > 0, 'Packaged stylesheet is empty')
console.log('Package runtime imports without DOM and stylesheet export: PASS')
