# @shelamkoff/color-picker

Независимый от фреймворков выбор цвета и чистые функции преобразования HEX, RGB, HSL и HSV.

[English README](./README.md)

## Установка и использование

```bash
npm install @shelamkoff/color-picker
```

```js
import { ColorPicker } from '@shelamkoff/color-picker'
import '@shelamkoff/color-picker/styles.css'

const picker = new ColorPicker({
  onChange: color => console.log(color),
  onApply: color => save(color),
  onRemove: () => clearColor(),
})

document.body.appendChild(picker.element)
picker.open('#3366ffcc')
picker.destroy()
```

`colorPickerStylesUrl` содержит URL CSS для динамического подключения. Переменные с префиксом `--oe-` переопределяют резервную тему standalone-компонента.

## Работа с цветом

```js
import { parseColorInput, formatColor, hsvToRgb } from '@shelamkoff/color-picker/color-math'

const hsva = parseColorInput('hsl(220, 100%, 60%)')
const rgb = hsvToRgb(hsva.h, hsva.s, hsva.v)
const css = formatColor(hsva.h, hsva.s, hsva.v, hsva.a, 'RGB')
```

`parseColorInput()` возвращает `null` для некорректной строки. `open()` отклоняет невалидный цвет и ограничивает конечное значение alpha диапазоном `0..1`. `close()` скрывает UI, отменяет EyeDropper и активный drag. `destroy()` дополнительно удаляет DOM и обработчики. SV, hue и opacity поддерживают pointer, touch и клавиатуру.

Пакет `1.0.0` распространяется как ESM под лицензией MIT.
