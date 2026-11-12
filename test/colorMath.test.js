import test from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import {
  COLOR_FORMATS,
  formatColor,
  hexToHsv,
  hsvToHex,
  hsvToHsl,
  hsvToRgb,
  parseColorInput,
  parseRgbCss,
  rgbToHsv,
  roundAlpha,
} from '../index.js'

test('hex, RGB and HSL inputs produce normalized HSVA values', () => {
  assert.deepEqual(parseColorInput('#ff000080'), { h: 0, s: 1, v: 1, a: 128 / 255 })
  assert.deepEqual(parseColorInput('rgb(0, 255, 0)'), { h: 120, s: 1, v: 1, a: 1 })
  assert.deepEqual(parseColorInput('hsl(480, 100%, 50%)'), { h: 120, s: 1, v: 1, a: 1 })
})

test('invalid and out-of-range CSS colors are rejected', () => {
  for (const color of ['#xyz', 'rgb(256, 0, 0)', 'rgba(0, 0, 0, 1.1)', 'hsl(0, 101%, 50%)']) {
    assert.equal(parseColorInput(color), null)
  }
  assert.throws(() => hexToHsv('broken'), TypeError)
})

test('public conversion functions clamp and normalize their domains', () => {
  assert.deepEqual(hsvToRgb(720, 2, 2), { r: 255, g: 0, b: 0 })
  assert.equal(formatColor(0, 1, 1, 2, 'HEX'), '#ff0000')
  assert.deepEqual(parseRgbCss('rgba(999, 0, 0, 2)'), { hex: '#ff0000', alpha: 1 })
  assert.equal(formatColor(720, 2, 2, 1, 'HSL'), 'hsl(0, 100%, 50%)')
  assert.throws(() => formatColor(0, 1, 1, 1, 'LAB'), TypeError)
})

test('parsers reject malformed numeric tokens rather than accepting a numeric prefix', () => {
  for (const alpha of ['0.5.5', '1..0', '.5.', '0.', '.']) {
    for (const color of [`rgba(255, 0, 0, ${alpha})`, `hsla(0, 100%, 50%, ${alpha})`]) {
      assert.equal(parseColorInput(color), null, color)
    }
    assert.deepEqual(parseRgbCss(`rgba(255, 0, 0, ${alpha})`), { hex: '#ffffff', alpha: 1 })
  }
  for (const color of ['hsl(0., 100%, 50%)', 'hsl(0, 100.%, 50%)', 'hsl(0, 100%, 50.%)']) {
    assert.equal(parseColorInput(color), null, color)
  }
})

test('parsers handle non-string input through their documented invalid-input result', () => {
  for (const value of [undefined, null, 0, NaN, {}, [], true]) {
    assert.equal(parseColorInput(value), null)
    assert.deepEqual(parseRgbCss(value), { hex: '#ffffff', alpha: 1 })
  }
})

test('RGB CSS parsing tolerates surrounding whitespace without changing the selected color', () => {
  assert.deepEqual(parseRgbCss(' \n RGBA(255, 0, 0, .5) \t'), { hex: '#ff0000', alpha: 0.5 })
})

test('supported decimal components, negative hue and shorthand hex retain their values', () => {
  assert.deepEqual(parseColorInput(' \n #0F8 \t'), { ...rgbToHsv(0, 1, 136 / 255), a: 1 })
  assert.deepEqual(parseColorInput('rgba(255, 0, 0, .5)'), { h: 0, s: 1, v: 1, a: 0.5 })
  assert.deepEqual(parseColorInput('hsla(-120, 100%, 50%, .25)'), { h: 240, s: 1, v: 1, a: 0.25 })
  const decimal = parseColorInput('hsl(-.5, 50.5%, 25.25%)')
  assert.ok(decimal)
  assert.equal(decimal.h, 359.5)
  assert.ok(decimal.s >= 0 && decimal.s <= 1)
  assert.ok(decimal.v >= 0 && decimal.v <= 1)
})

