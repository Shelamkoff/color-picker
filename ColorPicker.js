import {
  COLOR_FORMATS, hsvToRgb,
  formatColor, roundAlpha, parseColorInput,
} from './colorMath.js'

const ICON_EYEDROPPER = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 7l6 6"/><path d="M4 16l11.7 -11.7a1 1 0 0 1 1.4 0l2.6 2.6a1 1 0 0 1 0 1.4l-11.7 11.7h-4v-4z"/></svg>'
const ICON_CHECK = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5l10 -10"/></svg>'
const ICON_REMOVE = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6l-12 12"/><path d="M6 6l12 12"/></svg>'

/**
 * @param {string} tag
 * @param {string} [className]
 * @param {Record<string, string>} [attrs]
 * @returns {HTMLElement}
 */
function ce(tag, className, attrs) {
  const el = document.createElement(tag)
  if (className) el.className = className
  if (attrs) for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  return el
}

/**
 * @typedef {{
 *   onApply?: (cssColor: string) => void,
 *   onRemove?: () => void,
 *   onChange?: (cssColor: string) => void,
 *   onFormatChange?: (formatted: string, format: import('./colorMath.js').ColorFormat) => void,
 *   showRemove?: boolean,
 * }} ColorPickerOptions
 */

/**
 * Reusable color picker UI component.
 * Renders SV area, hue bar, alpha bar, format toggle, hex input, eyedropper, apply/remove buttons.
 */
export class ColorPicker {
  /** @type {HTMLElement} */
  #el

  /** @type {ColorPickerOptions} */
  #options

  // HSVA state
  #hue = 0
  #sat = 0
  #val = 1
  #alpha = 1
  #colorFormat = 'HEX'
  #destroyed = false
  #isOpen = false
  #inputDirty = false
  /** @type {(() => void) | null} */
  #stopDrag = null
  #asyncVersion = 0
  /** @type {AbortController | null} */
  #eyeDropperController = null
  #listenerController = new AbortController()

  // DOM refs
  /** @type {HTMLElement | null} */ #svArea = null
  /** @type {HTMLElement | null} */ #svCursor = null
  /** @type {HTMLElement | null} */ #hueBar = null
  /** @type {HTMLElement | null} */ #hueCursor = null
  /** @type {HTMLElement | null} */ #alphaBar = null
  /** @type {HTMLElement | null} */ #alphaCursor = null
  /** @type {HTMLInputElement | null} */ #colorInput = null
  /** @type {HTMLElement | null} */ #formatBtn = null
  /** @type {HTMLElement | null} */ #previewEl = null

  /** @param {ColorPickerOptions} [options] */
  constructor(options = {}) {
    if (!options || typeof options !== 'object' || Array.isArray(options)) {
      throw new TypeError('ColorPicker options must be an object')
    }
    for (const callback of ['onApply', 'onRemove', 'onChange', 'onFormatChange']) {
      if (options[callback] !== undefined && typeof options[callback] !== 'function') {
        throw new TypeError(`ColorPicker ${callback} must be a function`)
      }
    }
    if (options.showRemove !== undefined && typeof options.showRemove !== 'boolean') {
      throw new TypeError('ColorPicker showRemove must be a boolean')
    }
    this.#options = { ...options }
    this.#el = this.#build()
  }

  /** @returns {HTMLElement} */
  get element() {
    return this.#el
  }

