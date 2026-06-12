/**
 * Color math utilities — pure functions for color space conversions.
 * No DOM dependencies.
 */

/** Available color format names */
export const COLOR_FORMATS = ['HEX', 'RGB', 'HSL']

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
  return rgbToHsv(
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
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
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
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
  return Math.round(a * 100) / 100
}

/**
 * Parse rgb/rgba(...) CSS string to hex + alpha.
 * @param {string} css
 * @returns {{ hex: string, alpha: number }}
 */
export function parseRgbCss(css) {
  const m = css.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?/)
  if (!m) return { hex: '#ffffff', alpha: 1 }
  const h = (/** @type {string} */ n) => Number(n).toString(16).padStart(2, '0')
  const hex = '#' + h(/** @type {string} */ (m[1])) + h(/** @type {string} */ (m[2])) + h(/** @type {string} */ (m[3]))
  const alpha = m[4] !== undefined ? parseFloat(m[4]) : 1
  return { hex, alpha }
}

/**
 * Parse any color string (hex, rgb, rgba, hsl, hsla) to HSVA or null.
 * @param {string} str
 * @returns {{ h: number, s: number, v: number, a: number } | null}
 */
export function parseColorInput(str) {
  str = str.trim().toLowerCase()

  // #rrggbbaa
  let m = str.match(/^#([0-9a-f]{8})$/)
  if (m && m[1]) {
    const hsv = hexToHsv('#' + m[1].slice(0, 6))
    const a = parseInt(m[1].slice(6, 8), 16) / 255
    return { ...hsv, a }
  }

  // #rrggbb
  m = str.match(/^#([0-9a-f]{6})$/)
  if (m && m[1]) return { ...hexToHsv('#' + m[1]), a: 1 }

  // #rgb
  m = str.match(/^#([0-9a-f]{3})$/)
  if (m && m[1]) {
    const e = m[1]
    return { ...hexToHsv('#' + e[0] + e[0] + e[1] + e[1] + e[2] + e[2]), a: 1 }
  }

  // rgb(r, g, b) or rgba(r, g, b, a)
  m = str.match(/^rgba?\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([\d.]+))?\s*\)$/)
  if (m) {
    const a = m[4] !== undefined ? parseFloat(m[4]) : 1
    return { ...rgbToHsv(Number(m[1]) / 255, Number(m[2]) / 255, Number(m[3]) / 255), a }
  }

  // hsl(h, s%, l%) or hsla(h, s%, l%, a)
  m = str.match(/^hsla?\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})%\s*,\s*(\d{1,3})%\s*(?:,\s*([\d.]+))?\s*\)$/)
  if (m) {
    const hh = Number(m[1]), sl = Number(m[2]) / 100, l = Number(m[3]) / 100
    const a = m[4] !== undefined ? parseFloat(m[4]) : 1
    const vv = l + sl * Math.min(l, 1 - l)
    const sv = vv === 0 ? 0 : 2 * (1 - l / vv)
    return { h: hh, s: sv, v: vv, a }
  }

  return null
}
