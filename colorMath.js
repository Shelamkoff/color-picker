/**
 * Color math utilities — pure functions for color space conversions.
 * No DOM dependencies.
 */

import { NAMED_COLORS } from './namedColors.js'
import { oklchToRgb } from './oklch.js'

/** Available color format names */
export const COLOR_FORMATS = Object.freeze(['HEX', 'RGB', 'HSL'])

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const asciiLowercase = (value) => value.replace(/[A-Z]/g, character => character.toLowerCase())

function normalizeHue(value) {
  const hue = value % 360
  if (hue < 0) return (hue + 360) % 360
  return hue === 0 ? 0 : hue
}

function toRgbByte(channel) {
  const value = channel * 255
  const half = Math.floor(value) + 0.5
  // RGB -> HSV -> RGB arithmetic can move an exact half-byte by a few
  // floating-point ulps. Correct only that final quantization boundary;
  // retain the full channel precision everywhere else.
  const roundedValue = Math.abs(value - half) <= 4 * Number.EPSILON * 255 ? half : value
  return Math.round(roundedValue)
}

/**
 * Convert HSV to hex string.
 * @param {number} h - Hue (0-360)
 * @param {number} s - Saturation (0-1)
 * @param {number} v - Value (0-1)
 * @returns {string}
 */
export function hsvToHex(h, s, v) {
  const { r, g, b } = hsvToRgb(h, s, v)
  const hex = (/** @type {number} */ n) => n.toString(16).padStart(2, '0')
  return '#' + hex(r) + hex(g) + hex(b)
}

/**
 * Convert normalized RGB (0-1) to HSV.
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {{ h: number, s: number, v: number }}
 */
export function rgbToHsv(r, g, b) {
  r = clamp(Number.isFinite(r) ? r : 0, 0, 1)
  g = clamp(Number.isFinite(g) ? g : 0, 0, 1)
  b = clamp(Number.isFinite(b) ? b : 0, 0, 1)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  const s = max === 0 ? 0 : d / max
  const v = max
  if (d !== 0) {
    if (max === r) h = 60 * (((g - b) / d + 6) % 6)
    else if (max === g) h = 60 * ((b - r) / d + 2)
    else h = 60 * ((r - g) / d + 4)
  }
  return { h, s, v }
}

/**
 * Convert hex string to HSV.
 * @param {string} hex
 * @returns {{ h: number, s: number, v: number }}
 */