test('strict parser rejects out-of-range channels and unsupported color syntax', () => {
  for (const color of [
    'rgb(0, 256, 0)', 'rgb(0, 0, 256)', 'rgb(-1, 0, 0)',
    'rgba(0, 0, 0, -0.1)', 'rgba(0, 0, 0, NaN)',
    'hsl(0, 100%, 101%)', 'hsl(0, -1%, 50%)', 'hsl(Infinity, 0%, 0%)',
    '', '#', '#12', '#12345', '#1234567', '#123456789',
    'url(https://example.com)', '<script>alert(1)</script>',
    'rgb(0, 0, 0) trailing', 'hsl(0, 0%, 0%) trailing',
  ]) {
    assert.equal(parseColorInput(color), null, color)
  }
  assert.deepEqual(parseRgbCss('not a color'), { hex: '#ffffff', alpha: 1 })
})

test('RGB and HSV conversions agree with primary, secondary and achromatic reference colors', () => {
  for (const [h, r, g, b] of [
    [0, 255, 0, 0], [60, 255, 255, 0], [120, 0, 255, 0],
    [180, 0, 255, 255], [240, 0, 0, 255], [300, 255, 0, 255],
  ]) {
    assert.deepEqual(hsvToRgb(h, 1, 1), { r, g, b })
    assert.deepEqual(rgbToHsv(r / 255, g / 255, b / 255), { h, s: 1, v: 1 })
  }
  assert.deepEqual(rgbToHsv(0, 0, 0), { h: 0, s: 0, v: 0 })
  assert.deepEqual(rgbToHsv(1, 1, 1), { h: 0, s: 0, v: 1 })
  assert.deepEqual(hsvToRgb(240, 0, 0.5), { r: 128, g: 128, b: 128 })
  assert.deepEqual(hsvToHsl(0, 1, 1), { h: 0, s: 100, l: 50 })
  assert.deepEqual(hsvToHsl(120, 0, 1), { h: 120, s: 0, l: 100 })
  assert.deepEqual(hsvToHsl(240, 1, 0), { h: 240, s: 0, l: 0 })
})

test('8-bit RGB values survive HSV and HEX round trips across the color cube', () => {
  for (let r = 0; r <= 255; r += 17) {
    for (let g = 0; g <= 255; g += 17) {
      for (let b = 0; b <= 255; b += 17) {
        const hsv = rgbToHsv(r / 255, g / 255, b / 255)
        assert.deepEqual(hsvToRgb(hsv.h, hsv.s, hsv.v), { r, g, b })
        const hex = hsvToHex(hsv.h, hsv.s, hsv.v)
        assert.deepEqual(hexToHsv(hex), hsv)
      }
    }
  }
})

test('HEX formatting preserves every 8-bit alpha value', () => {
  for (let alpha = 0; alpha <= 255; alpha += 1) {
    const color = formatColor(120, 1, 1, alpha / 255, 'HEX')
    assert.deepEqual(parseColorInput(color), { h: 120, s: 1, v: 1, a: alpha / 255 })
  }
})

test('numeric conversion utilities return finite bounded values for non-finite inputs', () => {
  for (const value of [NaN, Infinity, -Infinity]) {
    assert.deepEqual(rgbToHsv(value, value, value), { h: 0, s: 0, v: 0 })
    assert.deepEqual(hsvToRgb(value, value, value), { r: 0, g: 0, b: 0 })
    assert.deepEqual(hsvToHsl(value, value, value), { h: 0, s: 0, l: 0 })
    assert.equal(roundAlpha(value), 1)
  }
  assert.equal(roundAlpha(-1), 0)
  assert.equal(roundAlpha(2), 1)
  assert.equal(roundAlpha(0.555), 0.56)
  assert.equal(formatColor(0, 1, 1, 0, 'RGB'), 'rgba(255, 0, 0, 0)')
  assert.equal(formatColor(0, 1, 1, 0.5, 'HSL'), 'hsla(0, 100%, 50%, 0.5)')
  assert.ok(Object.isFrozen(COLOR_FORMATS))
})