  /**
   * Open the picker with a given color.
   * @param {string} hex Any supported CSS color value.
   * @param {number} [alpha]
   */
  open(hex, alpha) {
    if (this.#destroyed) throw new Error('Cannot open a destroyed ColorPicker')
    const parsed = parseColorInput(hex)
    if (!parsed) throw new TypeError(`Invalid color: ${hex}`)
    const resolvedAlpha = alpha ?? parsed.a
    if (!Number.isFinite(resolvedAlpha)) throw new RangeError('Color alpha must be a finite number')
    this.#stopInteractions()
    this.#hue = parsed.h
    this.#sat = parsed.s
    this.#val = parsed.v
    this.#alpha = Math.max(0, Math.min(1, resolvedAlpha))
    this.#isOpen = true
    this.#updateUI()
    this.#el.style.display = ''
  }

  close() {
    this.#isOpen = false
    this.#stopInteractions()
    this.#el.style.display = 'none'
  }

  destroy() {
    if (this.#destroyed) return
    this.#destroyed = true
    this.#isOpen = false
    this.#stopInteractions()
    this.#listenerController.abort()
    this.#options = {}
    this.#el.remove()
  }

  #stopInteractions() {
    this.#asyncVersion += 1
    this.#eyeDropperController?.abort()
    this.#eyeDropperController = null
    this.#stopDrag?.()
    this.#stopDrag = null
  }

  #build() {
    const root = ce('div', 'oe-color-dropdown')
    root.style.display = 'none'
    root.setAttribute('role', 'dialog')
    root.setAttribute('aria-label', 'Color picker')

    root.addEventListener('mousedown', (e) => {
      if (e.target === this.#colorInput) return
      e.preventDefault()
      e.stopPropagation()
    }, { signal: this.#listenerController.signal })
    root.addEventListener('keydown', (e) => {
      if (!this.#isOpen || e.key !== 'Escape' || e.isComposing) return
      e.preventDefault()
      e.stopPropagation()
      this.close()
    }, { signal: this.#listenerController.signal })

    // SV area
    this.#svArea = ce('div', 'oe-color-sv', {
      role: 'slider', tabindex: '0', 'aria-label': 'Saturation and brightness',
      'aria-valuemin': '0', 'aria-valuemax': '100',
    })
    this.#svCursor = ce('div', 'oe-color-sv__cursor')
    this.#svArea.appendChild(this.#svCursor)
    this.#svArea.addEventListener('pointerdown', (e) => this.#startDrag(this.#handleSvDrag, e), { signal: this.#listenerController.signal })
    this.#svArea.addEventListener('keydown', (e) => this.#handleSvKeydown(e), { signal: this.#listenerController.signal })

    // Hue bar
    this.#hueBar = ce('div', 'oe-color-hue', {
      role: 'slider', tabindex: '0', 'aria-label': 'Hue',
      'aria-valuemin': '0', 'aria-valuemax': '360',
    })
    this.#hueCursor = ce('div', 'oe-color-hue__cursor')
    this.#hueBar.appendChild(this.#hueCursor)
    this.#hueBar.addEventListener('pointerdown', (e) => this.#startDrag(this.#handleHueDrag, e), { signal: this.#listenerController.signal })
    this.#hueBar.addEventListener('keydown', (e) => this.#handleHueKeydown(e), { signal: this.#listenerController.signal })

    // Alpha bar
    this.#alphaBar = ce('div', 'oe-color-alpha', {
      role: 'slider', tabindex: '0', 'aria-label': 'Opacity',
      'aria-valuemin': '0', 'aria-valuemax': '100',
    })
    this.#alphaCursor = ce('div', 'oe-color-alpha__cursor')
    this.#alphaBar.appendChild(this.#alphaCursor)
    this.#alphaBar.addEventListener('pointerdown', (e) => this.#startDrag(this.#handleAlphaDrag, e), { signal: this.#listenerController.signal })
    this.#alphaBar.addEventListener('keydown', (e) => this.#handleAlphaKeydown(e), { signal: this.#listenerController.signal })

    // Bottom controls
    const bottom = ce('div', 'oe-color-bottom')

    this.#previewEl = ce('div', 'oe-color-preview')

    this.#formatBtn = ce('button', 'oe-color-format', { type: 'button' })
    this.#formatBtn.setAttribute('aria-label', 'Change color format')
    this.#formatBtn.textContent = this.#colorFormat
    this.#formatBtn.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation()
      if (!this.#isOpen) return
      const idx = COLOR_FORMATS.indexOf(this.#colorFormat)
      this.#colorFormat = COLOR_FORMATS[(idx + 1) % COLOR_FORMATS.length] ?? 'HEX'
      this.#updateUI()
      this.#notifyFormatChange()
    }, { signal: this.#listenerController.signal })

    this.#colorInput = /** @type {HTMLInputElement} */ (document.createElement('input'))
    this.#colorInput.type = 'text'
    this.#colorInput.className = 'oe-color-hex'
    this.#colorInput.spellcheck = false
    this.#colorInput.setAttribute('aria-label', 'Color value')
    this.#colorInput.addEventListener('keydown', (e) => {
      e.stopPropagation()
      if (!this.#isOpen || e.isComposing) return
      if (e.key === 'Enter') {
        e.preventDefault()
        this.#applyFromInput()
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        this.close()
      }
    }, { signal: this.#listenerController.signal })
    this.#colorInput.addEventListener('input', () => this.#onInputChange(), { signal: this.#listenerController.signal })

    // Eyedropper
    const eyedropperBtn = ce('button', 'oe-color-btn oe-color-btn--eyedropper', { type: 'button' })
    eyedropperBtn.setAttribute('aria-label', 'Pick color from screen')
    eyedropperBtn.innerHTML = ICON_EYEDROPPER
    // @ts-ignore — EyeDropper Web API
    if (typeof window.EyeDropper !== 'function') eyedropperBtn.style.display = 'none'
    eyedropperBtn.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation()
      void this.#pickFromScreen()
    }, { signal: this.#listenerController.signal })

    // Apply
    const applyBtn = ce('button', 'oe-color-btn oe-color-btn--apply', { type: 'button' })
    applyBtn.setAttribute('aria-label', 'Apply color')
    applyBtn.innerHTML = ICON_CHECK
    applyBtn.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation()
      this.#applyFromInput()
    }, { signal: this.#listenerController.signal })

    // Remove
    if (this.#options.showRemove !== false) {
      const removeBtn = ce('button', 'oe-color-btn oe-color-btn--remove', { type: 'button' })
      removeBtn.setAttribute('aria-label', 'Remove color')
      removeBtn.innerHTML = ICON_REMOVE
      removeBtn.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation()
        if (!this.#isOpen) return
        this.#options.onRemove?.()
      }, { signal: this.#listenerController.signal })
      bottom.append(this.#previewEl, this.#formatBtn, this.#colorInput, eyedropperBtn, applyBtn, removeBtn)
    } else {
      bottom.append(this.#previewEl, this.#formatBtn, this.#colorInput, eyedropperBtn, applyBtn)
    }

    root.append(this.#svArea, this.#hueBar, this.#alphaBar, bottom)
    return root
  }

  async #pickFromScreen() {
    // @ts-ignore — EyeDropper Web API
    if (!this.#isOpen || typeof window.EyeDropper !== 'function') return
    this.#eyeDropperController?.abort()
    const controller = new AbortController()
    this.#eyeDropperController = controller
    const asyncVersion = ++this.#asyncVersion
    let result
    try {
      // @ts-ignore — EyeDropper Web API
      const dropper = new window.EyeDropper()
      result = await dropper.open({ signal: controller.signal })
    } catch {
      return
    } finally {
      if (this.#eyeDropperController === controller) this.#eyeDropperController = null
    }
    if (!this.#isOpen || this.#destroyed || this.#asyncVersion !== asyncVersion) return
    const parsed = parseColorInput(result?.sRGBHex)
    if (!parsed) return
    this.#hue = parsed.h; this.#sat = parsed.s; this.#val = parsed.v; this.#alpha = 1
    this.#updateUI()
    this.#options.onChange?.(this.#toCss())
  }

  /** @param {boolean} [syncInput] Preserve the draft and caret while typing. */
  #updateUI(syncInput = true) {
    if (!this.#svArea || !this.#svCursor || !this.#hueCursor || !this.#alphaCursor || !this.#alphaBar || !this.#previewEl || !this.#colorInput || !this.#formatBtn) return

    this.#svArea.style.backgroundColor = `hsl(${this.#hue}, 100%, 50%)`
    this.#svCursor.style.left = `${this.#sat * 100}%`
    this.#svCursor.style.top = `${(1 - this.#val) * 100}%`
    this.#hueCursor.style.left = `${(this.#hue / 360) * 100}%`
    this.#alphaCursor.style.left = `${this.#alpha * 100}%`
    this.#updateSliderAria()

    const { r, g, b } = hsvToRgb(this.#hue, this.#sat, this.#val)
    const rgbStr = `${r}, ${g}, ${b}`
    this.#alphaBar.style.background =
      `linear-gradient(to right, rgba(${rgbStr}, 0), rgb(${rgbStr})), var(--oe-checker)`

    this.#svCursor.style.borderColor = (this.#val > 0.6 && this.#sat < 0.4) ? '#333' : '#fff'
    this.#previewEl.style.setProperty('--oe-preview-color', `rgba(${rgbStr}, ${this.#alpha})`)
    if (syncInput) {
      this.#colorInput.value = formatColor(this.#hue, this.#sat, this.#val, this.#alpha, this.#colorFormat)
      this.#inputDirty = false
      this.#colorInput.removeAttribute('aria-invalid')
    }
    this.#formatBtn.textContent = this.#colorFormat
  }

  #toCss() {
    const { r, g, b } = hsvToRgb(this.#hue, this.#sat, this.#val)
    return this.#alpha < 1
      ? `rgba(${r}, ${g}, ${b}, ${roundAlpha(this.#alpha)})`
      : `rgb(${r}, ${g}, ${b})`
  }

  #notifyFormatChange() {
    const formatted = formatColor(this.#hue, this.#sat, this.#val, this.#alpha, this.#colorFormat)
    this.#options.onFormatChange?.(formatted, this.#colorFormat)
  }

  #applyFromInput() {
    if (!this.#isOpen || !this.#colorInput) return
    if (this.#inputDirty) {
      const parsed = parseColorInput(this.#colorInput.value)
      if (!parsed) {
        this.#colorInput.setAttribute('aria-invalid', 'true')
        return
      }
      this.#hue = parsed.h; this.#sat = parsed.s; this.#val = parsed.v; this.#alpha = parsed.a
    }
    this.#updateUI()
    this.#options.onApply?.(this.#toCss())
  }

  #onInputChange() {
    if (!this.#isOpen || !this.#colorInput) return
    this.#inputDirty = true
    const parsed = parseColorInput(this.#colorInput.value)
    if (!parsed) {
      this.#colorInput.setAttribute('aria-invalid', 'true')
      return
    }
    this.#colorInput.removeAttribute('aria-invalid')
    this.#hue = parsed.h; this.#sat = parsed.s; this.#val = parsed.v; this.#alpha = parsed.a
    this.#updateUI(false)
    this.#options.onChange?.(this.#toCss())
  }

  #updateSliderAria() {
    this.#svArea?.setAttribute('aria-valuenow', String(Math.round(this.#sat * 100)))
    this.#svArea?.setAttribute('aria-valuetext', `Saturation ${Math.round(this.#sat * 100)}%, brightness ${Math.round(this.#val * 100)}%`)
    this.#hueBar?.setAttribute('aria-valuenow', String(Math.round(this.#hue)))
    this.#alphaBar?.setAttribute('aria-valuenow', String(Math.round(this.#alpha * 100)))
  }

  /** @type {(e: PointerEvent) => void} */
  #handleSvDrag = (e) => {
    if (!this.#svArea) return
    const rect = this.#svArea.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return
    this.#sat = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    this.#val = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height))
    this.#updateUI()
    this.#options.onChange?.(this.#toCss())
  }

  /** @type {(e: PointerEvent) => void} */
  #handleHueDrag = (e) => {
    if (!this.#hueBar) return
    const rect = this.#hueBar.getBoundingClientRect()
    if (rect.width <= 0) return
    this.#hue = Math.max(0, Math.min(360, (e.clientX - rect.left) / rect.width * 360))
    this.#updateUI()
    this.#options.onChange?.(this.#toCss())
  }

  /** @type {(e: PointerEvent) => void} */
  #handleAlphaDrag = (e) => {
    if (!this.#alphaBar) return
    const rect = this.#alphaBar.getBoundingClientRect()
    if (rect.width <= 0) return
    this.#alpha = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    this.#updateUI()
    this.#options.onChange?.(this.#toCss())
  }

  /** @param {KeyboardEvent} e */
  #handleSvKeydown = (e) => {
    if (!this.#isOpen) return
    const step = e.shiftKey ? 0.1 : 0.01
    let handled = true
    switch (e.key) {
      case 'ArrowLeft': this.#sat = Math.max(0, this.#sat - step); break
      case 'ArrowRight': this.#sat = Math.min(1, this.#sat + step); break
      case 'ArrowDown': this.#val = Math.max(0, this.#val - step); break
      case 'ArrowUp': this.#val = Math.min(1, this.#val + step); break
      case 'Home': this.#sat = 0; break
      case 'End': this.#sat = 1; break
      default: handled = false
    }
    if (handled) this.#commitKeyboardChange(e)
  }

  /** @param {KeyboardEvent} e */
  #handleHueKeydown = (e) => {
    if (!this.#isOpen) return
    const step = e.shiftKey || e.key === 'PageUp' || e.key === 'PageDown' ? 10 : 1
    let handled = true
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
      case 'PageDown': this.#hue = (this.#hue - step + 360) % 360; break
      case 'ArrowRight':
      case 'ArrowUp':
      case 'PageUp': this.#hue = (this.#hue + step) % 360; break
      case 'Home': this.#hue = 0; break
      case 'End': this.#hue = 359; break
      default: handled = false
    }
    if (handled) this.#commitKeyboardChange(e)
  }

  /** @param {KeyboardEvent} e */
  #handleAlphaKeydown = (e) => {
    if (!this.#isOpen) return
    const step = e.shiftKey || e.key === 'PageUp' || e.key === 'PageDown' ? 0.1 : 0.01
    let handled = true
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
      case 'PageDown': this.#alpha = Math.max(0, this.#alpha - step); break
      case 'ArrowRight':
      case 'ArrowUp':
      case 'PageUp': this.#alpha = Math.min(1, this.#alpha + step); break
      case 'Home': this.#alpha = 0; break
      case 'End': this.#alpha = 1; break
      default: handled = false
    }
    if (handled) this.#commitKeyboardChange(e)
  }

  /** @param {KeyboardEvent} e */
  #commitKeyboardChange(e) {
    e.preventDefault()
    e.stopPropagation()
    this.#updateUI()
    this.#options.onChange?.(this.#toCss())
  }

  /**
   * @param {(e: PointerEvent) => void} handler
   * @param {PointerEvent} e
   */
  #startDrag(handler, e) {
    if (!this.#isOpen || this.#destroyed) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    this.#stopDrag?.()
    const target = /** @type {HTMLElement} */ (e.currentTarget)
    const view = target.ownerDocument.defaultView
    const pointerId = e.pointerId
    let active = true
    const update = (/** @type {PointerEvent} */ event) => {
      try { handler(event) } catch (error) {
        stop()
        throw error
      }
    }
    const onMove = (/** @type {PointerEvent} */ ev) => {
      if (!active || ev.pointerId !== pointerId) return
      ev.preventDefault()
      update(ev)
    }
    const onUp = (/** @type {PointerEvent} */ ev) => {
      if (ev.pointerId === pointerId) stop()
    }
    const stop = () => {
      if (!active) return
      active = false
      target.removeEventListener('pointermove', onMove)
      target.removeEventListener('pointerup', onUp)
      target.removeEventListener('pointercancel', onUp)
      target.removeEventListener('lostpointercapture', onUp)
      view?.removeEventListener('blur', stop)
      if (this.#stopDrag === stop) this.#stopDrag = null
      try {
        if (target.hasPointerCapture(pointerId)) target.releasePointerCapture(pointerId)
      } catch { /* pointer capture may already have ended */ }
    }
    this.#stopDrag = stop
    target.addEventListener('pointermove', onMove)
    target.addEventListener('pointerup', onUp)
    target.addEventListener('pointercancel', onUp)
    target.addEventListener('lostpointercapture', onUp)
    view?.addEventListener('blur', stop)
    target.focus({ preventScroll: true })
    if (!active) return
    try { target.setPointerCapture(pointerId) } catch { /* synthetic or already released pointer */ }
    if (active) update(e)
  }
}
