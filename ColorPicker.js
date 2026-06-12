import {
  COLOR_FORMATS, hsvToHex, hexToHsv, hsvToRgb,
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
 *   onFormatChange?: (formatted: string, format: string) => void,
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
    this.#options = options
    this.#el = this.#build()
  }

  /** @returns {HTMLElement} */
  get element() {
    return this.#el
  }

  /**
   * Open the picker with a given color.
   * @param {string} hex
   * @param {number} [alpha]
   */
  open(hex, alpha = 1) {
    const hsv = hexToHsv(hex)
    this.#hue = hsv.h
    this.#sat = hsv.s
    this.#val = hsv.v
    this.#alpha = alpha
    this.#updateUI()
    this.#el.style.display = ''
  }

  close() {
    this.#el.style.display = 'none'
  }

  destroy() {
    this.#el.remove()
  }

  #build() {
    const root = ce('div', 'oe-color-dropdown')
    root.style.display = 'none'

    root.addEventListener('mousedown', (e) => {
      if (e.target === this.#colorInput) return
      e.preventDefault()
      e.stopPropagation()
    })

    // SV area
    this.#svArea = ce('div', 'oe-color-sv')
    this.#svCursor = ce('div', 'oe-color-sv__cursor')
    this.#svArea.appendChild(this.#svCursor)
    this.#svArea.addEventListener('mousedown', (e) => this.#startDrag(this.#handleSvDrag, e))

    // Hue bar
    this.#hueBar = ce('div', 'oe-color-hue')
    this.#hueCursor = ce('div', 'oe-color-hue__cursor')
    this.#hueBar.appendChild(this.#hueCursor)
    this.#hueBar.addEventListener('mousedown', (e) => this.#startDrag(this.#handleHueDrag, e))

    // Alpha bar
    this.#alphaBar = ce('div', 'oe-color-alpha')
    this.#alphaCursor = ce('div', 'oe-color-alpha__cursor')
    this.#alphaBar.appendChild(this.#alphaCursor)
    this.#alphaBar.addEventListener('mousedown', (e) => this.#startDrag(this.#handleAlphaDrag, e))

    // Bottom controls
    const bottom = ce('div', 'oe-color-bottom')

    this.#previewEl = ce('div', 'oe-color-preview')

    this.#formatBtn = ce('button', 'oe-color-format', { type: 'button' })
    this.#formatBtn.textContent = this.#colorFormat
    this.#formatBtn.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation()
      const idx = COLOR_FORMATS.indexOf(this.#colorFormat)
      this.#colorFormat = COLOR_FORMATS[(idx + 1) % COLOR_FORMATS.length] ?? 'HEX'
      this.#updateUI()
      this.#notifyFormatChange()
    })

    this.#colorInput = /** @type {HTMLInputElement} */ (document.createElement('input'))
    this.#colorInput.type = 'text'
    this.#colorInput.className = 'oe-color-hex'
    this.#colorInput.spellcheck = false
    this.#colorInput.addEventListener('keydown', (e) => {
      e.stopPropagation()
      if (e.key === 'Enter') {
        e.preventDefault()
        this.#applyFromInput()
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        this.close()
      }
    })
    this.#colorInput.addEventListener('input', () => this.#onInputChange())

    // Eyedropper
    const eyedropperBtn = ce('button', 'oe-color-btn oe-color-btn--eyedropper', { type: 'button' })
    eyedropperBtn.innerHTML = ICON_EYEDROPPER
    // @ts-ignore — EyeDropper Web API
    if (typeof window.EyeDropper === 'undefined') eyedropperBtn.style.display = 'none'
    eyedropperBtn.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation()
      // @ts-ignore
      if (typeof window.EyeDropper === 'undefined') return
      // @ts-ignore
      const dropper = new window.EyeDropper()
      dropper.open().then((/** @type {{ sRGBHex: string }} */ result) => {
        const hsv = hexToHsv(result.sRGBHex)
        this.#hue = hsv.h; this.#sat = hsv.s; this.#val = hsv.v; this.#alpha = 1
        this.#updateUI()
        this.#options.onChange?.(this.#toCss())
      }).catch(() => {})
    })

    // Apply
    const applyBtn = ce('button', 'oe-color-btn oe-color-btn--apply', { type: 'button' })
    applyBtn.innerHTML = ICON_CHECK
    applyBtn.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation()
      this.#options.onApply?.(this.#toCss())
    })

    // Remove
    if (this.#options.showRemove !== false) {
      const removeBtn = ce('button', 'oe-color-btn oe-color-btn--remove', { type: 'button' })
      removeBtn.innerHTML = ICON_REMOVE
      removeBtn.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation()
        this.#options.onRemove?.()
      })
      bottom.append(this.#previewEl, this.#formatBtn, this.#colorInput, eyedropperBtn, applyBtn, removeBtn)
    } else {
      bottom.append(this.#previewEl, this.#formatBtn, this.#colorInput, eyedropperBtn, applyBtn)
    }

    root.append(this.#svArea, this.#hueBar, this.#alphaBar, bottom)
    return root
  }

  #updateUI() {
    if (!this.#svArea || !this.#svCursor || !this.#hueCursor || !this.#alphaCursor || !this.#alphaBar || !this.#previewEl || !this.#colorInput || !this.#formatBtn) return

    this.#svArea.style.backgroundColor = `hsl(${this.#hue}, 100%, 50%)`
    this.#svCursor.style.left = `${this.#sat * 100}%`
    this.#svCursor.style.top = `${(1 - this.#val) * 100}%`
    this.#hueCursor.style.left = `${(this.#hue / 360) * 100}%`
    this.#alphaCursor.style.left = `${this.#alpha * 100}%`

    const { r, g, b } = hsvToRgb(this.#hue, this.#sat, this.#val)
    const rgbStr = `${r}, ${g}, ${b}`
    this.#alphaBar.style.background =
      `linear-gradient(to right, rgba(${rgbStr}, 0), rgb(${rgbStr})), var(--oe-checker)`

    this.#svCursor.style.borderColor = (this.#val > 0.6 && this.#sat < 0.4) ? '#333' : '#fff'
    this.#previewEl.style.backgroundColor = `rgba(${rgbStr}, ${this.#alpha})`
    this.#colorInput.value = formatColor(this.#hue, this.#sat, this.#val, this.#alpha, this.#colorFormat)
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
    if (!this.#colorInput) return
    const parsed = parseColorInput(this.#colorInput.value)
    if (parsed) {
      this.#hue = parsed.h; this.#sat = parsed.s; this.#val = parsed.v; this.#alpha = parsed.a
      this.#options.onApply?.(this.#toCss())
    }
  }

  #onInputChange() {
    if (!this.#colorInput || !this.#svArea || !this.#svCursor || !this.#hueCursor || !this.#alphaCursor || !this.#alphaBar || !this.#previewEl) return
    const parsed = parseColorInput(this.#colorInput.value)
    if (parsed) {
      this.#hue = parsed.h; this.#sat = parsed.s; this.#val = parsed.v; this.#alpha = parsed.a
      this.#svArea.style.backgroundColor = `hsl(${this.#hue}, 100%, 50%)`
      this.#svCursor.style.left = `${this.#sat * 100}%`
      this.#svCursor.style.top = `${(1 - this.#val) * 100}%`
      this.#hueCursor.style.left = `${(this.#hue / 360) * 100}%`
      this.#alphaCursor.style.left = `${this.#alpha * 100}%`
      const { r, g, b } = hsvToRgb(this.#hue, this.#sat, this.#val)
      this.#svCursor.style.borderColor = (this.#val > 0.6 && this.#sat < 0.4) ? '#333' : '#fff'
      this.#previewEl.style.backgroundColor = `rgba(${r}, ${g}, ${b}, ${this.#alpha})`
      const rgbStr = `${r}, ${g}, ${b}`
      this.#alphaBar.style.background =
        `linear-gradient(to right, rgba(${rgbStr}, 0), rgb(${rgbStr})), var(--oe-checker)`
      this.#options.onChange?.(this.#toCss())
    }
  }

  /** @type {(e: MouseEvent) => void} */
  #handleSvDrag = (e) => {
    if (!this.#svArea) return
    const rect = this.#svArea.getBoundingClientRect()
    this.#sat = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    this.#val = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height))
    this.#updateUI()
    this.#options.onChange?.(this.#toCss())
  }

  /** @type {(e: MouseEvent) => void} */
  #handleHueDrag = (e) => {
    if (!this.#hueBar) return
    const rect = this.#hueBar.getBoundingClientRect()
    this.#hue = Math.max(0, Math.min(360, (e.clientX - rect.left) / rect.width * 360))
    this.#updateUI()
    this.#options.onChange?.(this.#toCss())
  }

  /** @type {(e: MouseEvent) => void} */
  #handleAlphaDrag = (e) => {
    if (!this.#alphaBar) return
    const rect = this.#alphaBar.getBoundingClientRect()
    this.#alpha = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    this.#updateUI()
    this.#options.onChange?.(this.#toCss())
  }

  /**
   * @param {(e: MouseEvent) => void} handler
   * @param {MouseEvent} e
   */
  #startDrag(handler, e) {
    e.preventDefault()
    e.stopPropagation()
    handler(e)
    const onMove = (/** @type {MouseEvent} */ ev) => { ev.preventDefault(); handler(ev) }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }
}