export function hexToHsv(hex) {
  const match = typeof hex === 'string' ? hex.trim().match(/^#?([0-9a-f]{6})$/i) : null
  if (!match) throw new TypeError(`Invalid six-digit hex color: ${hex}`)
  const value = match[1]
  return rgbToHsv(
    parseInt(value.slice(0, 2), 16) / 255,
    parseInt(value.slice(2, 4), 16) / 255,
    parseInt(value.slice(4, 6), 16) / 255,
  )
}

/**
 * Convert HSV to RGB (0-255).
 * @param {number} h
 * @param {number} s
 * @param {number} v
 * @returns {{ r: number, g: number, b: number }}
 */
export function hsvToRgb(h, s, v) {
  h = normalizeHue(Number.isFinite(h) ? h : 0)
  s = clamp(Number.isFinite(s) ? s : 0, 0, 1)
  v = clamp(Number.isFinite(v) ? v : 0, 0, 1)
  const c = v * s
  const x = c * (1 - Math.abs((h / 60) % 2 - 1))
  const m = v - c
  let r, g, b
  if (h < 60) { r = c; g = x; b = 0 }
  else if (h < 120) { r = x; g = c; b = 0 }
  else if (h < 180) { r = 0; g = c; b = x }
  else if (h < 240) { r = 0; g = x; b = c }
  else if (h < 300) { r = x; g = 0; b = c }
  else { r = c; g = 0; b = x }
  return {
    r: toRgbByte(r + m),
    g: toRgbByte(g + m),
    b: toRgbByte(b + m),
  }
}

/**
 * Convert HSV to HSL.
 * @param {number} h
 * @param {number} s
 * @param {number} v
 * @returns {{ h: number, s: number, l: number }}
 */
export function hsvToHsl(h, s, v) {
  h = normalizeHue(Number.isFinite(h) ? h : 0)
  s = clamp(Number.isFinite(s) ? s : 0, 0, 1)
  v = clamp(Number.isFinite(v) ? v : 0, 0, 1)
  const l = v * (1 - s / 2)
  const sl = (l === 0 || l === 1) ? 0 : (v - l) / Math.min(l, 1 - l)
  return { h: Math.round(h), s: Math.round(sl * 100), l: Math.round(l * 100) }
}

/**
 * Format HSVA as a CSS color string in the given format.
 * @param {number} h
 * @param {number} s
 * @param {number} v
 * @param {number} a
 * @param {string} fmt - 'HEX', 'RGB', or 'HSL'
 * @returns {string}
 */
export function formatColor(h, s, v, a, fmt) {
  if (!COLOR_FORMATS.includes(fmt)) throw new TypeError(`Unsupported color format: ${fmt}`)
  a = clamp(Number.isFinite(a) ? a : 1, 0, 1)
  const hasAlpha = a < 1
  if (fmt === 'RGB') {
    const { r, g, b } = hsvToRgb(h, s, v)
    return hasAlpha ? `rgba(${r}, ${g}, ${b}, ${roundAlpha(a)})` : `rgb(${r}, ${g}, ${b})`
  }
  if (fmt === 'HSL') {
    const hsl = hsvToHsl(h, s, v)
    return hasAlpha
      ? `hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%, ${roundAlpha(a)})`
      : `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`
  }
  // HEX
  const hex = hsvToHex(h, s, v)
  if (hasAlpha) {
    const aa = Math.round(a * 255).toString(16).padStart(2, '0')
    return hex + aa
  }
  return hex
}

/**
 * Round alpha to 2 decimal places.
 * @param {number} a
 * @returns {number}
 */
export function roundAlpha(a) {
  return Math.round(clamp(Number.isFinite(a) ? a : 1, 0, 1) * 100) / 100
}

// Validate complete CSS number tokens. The decimal alternatives cannot both
// consume a decimal point, avoiding ambiguous runs of digit quantifiers.
const NUMBER_TOKEN = /^[+-]?(?:\d*\.\d+|\d+)(?:e[+-]?\d+)?$/
const HUE_TOKEN = /^([+-]?(?:\d*\.\d+|\d+)(?:e[+-]?\d+)?)(deg|grad|rad|turn)?$/

function parseFunction(value) {
  const match = value.match(/^(rgba?|hsla?|oklch)\(([\s\S]*)\)$/)
  if (!match) return null
  const [, name, body] = match
  const legacy = body.includes(',')
  if (legacy) {
    if (name === 'oklch' || body.includes('/')) return null
    const tokens = body.split(',', 5).map(token => token.trim())
    if (tokens.length !== 3 && tokens.length !== 4) return null
    return { name, components: tokens.slice(0, 3), alpha: tokens[3], legacy }
  }
  const parts = body.split('/', 3)
  if (parts.length > 2) return null
  const components = parts[0].trim().split(/[\t\n\f\r ]+/, 4)
  if (components.length !== 3) return null
  return { name, components, alpha: parts[1]?.trim(), legacy }
}

function parseComponent(token, numberScale, percentScale, allowNone) {
  if (allowNone && token === 'none') return 0
  const percentage = token.endsWith('%')
  const number = percentage ? token.slice(0, -1) : token
  if (!NUMBER_TOKEN.test(number)) return null
  return Number(number) / (percentage ? percentScale : numberScale)
}

function parseAlpha(token, allowNone) {
  return token === undefined ? 1 : parseComponent(token, 1, 100, allowNone)
}

function parseHue(token, allowNone) {
  if (allowNone && token === 'none') return 0
  const match = token.match(HUE_TOKEN)
  if (!match) return null
  const value = Number(match[1])
  if (!Number.isFinite(value)) return null
  const unit = match[2] ?? 'deg'
  const period = unit === 'turn' ? 1 : unit === 'grad' ? 400 : unit === 'rad' ? 2 * Math.PI : 360
  // Reduce in the source unit before converting to degrees so large finite
  // turns/radians cannot overflow during multiplication.
  return normalizeHue((value % period) * (360 / period))
}

function inUnitRange(value) {
  return value !== null && Number.isFinite(value) && value >= 0 && value <= 1
}

function parseRgbFunction(parsed, strict) {
  if (!parsed || (parsed.name !== 'rgb' && parsed.name !== 'rgba')) return null
  const { components, alpha, legacy } = parsed
  // Comma syntax must use either three percentages or three numbers.
  if (legacy && components.some(token => token.endsWith('%') !== components[0].endsWith('%'))) return null
  const [r, g, b] = components.map(token => parseComponent(token, 255, 100, !legacy))
  const a = parseAlpha(alpha, !legacy)
  const values = [r, g, b, a]
  if (values.some(value => value === null) || (strict && !values.every(inUnitRange))) return null
  return { r: clamp(r, 0, 1), g: clamp(g, 0, 1), b: clamp(b, 0, 1), a: clamp(a, 0, 1) }
}

/**
 * Parse rgb/rgba(...) CSS string to hex + alpha.
 * Accepts modern and comma syntax, numeric/percentage channels and alpha.
 * Channels are clamped; malformed input returns opaque white.
 * @param {string} css
 * @returns {{ hex: string, alpha: number }}
 */
export function parseRgbCss(css) {
  if (typeof css !== 'string') return { hex: '#ffffff', alpha: 1 }
  const rgb = parseRgbFunction(parseFunction(asciiLowercase(css.trim())), false)
  if (!rgb) return { hex: '#ffffff', alpha: 1 }
  const hex = '#' + [rgb.r, rgb.g, rgb.b].map(channel => Math.round(channel * 255).toString(16).padStart(2, '0')).join('')
  return { hex, alpha: rgb.a }
}

/**
 * Parse HEX, named colors, RGB(A), HSL(A), or OKLCH to sRGB HSVA.
 * Supports modern space/slash and legacy comma syntax where applicable.
 * Malformed or out-of-range input returns null; modern `none` resolves to zero.
 * OKLCH chroma is nonnegative and unbounded; colors are gamut-mapped to sRGB.
 * Contextual values such as currentColor, var(), and calc() are not resolved.
 * @param {string} str
 * @returns {{ h: number, s: number, v: number, a: number } | null}
 */
export function parseColorInput(str) {
  if (typeof str !== 'string') return null
  str = asciiLowercase(str.trim())

  if (str.startsWith('#')) {
    if (!/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.test(str)) return null
    let hex = str.slice(1)
    if (hex.length <= 4) hex = [...hex].map(digit => digit + digit).join('')
    return { ...hexToHsv(hex.slice(0, 6)), a: hex.length === 8 ? parseInt(hex.slice(6), 16) / 255 : 1 }
  }
  if (str === 'transparent') return { h: 0, s: 0, v: 0, a: 0 }
  if (Object.hasOwn(NAMED_COLORS, str)) return { ...hexToHsv(NAMED_COLORS[str]), a: 1 }

  const parsed = parseFunction(str)
  if (!parsed) return null
  if (parsed.name === 'rgb' || parsed.name === 'rgba') {
    const rgb = parseRgbFunction(parsed, true)
    return rgb ? { ...rgbToHsv(rgb.r, rgb.g, rgb.b), a: rgb.a } : null
  }

  const { name, components, alpha, legacy } = parsed
  const a = parseAlpha(alpha, !legacy)
  if (!inUnitRange(a)) return null
  if (name === 'hsl' || name === 'hsla') {
    if (legacy && (!components[1].endsWith('%') || !components[2].endsWith('%'))) return null
    const h = parseHue(components[0], !legacy)
    const sl = parseComponent(components[1], 100, 100, !legacy)
    const l = parseComponent(components[2], 100, 100, !legacy)
    if (h === null || !inUnitRange(sl) || !inUnitRange(l)) return null
    const v = l + sl * Math.min(l, 1 - l)
    const s = v === 0 ? 0 : 2 * (1 - l / v)
    return { h, s, v, a }
  }

  const l = parseComponent(components[0], 1, 100, true)
  const c = parseComponent(components[1], 1, 250, true)
  const h = parseHue(components[2], true)
  if (!inUnitRange(l) || c === null || !Number.isFinite(c) || c < 0 || h === null) return null
  const rgb = oklchToRgb(l, c, h)
  return { ...rgbToHsv(rgb.r, rgb.g, rgb.b), a }
}