test('long malformed whitespace is rejected without excessive regex backtracking', async () => {
  // Isolate the input so a regex regression cannot block the test runner's event loop.
  // The timeout is a generous test-process guard, not a limit on accepted input.
  const source = `
    import assert from 'node:assert/strict'
    import { parseColorInput, parseRgbCss } from ${JSON.stringify(new URL('../colorMath.js', import.meta.url).href)}
    const whitespace = ' '.repeat(200_000)
    assert.equal(parseColorInput('rgb(1,2,3' + whitespace + 'x'), null)
    assert.equal(parseColorInput('hsl(0,0%,0%' + whitespace + 'x'), null)
    assert.deepEqual(parseRgbCss('rgb(1,2,3' + whitespace + 'x'), { hex: '#ffffff', alpha: 1 })
    assert.deepEqual(parseColorInput('rgb(255,0,0' + whitespace + ')'), { h: 0, s: 1, v: 1, a: 1 })
    assert.deepEqual(parseColorInput('hsla(0,100%,50%' + whitespace + ',.5)'), { h: 0, s: 1, v: 1, a: 0.5 })
    assert.deepEqual(parseRgbCss('rgba(255,0,0' + whitespace + ',.5)'), { hex: '#ff0000', alpha: 0.5 })
    const digits = '9'.repeat(200_000)
    assert.equal(parseColorInput('rgb(' + digits + ' 0 0)'), null)
    assert.equal(parseColorInput('rgb(1 2 3 / ' + digits + '.x)'), null)
    assert.equal(parseColorInput('hsl(' + digits + 'rad 100% 50%)'), null)
    assert.equal(parseColorInput('rgb(0 0 0' + '/'.repeat(200_000) + ')'), null)
    assert.deepEqual(parseRgbCss('rgb(' + digits + ' 0 0)'), { hex: '#ff0000', alpha: 1 })
  `
  await promisify(execFile)(process.execPath, ['--input-type=module', '-e', source], { timeout: 5_000 })
})

test('four-digit HEX expands both RGB and alpha nibbles', () => {
  for (const [short, long] of [['#1234', '#11223344'], ['#0f08', '#00ff0088'], ['#F00F', '#ff0000ff'], ['#0000', '#00000000']]) {
    assert.deepEqual(parseColorInput(short), parseColorInput(long))
  }
})

test('standard named colors and aliases resolve without DOM context', () => {
  for (const [name, hex] of [
    ['red', '#ff0000'], ['green', '#008000'], ['lime', '#00ff00'],
    ['rebeccapurple', '#663399'], ['aliceblue', '#f0f8ff'], ['papayawhip', '#ffefd5'],
    ['gray', '#808080'], ['grey', '#808080'], ['darkgray', '#a9a9a9'], ['darkgrey', '#a9a9a9'],
    ['aqua', '#00ffff'], ['cyan', '#00ffff'], ['fuchsia', '#ff00ff'], ['magenta', '#ff00ff'],
  ]) {
    assert.deepEqual(parseColorInput(name), parseColorInput(hex), name)
    assert.deepEqual(parseColorInput(` ${name.toUpperCase()} `), parseColorInput(hex), name)
  }
  assert.deepEqual(parseColorInput('transparent'), { h: 0, s: 0, v: 0, a: 0 })
  for (const name of ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'currentColor', 'CanvasText']) {
    assert.equal(parseColorInput(name), null, name)
  }
})

test('color names and function names use ASCII-only case folding', () => {
  for (const color of ['blacK', 'darKred', 'oKlch(.5 .1 30)']) {
    assert.equal(parseColorInput(color), null, color)
  }
  assert.deepEqual(parseColorInput('BLACK'), { h: 0, s: 0, v: 0, a: 1 })
})

test('modern RGB permits decimals, mixed percentages, signed/exponent numbers and percentage alpha', () => {
  for (const color of ['rgb(100% 0 0 / 50%)', 'rgba(+2.55e2 0% .0 / +5e-1)', 'RGB(255\t0\n0/50%)']) {
    assert.deepEqual(parseColorInput(color), { h: 0, s: 1, v: 1, a: 0.5 }, color)
  }
  assert.deepEqual(parseColorInput('rgb(12.5 25.5 50.5)'), { ...rgbToHsv(12.5 / 255, 25.5 / 255, 50.5 / 255), a: 1 })
  assert.deepEqual(parseColorInput('rgba(10%, 20%, 30%, 25%)'), { ...rgbToHsv(0.1, 0.2, 0.3), a: 0.25 })
  assert.deepEqual(parseColorInput('rgb(+12.5, 2.55e1, 50.5)'), { ...rgbToHsv(12.5 / 255, 25.5 / 255, 50.5 / 255), a: 1 })
})

