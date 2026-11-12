import assert from 'node:assert/strict'
import test from 'node:test'
import { Window } from 'happy-dom'
import { runColorPickerRegressions } from './browser/regression-suite.js'

test('ColorPicker lifecycle and input behavior in a simulated DOM', async t => {
  const window = new Window({ url: 'https://color-picker.test/' })
  const globals = {
    window,
    document: window.document,
    AbortController: window.AbortController,
    DOMException: window.DOMException,
    Event: window.Event,
    EventTarget: window.EventTarget,
    HTMLElement: window.HTMLElement,
    KeyboardEvent: window.KeyboardEvent,
    PointerEvent: window.PointerEvent,
  }
  const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }

  // Happy DOM has no layout engine. Supply fixed slider geometry explicitly;
  // native layout, pointer capture, focus painting and touch require test:browser.
  window.HTMLElement.prototype.getBoundingClientRect = function () {
    const picker = this.closest('.oe-color-dropdown')
    if (!this.isConnected || picker?.style.display === 'none') return new window.DOMRect(0, 0, 0, 0)
    return new window.DOMRect(0, 0, 200, this.classList.contains('oe-color-sv') ? 140 : 12)
  }

  try {
    const moduleUrl = process.env.COLOR_PICKER_TEST_MODULE ?? new URL('../ColorPicker.js', import.meta.url).href
    const { ColorPicker } = await import(moduleUrl)
    const report = await runColorPickerRegressions(ColorPicker)
    t.diagnostic(`${report.passed}/${report.results.length} simulated DOM scenarios passed`)
    const failures = report.results.filter(result => result.status === 'fail')
    assert.equal(report.failed, 0, JSON.stringify(failures, null, 2))
  } finally {
    await window.happyDOM.close()
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  }
})
