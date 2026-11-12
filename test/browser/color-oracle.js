import { parseColorInput, hsvToRgb } from '../../colorMath.js'

/** Compare the library with the browser's native sRGB canvas implementation. */
export function runColorOracle() {
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  const context = canvas.getContext('2d', { colorSpace: 'srgb', willReadFrequently: true })
  if (!context) throw new Error('The selected browser cannot provide a 2D canvas color oracle')

  // W3C named-color vocabulary; expected RGB values come from the browser,
  // independently of the library's lookup table.
  // https://www.w3.org/TR/css-color-4/#named-colors
  const names = `aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond
    blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan
    darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange
    darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet
    deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite
    gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush
    lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink
    lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen
    magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue
    mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy
    oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip
    peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown
    seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle
    tomato turquoise violet wheat white whitesmoke yellow yellowgreen`.split(/\s+/)
  if (names.length !== 148 || new Set(names).size !== 148) throw new Error('Incomplete named-color oracle vocabulary')

  const fixtures = [
    ...names.map(css => ({ css, kind: 'name' })),
    { css: '#abcd', opaque: '#abc' },
    { css: '#f000', opaque: '#f00' },
    { css: 'rgb(18 52 86 / 25%)', opaque: 'rgb(18 52 86)' },
    { css: 'rgb(100% 0 50% / .4)', opaque: 'rgb(100% 0 50%)' },
    { css: 'rgba(2.55e2 +0 0 / 5e-1)', opaque: 'rgb(255 0 0)' },
    { css: 'rgb(18 52 86 / 0%)', opaque: 'rgb(18 52 86)' },
    { css: 'rgb(none 255 none / 50%)', opaque: 'rgb(0 255 0)' },
    { css: 'hsl(.5turn 100% 50% / 25%)', opaque: 'hsl(.5turn 100% 50%)' },
    { css: 'hsla(-120deg 100% 50% / .75)', opaque: 'hsl(-120deg 100% 50%)' },
    { css: 'hsl(200grad 100% 50%)' },
    { css: 'hsl(3.141592653589793rad 100% 50%)' },
    { css: 'LightGoldenRodYellow' },
    { css: 'transparent', opaque: '#000' },
    { css: 'oklch(50% 0 180deg / 25%)', opaque: 'oklch(50% 0 180deg)', kind: 'oklch' },
    { css: 'oklch(.5 0% .75turn / 0)', opaque: 'oklch(.5 0% .75turn)', kind: 'oklch' },
  ]

  // These low-chroma vectors stay inside sRGB. Native out-of-gamut mapping
  // varies across engines; the deterministic reference tests cover that path.
  for (const lightness of [0.25, 0.5, 0.75]) {
    for (const chroma of [0.02, 0.04]) {
      for (let hue = 0; hue < 360; hue += 30) {
        fixtures.push({ css: `oklch(${lightness} ${chroma} ${hue})`, kind: 'oklch' })
      }
    }
  }
  for (const lightness of [0, 0.1, 0.5, 0.9, 1]) {
    fixtures.push({ css: `oklch(${lightness} 0 0)`, kind: 'oklch' })
  }

  const readPixel = css => {
    if (!CSS.supports('color', css)) return null
    context.fillStyle = 'rgba(1, 2, 3, 0.125)'
    const sentinel = context.fillStyle
    context.fillStyle = css
    if (context.fillStyle === sentinel) return null
    context.clearRect(0, 0, 1, 1)
    context.fillRect(0, 0, 1, 1)
    return [...context.getImageData(0, 0, 1, 1).data]
  }
  const report = { compared: 0, names: 0, oklch: 0, unsupported: [], failures: [] }
  for (const fixture of fixtures) {
    // Canvas uses premultiplied alpha and loses hidden RGB at alpha=0.
    // Compare RGB using an opaque equivalent and alpha in a separate pixel.
    // https://html.spec.whatwg.org/multipage/canvas.html#premultiplied-alpha
    const opaque = readPixel(fixture.opaque ?? fixture.css)
    const pixel = readPixel(fixture.css)
    if (!opaque || !pixel) {
      report.unsupported.push(fixture.css)
      continue
    }
    report.compared += 1
    if (fixture.kind === 'name') report.names += 1
    if (fixture.kind === 'oklch') report.oklch += 1
    const parsed = parseColorInput(fixture.css)
    if (!parsed || !['h', 's', 'v', 'a'].every(key => Number.isFinite(parsed[key]))) {
      report.failures.push({ css: fixture.css, error: 'Library did not return finite HSVA for a supported color' })
      continue
    }
    const rgb = hsvToRgb(parsed.h, parsed.s, parsed.v)
    const actual = [rgb.r, rgb.g, rgb.b, Math.round(parsed.a * 255)]
    const expected = [...opaque.slice(0, 3), pixel[3]]
    const tolerance = fixture.kind === 'name' || fixture.css.startsWith('#') ? 0 : 1
    if (actual.some((channel, index) => !Number.isFinite(channel) || Math.abs(channel - expected[index]) > tolerance)) {
      report.failures.push({ css: fixture.css, expected, actual })
    }
  }
  return report
}

/** Keep the same required coverage and failure gates in every browser runner. */
export function assertColorOracle(report) {
  if (!Array.isArray(report.failures) || report.failures.length !== 0) {
    throw new Error(`Native sRGB canvas disagrees with the color parser: ${JSON.stringify(report.failures)}`)
  }
  if (report.names !== 148) {
    throw new Error('Selected browser did not provide all named-color oracle results')
  }
  if (!(report.oklch >= 77)) {
    throw new Error('Selected browser does not support enough OKLCH inputs to validate the converter')
  }
}
