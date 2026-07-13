import { ColorPicker } from '../../index.js'

const assert = (condition, message) => { if (!condition) throw new Error(message) }

function trackDragListeners() {
  const add = EventTarget.prototype.addEventListener
  const remove = EventTarget.prototype.removeEventListener
  const active = []
  EventTarget.prototype.addEventListener = function (type, listener, options) {
    if (['pointermove', 'pointerup', 'pointercancel'].includes(type)) {
      active.push({ target: this, type, listener, enabled: true })
    }
    add.call(this, type, listener, options)
  }
  EventTarget.prototype.removeEventListener = function (type, listener, options) {
    const record = active.find(item => item.enabled && item.target === this && item.type === type && item.listener === listener)
    if (record) record.enabled = false
    remove.call(this, type, listener, options)
  }
  return () => active.filter(item => item.enabled).length
}

const result = document.querySelector('#result')
try {
  const activeDragListeners = trackDragListeners()
  const applied = []
  const changed = []
  const formats = []
  const picker = new ColorPicker({
    onApply: color => applied.push(color),
    onChange: color => changed.push(color),
    onFormatChange: (value, format) => formats.push([value, format]),
  })
  document.body.appendChild(picker.element)
  picker.open('rgba(255, 0, 0, 0.5)')
  assert(picker.element.style.display === '', 'picker did not open')

  const input = picker.element.querySelector('.oe-color-hex')
  input.value = 'hsl(120, 100%, 50%)'
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
  assert(applied.at(-1) === 'rgb(0, 255, 0)', 'Enter did not apply parsed input')
  assert(changed.at(-1) === 'rgb(0, 255, 0)', 'input did not emit normalized change')

  picker.element.querySelector('.oe-color-format').click()
  assert(formats.length === 1 && formats[0][1] === 'RGB', 'format cycle did not emit')

  const hue = picker.element.querySelector('.oe-color-hue')
  const beforeKeyboard = changed.length
  hue.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }))
  assert(hue.getAttribute('role') === 'slider' && hue.getAttribute('aria-valuenow') === '121', 'hue keyboard/ARIA state did not update')
  assert(changed.length === beforeKeyboard + 1, 'hue keyboard change was not emitted')

  picker.element.querySelector('.oe-color-sv').dispatchEvent(new PointerEvent('pointerdown', {
    bubbles: true, cancelable: true, clientX: 1, clientY: 1, pointerId: 7, pointerType: 'touch',
  }))
  assert(activeDragListeners() === 3, 'pointer drag listeners were not installed')
  picker.close()
  assert(activeDragListeners() === 0, 'close leaked active drag listeners')
  picker.open('rgb(0, 255, 0)')
  picker.element.querySelector('.oe-color-sv').dispatchEvent(new PointerEvent('pointerdown', {
    bubbles: true, cancelable: true, clientX: 1, clientY: 1, pointerId: 8, pointerType: 'touch',
  }))
  const retainedApply = picker.element.querySelector('.oe-color-btn--apply')
  const beforeDestroy = applied.length
  picker.destroy()
  retainedApply.click()
  assert(activeDragListeners() === 0, 'destroy leaked drag listeners')
  assert(applied.length === beforeDestroy, 'retained DOM invoked callbacks after destroy')
  assert(!picker.element.isConnected, 'destroy left picker mounted')

  document.body.dataset.status = 'pass'
  result.textContent = JSON.stringify({ applied: applied.length, changed: changed.length, formats: formats.length })
} catch (error) {
  document.body.dataset.status = 'fail'
  result.textContent = error?.stack || String(error)
}