test('modern and legacy HSL parse angle units and modern numeric saturation/lightness', () => {
  for (const color of [
    'hsl(180deg 100% 50% / 25%)', 'hsla(.5turn 100 50 / .25)',
    'hsl(200grad 1e2% 5e1% / 25%)', 'hsl(3.141592653589793rad, 100%, 50%, .25)',
    'hsl(-.5turn 100% 50 / 25%)',
  ]) {
    assert.deepEqual(parseColorInput(color), { h: 180, s: 1, v: 1, a: 0.25 }, color)
  }
})

test('modern none components resolve to zero for standalone color conversion', () => {
  assert.deepEqual(parseColorInput('rgb(none 100% none / none)'), { h: 120, s: 1, v: 1, a: 0 })
  assert.deepEqual(parseColorInput('hsl(none 100% 50%)'), { h: 0, s: 1, v: 1, a: 1 })
  assert.deepEqual(parseColorInput('hsl(180 none 50 / none)'), { h: 180, s: 0, v: 0.5, a: 0 })
  assert.deepEqual(parseColorInput('oklch(none none none / none)'), { h: 0, s: 0, v: 0, a: 0 })
})

test('OKLCH parses numeric/percentage lightness and chroma, angle hue and alpha', () => {
  for (const [color, expected] of [
    ['oklch(0 0 0)', { r: 0, g: 0, b: 0 }],
    ['oklch(100% 0 0)', { r: 255, g: 255, b: 255 }],
    ['oklch(50% 0 270)', { r: 99, g: 99, b: 99 }],
    ['oklch(0.62795536 0.25768331 29.233885)', { r: 255, g: 0, b: 0 }],
  ]) {
    const parsed = parseColorInput(color)
    assert.ok(parsed, color)
    assert.deepEqual(hsvToRgb(parsed.h, parsed.s, parsed.v), expected, color)
  }
  assert.deepEqual(parseColorInput('oklch(70% 25% .5turn / 40%)'), parseColorInput('oklch(.7 .1 180 / .4)'))
  const vivid = parseColorInput('oklch(70% 100% 40deg / .5)')
  assert.ok(vivid)
  assert.equal(vivid.a, 0.5)
  assert.ok(vivid.h >= 0 && vivid.h < 360 && vivid.s >= 0 && vivid.s <= 1 && vivid.v >= 0 && vivid.v <= 1)
})

test('RGB helper shares extended syntax while retaining clamping and white fallback', () => {
  assert.deepEqual(parseRgbCss('rgb(100% 0 0 / 50%)'), { hex: '#ff0000', alpha: 0.5 })
  assert.deepEqual(parseRgbCss('rgba(12.5, 25.5, 50.5, 25%)'), { hex: '#0d1a33', alpha: 0.25 })
  assert.deepEqual(parseRgbCss('rgb(150% -20 0 / 200%)'), { hex: '#ff0000', alpha: 1 })
  assert.deepEqual(parseRgbCss('rgb(none none none / none)'), { hex: '#000000', alpha: 0 })
  assert.deepEqual(parseRgbCss('rgba(1, 2%, 3, .5)'), { hex: '#ffffff', alpha: 1 })
  assert.deepEqual(parseRgbCss('rebeccapurple'), { hex: '#ffffff', alpha: 1 })
})

