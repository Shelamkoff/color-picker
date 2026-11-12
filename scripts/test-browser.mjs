import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'
import { chromium, firefox, webkit } from 'playwright'

const engines = { chromium, firefox, webkit }
const engineName = process.env.COLOR_PICKER_BROWSER ?? 'chromium'
const engine = engines[engineName]
if (!engine) throw new TypeError(`Unsupported browser: ${engineName}`)

const server = spawn(process.execPath, [fileURLToPath(new URL('./dev-server.mjs', import.meta.url))], {
  env: { ...process.env, HOST: '127.0.0.1', PORT: '0' },
  stdio: ['ignore', 'pipe', 'pipe'],
})
let serverErrors = ''
server.stderr.on('data', chunk => { serverErrors += chunk })
let browser
try {
  const origin = await new Promise((resolve, reject) => {
    let output = ''
    const timeout = setTimeout(() => reject(new Error(`Demo server did not start: ${serverErrors}`)), 10000)
    server.stdout.on('data', chunk => {
      output += chunk
      const match = output.match(/http:\/\/127\.0\.0\.1:\d+/)
      if (match) { clearTimeout(timeout); resolve(match[0]) }
    })
    server.once('error', error => { clearTimeout(timeout); reject(error) })
    server.once('exit', code => {
      clearTimeout(timeout)
      reject(new Error(`Demo server exited (${code}): ${serverErrors}`))
    })
  })
  browser = await engine.launch({
    executablePath: process.env.COLOR_PICKER_BROWSER_EXECUTABLE_PATH || undefined,
    headless: true,
  })

  for (const file of ['lifecycle.html', 'regressions.html']) {
    const page = await browser.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    try {
      await page.goto(`${origin}/test/browser/${file}`)
      await page.waitForFunction(() => ['pass', 'fail'].includes(document.body.dataset.status))
      const result = await page.locator('#result').textContent()
      assert.equal(await page.locator('body').getAttribute('data-status'), 'pass', result)
      assert.deepEqual(errors, [], `${file}: unexpected page errors`)
      console.log(`${engineName}: ${file} PASS\n${result}`)
    } finally {
      await page.close()
    }
  }

  const page = await browser.newPage({ viewport: { width: 1000, height: 750 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(`${origin}/demo.html`)
  await page.waitForFunction(() => document.body.dataset.status === 'pass')

  const oracle = await page.evaluate(async () => {
    const { parseColorInput, hsvToRgb } = await import('/colorMath.js')
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
  })
  assert.deepEqual(oracle.failures, [], `Native sRGB canvas disagrees with the color parser: ${JSON.stringify(oracle.failures)}`)
  assert.equal(oracle.names, 148, 'Selected browser did not provide all named-color oracle results')
  assert.ok(oracle.oklch >= 77, 'Selected browser does not support enough OKLCH inputs to validate the converter')
  console.log(`${engineName}: native sRGB canvas compared ${oracle.compared} colors (${oracle.names} named, ${oracle.oklch} OKLCH); unsupported native syntax: ${JSON.stringify(oracle.unsupported)}`)

  const picker = page.getByRole('dialog', { name: 'Color picker', exact: true })
  const input = page.getByRole('textbox', { name: 'Color value', exact: true })
  const format = page.getByRole('button', { name: 'Change color format', exact: true })
  const open = page.getByRole('button', { name: 'Open picker', exact: true })

  assert.equal(await picker.isVisible(), true)
  await input.fill('#123456')
  await format.click()
  await format.click()
  await input.press('Enter')
  assert.equal(await page.locator('#value').textContent(), 'rgb(18, 52, 86)')
  await input.fill('not a color')
  assert.equal(await input.getAttribute('aria-invalid'), 'true')
  await input.fill('#ff0000')
  assert.equal(await input.getAttribute('aria-invalid'), null)

  const hue = page.getByRole('slider', { name: 'Hue', exact: true })
  await hue.press('Escape')
  assert.equal(await picker.isVisible(), false, 'Escape must hide the demo picker')
  await open.click()
  assert.equal(await picker.isVisible(), true)
  await input.fill('#ff0000')

  const hueRect = await hue.boundingBox()
  assert.ok(hueRect && hueRect.width > 0)
  await page.mouse.move(hueRect.x + 1, hueRect.y + hueRect.height / 2)
  await page.mouse.down()
  await page.mouse.move(hueRect.x + hueRect.width / 2, hueRect.y - 30, { steps: 5 })
  await page.mouse.up()
  assert.equal(await page.locator('#value').textContent(), 'rgb(0, 255, 255)', 'Pointer capture must track a drag outside the bar')
  await page.mouse.move(hueRect.x + hueRect.width * 0.75, hueRect.y + hueRect.height / 2)
  assert.equal(await page.locator('#value').textContent(), 'rgb(0, 255, 255)', 'Released pointer must not keep changing the color')

  for (const width of [1000, 375, 320]) {
    await page.setViewportSize({ width, height: 812 })
    const panel = await picker.boundingBox()
    const mount = await page.locator('#mount').boundingBox()
    assert.ok(panel && mount)
    assert.ok(panel.x >= 0 && panel.x + panel.width <= width, `Picker clipped at ${width}px`)
    assert.ok(Math.abs(panel.x - mount.x) < 1, `Picker shifted outside its mount at ${width}px`)
  }
  assert.deepEqual(errors, [], 'Demo emitted an unexpected page error')
  console.log(`${engineName}: trusted pointer input, keyboard, color precision, validation, demo visibility and mobile layout PASS`)
  await page.close()
} finally {
  await browser?.close()
  if (server.exitCode === null && server.signalCode === null) {
    const exited = once(server, 'exit')
    server.kill('SIGTERM')
    await exited
  }
}
