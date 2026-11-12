import test from 'node:test'
import assert from 'node:assert/strict'
import { oklchToRgb } from '../oklch.js'

function assertRgb(actual, expected, tolerance = 1e-9) {
  for (const [index, channel] of ['r', 'g', 'b'].entries()) {
    assert.ok(Number.isFinite(actual[channel]), `${channel} is not finite`)
    assert.ok(actual[channel] >= 0 && actual[channel] <= 1, `${channel} is outside sRGB`)
    assert.ok(Math.abs(actual[channel] - expected[index]) <= tolerance,
      `${channel}: expected ${expected[index]}, received ${actual[channel]}`)
  }
}

// Independent reference coordinates: Color.js 0.7.1, using the W3C CSS Color 4
// D65-consistent conversion matrices. These are fixed vectors, not round trips
// through the implementation under test.
// https://www.w3.org/TR/css-color-4/#color-conversion-code
test('OKLCH reference sRGB primary colors convert correctly', () => {
  const vectors = [
    [[0.6279553639214311, 0.2576833038053608, 29.23388027962784], [1, 0, 0]],
    [[0.8664396175234368, 0.2948272245426958, 142.4953450414439], [0, 1, 0]],
    [[0.45201371817442365, 0.3132143886344849, 264.0520226163699], [0, 0, 1]],
  ]
  for (const [input, expected] of vectors) assertRgb(oklchToRgb(...input), expected)
})

test('OKLCH neutral colors have identical channels and use the sRGB transfer function', () => {
  assert.deepEqual(oklchToRgb(0, 0, 0), { r: 0, g: 0, b: 0 })
  assert.deepEqual(oklchToRgb(1, 0, 0), { r: 1, g: 1, b: 1 })
  assertRgb(oklchToRgb(0.5, 0, 0), Array(3).fill(0.3885728590463344))
  assertRgb(oklchToRgb(0.5998708056221469, 0, 237), Array(3).fill(128 / 255))
  for (const lightness of [0.001, 0.01, 0.5, 0.75, 0.999]) {
    const { r, g, b } = oklchToRgb(lightness, 0, 123)
    assert.equal(r, g)
    assert.equal(g, b)
  }
})

test('OKLCH preserves an in-gamut chromatic reference without mapping', () => {
  assertRgb(oklchToRgb(0.5, 0.001, 0), [
    0.39072295995542133, 0.38774226428375086, 0.3884839064394994,
  ])
})

// Fixed independent out-of-gamut fixtures from Color.js 0.7.1, method: 'css'.
// That implementation follows CSS Color 4 local-MINDE (JND .02, epsilon .0001).
// https://colorjs.io/docs/gamut-mapping.html
// https://www.w3.org/TR/css-color-4/#binsearch
test('OKLCH gamut mapping matches CSS local-MINDE reference vectors', () => {
  const vectors = [
    [[0.76, 0.27, 60], [1, 0.5485545069218469, 0]],
    [[0.7, 0.3, 30], [1, 0.34513507874832117, 0.264575112251765]],
    [[0.9, 0.2, 100], [0.9949292399178079, 0.8741558470763664, 0]],
    [[0.6, 0.3, 270], [0.3034764659101982, 0.4123113764669139, 1]],
    [[0.7, 0.4, 180], [0, 0.73366765054822, 0.6347520430566194]],
    [[0.8, 0.4, 320], [0.961728687665213, 0.5535085714845979, 1]],
    [[0.2, 0.4, 60], [0.16802549082202897, 0.04325096548214697, 0]],
    [[0.99, 0.4, 30], [1, 0.963208198536554, 0.9459189422985007]],
    [[0.9, 100, 90], [1, 0.8431318231980087, 0.11206821645730974]],
    [[0.25, 100, 120], [0.11467807384569209, 0.14992310459958166, 0]],
    [[0.7, 1e6, 30], [1, 0.34520575704886125, 0.2646473582323184]],
  ]
  for (const [input, expected] of vectors) assertRgb(oklchToRgb(...input), expected)
})

test('OKLCH mapping normalizes hue and preserves exact lightness endpoints', () => {
  const reference = oklchToRgb(0.7, 0.3, 30)
  for (const hue of [-690, -330, 390, 750]) {
    assertRgb(oklchToRgb(0.7, 0.3, hue), Object.values(reference))
  }
  assert.deepEqual(oklchToRgb(0, Number.MAX_VALUE, 90), { r: 0, g: 0, b: 0 })
  assert.deepEqual(oklchToRgb(1, Number.MAX_VALUE, 90), { r: 1, g: 1, b: 1 })
})

test('OKLCH accepts enormous finite chroma without overflow or a different mapping policy', () => {
  // Different input chroma can finish on nearby binary-search samples within
  // the spec's epsilon. Allow less than a tenth of an 8-bit channel against
  // the independently gamut-mapped Color.js result for C=1e6.
  const expected = [1, 0.34520575704886125, 0.2646473582323184]
  for (const chroma of [1e6, 1e100, Number.MAX_VALUE]) {
    assertRgb(oklchToRgb(0.7, chroma, 30), expected, 0.0003)
  }
})

test('internal OKLCH conversion clamps finite endpoints and rejects non-finite coordinates', () => {
  assert.deepEqual(oklchToRgb(-1, 0.3, 90), { r: 0, g: 0, b: 0 })
  assert.deepEqual(oklchToRgb(2, 0.3, 90), { r: 1, g: 1, b: 1 })
  assert.deepEqual(oklchToRgb(0.5, -1, 90), oklchToRgb(0.5, 0, 90))
  for (const invalid of [NaN, Infinity, -Infinity, '0.5']) {
    for (const coordinate of [0, 1, 2]) {
      const values = [0.5, 0.1, 90]
      values[coordinate] = invalid
      assert.throws(() => oklchToRgb(...values), RangeError)
    }
  }
})