test('extended parser rejects mixed separators, malformed tokens and contextual expressions', () => {
  for (const color of [
    'rgb(1, 2 3)', 'rgb(1 2 3, .5)', 'rgb(1, 2, 3 / .5)', 'rgb(1, 2%, 3)',
    'rgb(1 2 3 .5)', 'rgb(1 2 3 / .5 / .5)', 'rgb(1 2 3 /)', 'rgb(1 2 3,)',
    'rgba(none, 0, 0, 1)', 'hsl(none, 100%, 50%)', 'hsl(0, 100, 50)',
    'rgb(1e 0 0)', 'rgb(1e+ 0 0)', 'rgb(1..2 0 0)', 'rgb(1%foo 0 0)',
    'rgb(1 2 3 / 1.% )', 'hsl(0degg 100% 50%)', 'hsl(0% 100% 50%)',
    'oklch(.5, .1, 30)', 'oklch(.5 .1)', 'oklch(.5 .1 30 1)',
    'rgb(calc(255) 0 0)', 'rgb(from red r g b)', 'oklch(var(--color) .1 0)',
    'color(display-p3 1 0 0)', 'color-mix(in srgb, red, blue)',
  ]) assert.equal(parseColorInput(color), null, color)
})

test('extended syntax retains strict range and finite-number validation', () => {
  for (const color of [
    'rgb(101% 0 0)', 'rgb(-1 0 0)', 'rgb(256 0 0)', 'rgb(1e309 0 0)',
    'rgb(1 2 3 / 101%)', 'rgb(1 2 3 / -1%)', 'rgb(1 2 3 / 1e309)',
    'hsl(0 101% 50%)', 'hsl(0 100 -1)', 'hsl(1e309 100% 50%)',
    'oklch(101% .1 0)', 'oklch(-.1 .1 0)', 'oklch(.5 -1 0)',
    'oklch(.5 1e309 0)', 'oklch(.5 .1 0 / 101%)',
  ]) assert.equal(parseColorInput(color), null, color)
})

test('large finite hue angles normalize before conversion without overflowing', () => {
  for (const unit of ['', 'deg', 'grad', 'rad', 'turn']) {
    for (const sign of ['', '-']) {
      const parsed = parseColorInput(`hsl(${sign}1e308${unit} 100% 50%)`)
      assert.ok(parsed, `${sign}1e308${unit}`)
      assert.ok(Number.isFinite(parsed.h) && parsed.h >= 0 && parsed.h < 360)
      assert.ok(Object.values(hsvToRgb(parsed.h, parsed.s, parsed.v)).every(value => Number.isFinite(value)))
    }
  }
})

test('fractional RGB half-byte ties survive the HSV round trip', () => {
  for (const [color, expected] of [
    ['rgb(10% 67.38% 50.29% / .7562)', { r: 26, g: 172, b: 128 }],
    ['rgb(30% 6.22% 48.37% / .5653)', { r: 77, g: 16, b: 123 }],
    ['rgb(79.43% 9.38% 30% / .8503)', { r: 203, g: 24, b: 77 }],
  ]) {
    const parsed = parseColorInput(color)
    assert.ok(parsed)
    assert.deepEqual(hsvToRgb(parsed.h, parsed.s, parsed.v), expected, color)
    assert.equal(hsvToHex(parsed.h, parsed.s, parsed.v), parseRgbCss(color).hex, color)
  }
})

test('RGB byte rounding preserves values meaningfully below and above half-byte ties', () => {
  for (const byte of [0, 25, 76, 127, 254]) {
    const below = (byte + 0.5 - 1e-9) / 255
    const above = (byte + 0.5 + 1e-9) / 255
    assert.deepEqual(hsvToRgb(0, 0, below), { r: byte, g: byte, b: byte })
    assert.deepEqual(hsvToRgb(0, 0, above), { r: byte + 1, g: byte + 1, b: byte + 1 })
  }
})

test('hue normalization preserves positive precision and canonicalizes zero', () => {
  assert.equal(parseColorInput('hsl(359.99999999999994 100% 50%)').h, 359.99999999999994)
  for (const hue of ['-0', '-5e-324', '360', '-360']) {
    const parsed = parseColorInput(`hsl(${hue} 100% 50%)`)
    assert.ok(parsed)
    assert.equal(parsed.h, 0)
    assert.equal(Object.is(parsed.h, -0), false)
  }
})
