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

  for (const file of ['lifecycle.html', 'regressions.html', 'color-oracle.html']) {
    const page = await browser.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    try {
      await page.goto(`${origin}/test/browser/${file}`)
      await page.waitForFunction(() => ['pass', 'fail'].includes(document.body.dataset.status))
      const result = await page.locator('#result').textContent()
      assert.equal(await page.locator('body').getAttribute('data-status'), 'pass', result)
      assert.deepEqual(errors, [], `${file}: unexpected page errors`)
      if (file === 'color-oracle.html') {
        const oracle = JSON.parse(result)
        console.log(`${engineName}: native sRGB canvas compared ${oracle.compared} colors (${oracle.names} named, ${oracle.oklch} OKLCH); unsupported native syntax: ${JSON.stringify(oracle.unsupported)}`)
      } else {
        console.log(`${engineName}: ${file} PASS\n${result}`)
      }
    } finally {
      await page.close()
    }
  }

  const page = await browser.newPage({ viewport: { width: 1000, height: 750 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(`${origin}/demo.html`)
  await page.waitForFunction(() => document.body.dataset.status === 'pass')

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
