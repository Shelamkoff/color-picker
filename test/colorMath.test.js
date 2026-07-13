import test from 'node:test'
import assert from 'node:assert/strict'
import {
  formatColor,
  hexToHsv,
  hsvToRgb,
  parseColorInput,
  parseRgbCss,
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
