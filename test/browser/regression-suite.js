/** Shared behavior checks for real browsers and the explicitly mocked DOM runner. */
export async function runColorPickerRegressions(ColorPicker) {
  const assert = (condition, message) => { if (!condition) throw new Error(message) }
  const cases = []
  const test = (name, run) => cases.push({ name, run })
  const pickers = []
  const results = []
  const settle = async () => { await Promise.resolve(); await Promise.resolve() }

  function mount(options = {}) {
    const picker = new ColorPicker(options)
    pickers.push(picker)
    document.body.append(picker.element)
    picker.open('#ff0000')
    return picker
  }

  function control(picker, selector) {
    const element = picker.element.querySelector(selector)
    assert(element, `Missing control: ${selector}`)
    return element
  }

  function press(element, key, extra = {}) {
    element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extra }))
  }

  function pointer(element, type, extra = {}) {
    const rect = element.getBoundingClientRect()
    element.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, pointerId: 11, pointerType: 'mouse', button: 0, buttons: 1,
      clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2,
      ...extra,
    }))
  }

  function enter(picker, value) {
    const input = control(picker, '.oe-color-hex')
    input.value = value
    input.dispatchEvent(new Event('input', { bubbles: true }))
    return input
  }

  function trackDragListeners() {
    const prototype = HTMLElement.prototype
    const addDescriptor = Object.getOwnPropertyDescriptor(prototype, 'addEventListener')
    const removeDescriptor = Object.getOwnPropertyDescriptor(prototype, 'removeEventListener')
    const add = prototype.addEventListener
    const remove = prototype.removeEventListener
    const active = []
    const types = ['pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']
    prototype.addEventListener = function (type, listener, options) {
      if (types.includes(type)) active.push({ target: this, type, listener })
      return add.call(this, type, listener, options)
    }
    prototype.removeEventListener = function (type, listener, options) {
      const index = active.findIndex(item => item.target === this && item.type === type && item.listener === listener)
      if (index !== -1) active.splice(index, 1)
      return remove.call(this, type, listener, options)
    }
    return {
      count: () => active.length,
      restore() {
        if (addDescriptor) Object.defineProperty(prototype, 'addEventListener', addDescriptor)
        else delete prototype.addEventListener
        if (removeDescriptor) Object.defineProperty(prototype, 'removeEventListener', removeDescriptor)
        else delete prototype.removeEventListener
      },
    }
  }

  function mockEyeDropper() {
    const descriptor = Object.getOwnPropertyDescriptor(window, 'EyeDropper')
    const pending = []
    Object.defineProperty(window, 'EyeDropper', {
      configurable: true,
      value: class {
        open(options) {
          return new Promise((resolve, reject) => pending.push({ resolve, reject, signal: options?.signal }))
        }
      },
    })
    return {
      pending,
      restore() {
        if (descriptor) Object.defineProperty(window, 'EyeDropper', descriptor)
        else delete window.EyeDropper
      },
    }
  }

  test('invalid alpha leaves the previous color and controls unchanged', () => {
    const applied = []
    const picker = mount({ onApply: value => applied.push(value) })
    picker.open('rgba(255, 0, 0, 0.25)')
    const input = control(picker, '.oe-color-hex')
    const before = input.value
    let failure
    try { picker.open('#00ff00', NaN) } catch (error) { failure = error }
    assert(failure instanceof RangeError, 'Invalid alpha was not rejected')
    control(picker, '.oe-color-btn--apply').click()
    assert(input.value === before && applied.at(-1) === 'rgba(255, 0, 0, 0.25)', 'Rejected open partially replaced the current color')
  })

  for (const operation of ['close', 'destroy', 'open']) {
    test(`${operation} from the initial drag callback releases all drag listeners`, () => {
      const listeners = trackDragListeners()
      let changed = 0
      let picker
      try {
        picker = mount({ onChange() {
          changed += 1
          if (operation === 'open') picker.open('#0000ff')
          else picker[operation]()
        } })
        const hue = control(picker, '.oe-color-hue')
        pointer(hue, 'pointerdown')
        pointer(hue, 'pointermove', { clientX: 0 })
        assert(changed === 1, 'A completed interaction emitted another change')
        assert(listeners.count() === 0, 'A completed interaction retained drag listeners')
        if (operation === 'open') assert(control(picker, '.oe-color-hex').value === '#0000ff', 'Old drag overwrote the newly opened color')
      } finally {
        picker?.destroy()
        listeners.restore()
      }
    })
  }

  test('closing from focus during pointerdown prevents a new drag', () => {
    const listeners = trackDragListeners()
    let changed = 0
    let picker
    try {
      picker = mount({ onChange: () => changed++ })
      const hue = control(picker, '.oe-color-hue')
      hue.addEventListener('focus', () => picker.close(), { once: true })
      pointer(hue, 'pointerdown')
      pointer(hue, 'pointermove')
      assert(changed === 0, 'Pointerdown continued after focus closed the picker')
      assert(listeners.count() === 0, 'A focus callback closed the picker but drag listeners were still installed')
    } finally {
      picker?.destroy()
      listeners.restore()
    }
  })

  test('a throwing initial drag callback does not retain listeners', () => {
    const listeners = trackDragListeners()
    const expected = new Error('Expected callback failure')
    const errors = []
    const onError = event => {
      if (event.error === expected) {
        errors.push(event.error)
        event.preventDefault()
      }
    }
    window.addEventListener('error', onError)
    let picker
    try {
      picker = mount({ onChange() { throw expected } })
      pointer(control(picker, '.oe-color-hue'), 'pointerdown')
      assert(errors.length === 1, 'The callback exception did not reach the host')
      assert(listeners.count() === 0, 'A failed callback retained drag listeners')
    } finally {
      picker?.destroy()
      window.removeEventListener('error', onError)
      listeners.restore()
    }
  })

  test('a throwing drag move ends the active interaction', () => {
    const listeners = trackDragListeners()
    const expected = new Error('Expected move failure')
    let changed = 0
    let observed = 0
    const onError = event => {
      if (event.error === expected) {
        observed += 1
        event.preventDefault()
      }
    }
    window.addEventListener('error', onError)
    let picker
    try {
      picker = mount({ onChange() { if (++changed > 1) throw expected } })
      const hue = control(picker, '.oe-color-hue')
      pointer(hue, 'pointerdown')
      pointer(hue, 'pointermove')
      assert(observed === 1, 'The callback exception did not reach the host')
      assert(listeners.count() === 0, 'A failed move retained drag listeners')
    } finally {
      picker?.destroy()
      window.removeEventListener('error', onError)
      listeners.restore()
    }
  })

  for (const interruption of ['lostpointercapture', 'blur']) {
    test(`${interruption} ends the active drag`, () => {
      let changed = 0
      const picker = mount({ onChange: () => changed++ })
      const hue = control(picker, '.oe-color-hue')
      pointer(hue, 'pointerdown')
      if (interruption === 'blur') window.dispatchEvent(new Event('blur'))
      else pointer(hue, 'lostpointercapture')
      pointer(hue, 'pointermove')
      assert(changed === 1, 'An interrupted drag continued emitting changes')
    })
  }

  test('right mouse button cannot start a drag', () => {
    let changed = 0
    const picker = mount({ onChange: () => changed++ })
    pointer(control(picker, '.oe-color-hue'), 'pointerdown', { button: 2, buttons: 2 })
    assert(changed === 0, 'Right mouse button changed the color')
  })

  test('invalid input cannot apply a previous color through either action', () => {
    const applied = []
    const picker = mount({ onApply: value => applied.push(value) })
    const input = enter(picker, 'not a color')
    control(picker, '.oe-color-btn--apply').click()
    press(input, 'Enter')
    assert(applied.length === 0, 'Invalid input applied the previous color')
    assert(input.getAttribute('aria-invalid') === 'true', 'Invalid input was not exposed to assistive technology')
    enter(picker, '#00ff00')
    control(picker, '.oe-color-btn--apply').click()
    assert(applied.at(-1) === 'rgb(0, 255, 0)', 'Corrected input could not be applied')
    assert(input.getAttribute('aria-invalid') !== 'true', 'Corrected input remained marked invalid')
  })

  test('Enter preserves an untouched color after switching to rounded HSL display', () => {
    const applied = []
    const picker = mount({ onApply: value => applied.push(value) })
    picker.open('#123456')
    control(picker, '.oe-color-btn--apply').click()
    control(picker, '.oe-color-format').click()
    control(picker, '.oe-color-format').click()
    press(control(picker, '.oe-color-hex'), 'Enter')
    assert(applied.length === 2 && applied[0] === applied[1], 'Enter reparsed the rounded display and changed the selected color')
  })

  const cssInputs = [
    { input: '#abcd', expected: 'rgba(170, 187, 204, 0.87)' },
    { input: '#f000', expected: 'rgba(255, 0, 0, 0)', opaque: 'rgb(255, 0, 0)' },
    { input: 'rgb(18 52 86 / 25%)', expected: 'rgba(18, 52, 86, 0.25)' },
    { input: 'rgb(100% 0 50% / .4)', expected: 'rgba(255, 0, 128, 0.4)' },
    { input: 'rgba(2.55e2 +0 0 / 5e-1)', expected: 'rgba(255, 0, 0, 0.5)' },
    { input: 'rgb(18 52 86 / 0%)', expected: 'rgba(18, 52, 86, 0)', opaque: 'rgb(18, 52, 86)' },
    { input: 'hsl(.5turn 100% 50% / 25%)', expected: 'rgba(0, 255, 255, 0.25)' },
    { input: 'hsla(-120deg 100% 50% / .75)', expected: 'rgba(0, 0, 255, 0.75)' },
    { input: 'hsl(200grad 100% 50%)', expected: 'rgb(0, 255, 255)' },
    { input: 'hsl(3.141592653589793rad 100% 50%)', expected: 'rgb(0, 255, 255)' },
    { input: 'rebeccapurple', expected: 'rgb(102, 51, 153)' },
    { input: 'LightGoldenRodYellow', expected: 'rgb(250, 250, 210)' },
    { input: 'GrEy', expected: 'rgb(128, 128, 128)' },
    { input: 'transparent', expected: 'rgba(0, 0, 0, 0)', opaque: 'rgb(0, 0, 0)' },
    { input: 'oklch(50% 0 180deg / 25%)', expected: 'rgba(99, 99, 99, 0.25)' },
    { input: 'oklch(.5 0% .75turn / 0)', expected: 'rgba(99, 99, 99, 0)', opaque: 'rgb(99, 99, 99)' },
    { input: 'oklch(100% 0 0)', expected: 'rgb(255, 255, 255)' },
    { input: 'oklch(0% 0 0)', expected: 'rgb(0, 0, 0)' },
  ]

  for (const fixture of cssInputs) {
    test(`open, edit, apply and reopen preserve the normalized color for ${fixture.input}`, () => {
      const applied = []
      const changed = []
      const picker = mount({ onApply: value => applied.push(value), onChange: value => changed.push(value) })
      picker.open(fixture.input)
      const apply = control(picker, '.oe-color-btn--apply')
      const format = control(picker, '.oe-color-format')
      const input = control(picker, '.oe-color-hex')
      apply.click()
      assert(applied.at(-1) === fixture.expected, `Unexpected open result: ${applied.at(-1)}`)

      format.click()
      format.click()
      press(input, 'Enter')
      assert(applied.at(-1) === fixture.expected, 'An unchanged HSL display changed the imported color')

      picker.close()
      picker.open(applied.at(-1))
      apply.click()
      assert(applied.at(-1) === fixture.expected, 'The normalized callback value changed when reopened')

      enter(picker, fixture.input)
      assert(input.value === fixture.input, 'Typing replaced the draft text')
      assert(input.getAttribute('aria-invalid') !== 'true', 'Supported CSS input was marked invalid')
      assert(changed.at(-1) === fixture.expected, `Unexpected input result: ${changed.at(-1)}`)
      press(input, 'Enter')
      assert(applied.at(-1) === fixture.expected, 'Enter changed the accepted input')

      if (fixture.opaque) {
        press(control(picker, '.oe-color-alpha'), 'End')
        assert(changed.at(-1) === fixture.opaque, 'Zero alpha discarded the hidden RGB channels')
      }
    })
  }

  test('malformed CSS syntax and Unicode lookalikes cannot replace or apply the previous selection', () => {
    const applied = []
    const changed = []
    const picker = mount({ onApply: value => applied.push(value), onChange: value => changed.push(value) })
    const invalid = [
      'rgb(255, 0 0)', 'rgb(255 0, 0)', 'rgb(255, 0, 0 / .5)',
      'hsl(120, 100% 50%)', 'hsl(120 100%, 50% / .5)',
      'oklch(50%, .1, 30)', 'oklch(50% .1 / 30)', 'oklch(50% .1 30 // .5)',
      'red / .5', '#12345', 'blacK', 'oKlch(50% 0 0)',
    ]
    for (const value of invalid) {
      const input = enter(picker, value)
      assert(input.getAttribute('aria-invalid') === 'true', `Malformed input was accepted: ${value}`)
      control(picker, '.oe-color-btn--apply').click()
      press(input, 'Enter')
      let failure
      try { picker.open(value) } catch (error) { failure = error }
      assert(failure instanceof TypeError, `open accepted malformed input: ${value}`)
    }
    assert(applied.length === 0 && changed.length === 0, 'Malformed syntax emitted a committed color')
    picker.open('#123456')
    control(picker, '.oe-color-btn--apply').click()
    assert(applied.at(-1) === 'rgb(18, 52, 86)', 'Invalid input left the picker unusable')
  })

  test('composition Enter does not apply a color', () => {
    let applied = 0
    const picker = mount({ onApply: () => applied++ })
    press(control(picker, '.oe-color-hex'), 'Enter', { isComposing: true })
    assert(applied === 0, 'IME composition confirmation applied the color')
  })

  for (const selector of ['.oe-color-sv', '.oe-color-hue', '.oe-color-alpha', '.oe-color-format', '.oe-color-hex', '.oe-color-btn--apply', '.oe-color-btn--remove']) {
    test(`Escape closes the picker from ${selector}`, () => {
      const picker = mount()
      press(control(picker, selector), 'Escape')
      assert(picker.element.style.display === 'none', 'Escape did not close the picker')
    })
  }

  test('the color input has an accessible name', () => {
    const picker = mount()
    const input = control(picker, '.oe-color-hex')
    assert(Boolean(input.getAttribute('aria-label') || input.labels?.length), 'Color input has no accessible name')
  })

  test('closing prevents retained controls from emitting callbacks', () => {
    const actions = []
    const picker = mount({ onApply: () => actions.push('apply'), onChange: () => actions.push('change'), onRemove: () => actions.push('remove'), onFormatChange: () => actions.push('format') })
    picker.close()
    control(picker, '.oe-color-btn--apply').click()
    control(picker, '.oe-color-btn--remove').click()
    control(picker, '.oe-color-format').click()
    press(control(picker, '.oe-color-hue'), 'ArrowRight')
    enter(picker, '#00ff00')
    assert(actions.length === 0, 'Closed controls emitted callbacks')
  })

  for (const operation of ['close', 'destroy', 'open']) {
    test(`${operation} aborts EyeDropper and ignores its stale result`, async () => {
      const mock = mockEyeDropper()
      let picker
      try {
        const changed = []
        picker = mount({ onChange: value => changed.push(value) })
        control(picker, '.oe-color-btn--eyedropper').click()
        assert(mock.pending.length === 1, 'EyeDropper did not open')
        if (operation === 'open') picker.open('#0000ff')
        else picker[operation]()
        assert(mock.pending[0].signal?.aborted, 'EyeDropper was not cancelled with its AbortSignal')
        mock.pending[0].resolve({ sRGBHex: '#00ff00' })
        await settle()
        assert(changed.length === 0, 'A stale EyeDropper result emitted a change')
        if (operation === 'open') assert(control(picker, '.oe-color-hex').value === '#0000ff', 'A stale EyeDropper result replaced the reopened color')
      } finally {
        picker?.destroy()
        mock.restore()
      }
    })
  }

  test('a new EyeDropper request aborts its predecessor', async () => {
    const mock = mockEyeDropper()
    let picker
    try {
      const changed = []
      picker = mount({ onChange: value => changed.push(value) })
      const button = control(picker, '.oe-color-btn--eyedropper')
      button.click()
      button.click()
      assert(mock.pending.length === 2 && mock.pending[0].signal?.aborted, 'Previous EyeDropper request was not cancelled')
      mock.pending[0].resolve({ sRGBHex: '#ff0000' })
      mock.pending[1].resolve({ sRGBHex: '#00ff00' })
      await settle()
      assert(changed.length === 1 && changed[0] === 'rgb(0, 255, 0)', 'EyeDropper did not retain the newest result')
    } finally {
      picker?.destroy()
      mock.restore()
    }
  })

  test('cancelling EyeDropper leaves the current color usable', async () => {
    const mock = mockEyeDropper()
    let picker
    try {
      const applied = []
      picker = mount({ onApply: value => applied.push(value) })
      control(picker, '.oe-color-btn--eyedropper').click()
      mock.pending[0].reject(new DOMException('Cancelled', 'AbortError'))
      await settle()
      control(picker, '.oe-color-btn--apply').click()
      assert(applied.at(-1) === 'rgb(255, 0, 0)', 'EyeDropper cancellation broke the selected color')
    } finally {
      picker?.destroy()
      mock.restore()
    }
  })

  for (const item of cases) {
    try {
      await item.run()
      results.push({ name: item.name, status: 'pass' })
    } catch (error) {
      results.push({ name: item.name, status: 'fail', error: error?.stack || String(error) })
    } finally {
      for (const picker of pickers.splice(0)) picker.destroy()
    }
  }

  const failed = results.filter(result => result.status === 'fail')
  return { passed: results.length - failed.length, failed: failed.length, results }
}
