// CSS Color 4 D65-consistent matrices and extended sRGB transfer functions.
// The sRGB/LMS matrices combine the XYZ matrices from the reference code.
// https://www.w3.org/TR/css-color-4/#color-conversion-code
const LINEAR_SRGB_TO_LMS = [
  [0.41222146947076305, 0.5363325372617348, 0.05144599326750221],
  [0.21190349581782522, 0.6806995506452344, 0.10739695353694056],
  [0.08830245919005643, 0.2817188391361215, 0.6299787016738222],
]
const LMS_TO_LINEAR_SRGB = [
  [4.076741636075958, -3.3077115392580616, 0.2309699031821043],
  [-1.2684379732850317, 2.6097573492876887, -0.34131937600265727],
  [-0.004196076138675564, -0.7034186179359363, 1.7076146940746117],
]
const OKLAB_TO_LMS = [
  [1, 0.3963377773761749, 0.2158037573099136],
  [1, -0.1055613458156586, -0.0638541728258133],
  [1, -0.0894841775298119, -1.2914855480194092],
]
const LMS_TO_OKLAB = [
  [0.210454268309314, 0.7936177747023054, -0.0040720430116193],
  [1.9779985324311684, -2.42859224204858, 0.450593709617411],
  [0.0259040424655478, 0.7827717124575296, -0.8086757549230774],
]

const JND = 0.02
const EPSILON = 0.0001

// Every in-gamut linear sRGB channel lies in [0, 1]. The nonnegative LMS
// matrix therefore bounds each LMS cube root by the cube root of its row sum.
// Bound |a| and |b| using the positive/negative Oklab matrix coefficients.
// Beyond that maximum chroma + JND no clipped sRGB color can be within JND
// (reverse triangle inequality). This bounds the SEARCH, not accepted chroma,
// and avoids overflow and long searches for inputs such as Number.MAX_VALUE.
const maxLmsRoots = LINEAR_SRGB_TO_LMS.map(row => Math.cbrt(row.reduce((sum, value) => sum + value, 0)))
const maxAbsOpponent = row => Math.max(
  row.reduce((sum, value, index) => sum + Math.max(0, value) * maxLmsRoots[index], 0),
  row.reduce((sum, value, index) => sum - Math.min(0, value) * maxLmsRoots[index], 0),
)
const MAX_SEARCH_CHROMA = Math.hypot(
  maxAbsOpponent(LMS_TO_OKLAB[1]), maxAbsOpponent(LMS_TO_OKLAB[2]),
) + JND + EPSILON

function multiply(matrix, vector) {
  return matrix.map(row => row[0] * vector[0] + row[1] * vector[1] + row[2] * vector[2])
}

function linearToSrgb(value) {
  const absolute = Math.abs(value)
  return absolute <= 0.0031308
    ? 12.92 * value
    : Math.sign(value) * (1.055 * absolute ** (1 / 2.4) - 0.055)
}

function oklabToSrgb(lab) {
  const lms = multiply(OKLAB_TO_LMS, lab).map(value => value ** 3)
  return multiply(LMS_TO_LINEAR_SRGB, lms).map(linearToSrgb)
}

function srgbToOklab(rgb) {
  const linear = rgb.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  const lms = multiply(LINEAR_SRGB_TO_LMS, linear).map(Math.cbrt)
  return multiply(LMS_TO_OKLAB, lms)
}

const inGamut = rgb => rgb.every(value => value >= 0 && value <= 1)
const clip = rgb => rgb.map(value => Math.max(0, Math.min(1, value)))
const toRgbObject = rgb => ({ r: rgb[0], g: rgb[1], b: rgb[2] })

function deltaE(clipped, lab) {
  const actual = srgbToOklab(clipped)
  return Math.hypot(actual[0] - lab[0], actual[1] - lab[1], actual[2] - lab[2])
}

/**
 * Convert a finite OKLCH color to normalized sRGB using CSS Color 4 local-MINDE.
 * Internal helper; callers validate parsing ranges. Finite lightness endpoints
 * map to black/white, negative chroma to neutral, and hue wraps in degrees.
 * In-gamut colors are preserved; out-of-gamut colors reduce chroma at constant
 * lightness/hue using the spec's just-noticeable and binary-search tolerances.
 * https://www.w3.org/TR/css-color-4/#binsearch
 * @param {number} l Lightness (0..1)
 * @param {number} c Nonnegative chroma (no upper input limit)
 * @param {number} h Hue in degrees
 * @returns {{ r: number, g: number, b: number }} Channels in 0..1
 */
export function oklchToRgb(l, c, h) {
  if (![l, c, h].every(Number.isFinite)) throw new RangeError('OKLCH coordinates must be finite numbers')
  if (l <= 0) return { r: 0, g: 0, b: 0 }
  if (l >= 1) return { r: 1, g: 1, b: 1 }

  const neutral = linearToSrgb(l ** 3)
  if (c <= 0) return { r: neutral, g: neutral, b: neutral }
  const radians = (((h % 360) + 360) % 360) * Math.PI / 180
  const cosine = Math.cos(radians)
  const sine = Math.sin(radians)
  let clipped = [neutral, neutral, neutral]

  if (c <= MAX_SEARCH_CHROMA) {
    const origin = [l, c * cosine, c * sine]
    const rgb = oklabToSrgb(origin)
    if (inGamut(rgb)) return toRgbObject(rgb)
    clipped = clip(rgb)
    if (deltaE(clipped, origin) < JND) return toRgbObject(clipped)
  }

  let min = 0
  // Fast-forward only the initial binary-search halvings whose candidates are
  // provably too far from every sRGB color. Power-of-two scaling preserves the
  // reference search's samples; the remaining interval needs at most 16 steps.
  let max = c > MAX_SEARCH_CHROMA
    ? c / 2 ** Math.floor(Math.log2(c / MAX_SEARCH_CHROMA))
    : c
  let minInGamut = true
  while (max - min > EPSILON) {
    const chroma = (min + max) / 2
    const current = [l, chroma * cosine, chroma * sine]
    const rgb = oklabToSrgb(current)
    if (minInGamut && inGamut(rgb)) {
      min = chroma
      continue
    }

    clipped = clip(rgb)
    const difference = deltaE(clipped, current)
    if (difference < JND) {
      if (JND - difference < EPSILON) return toRgbObject(clipped)
      minInGamut = false
      min = chroma
    } else {
      max = chroma
    }
  }
  return toRgbObject(clipped)
}
