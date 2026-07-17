# @shelamkoff/color-picker

Независимый от фреймворков компонент выбора цвета с необязательной поддержкой системной пипетки и чистыми функциями преобразования HEX, RGB, HSL и HSV. Версия `1.0.0` поставляется как ESM-пакет для современных браузеров.

[English README](./README.md)

## Установка

```bash
npm install @shelamkoff/color-picker
```

Один раз подключите таблицу стилей:

```js
import '@shelamkoff/color-picker/styles.css'
```

Если приложение создаёт `<link>` во время выполнения, используйте экспорт `colorPickerStylesUrl`.

## Быстрый старт

```js
import { ColorPicker } from '@shelamkoff/color-picker'
import '@shelamkoff/color-picker/styles.css'

const picker = new ColorPicker({
  onChange(color) {
    preview.style.color = color
  },
  onApply(color) {
    saveColor(color)
    picker.close()
  },
  onRemove() {
    clearColor()
  },
  showRemove: true,
})

document.body.append(picker.element)
picker.open('#3366ffcc')
```

После создания компонент скрыт. Показывайте его методом `open()`, а при уничтожении владеющего экрана вызывайте `destroy()`.

## Параметры

| Параметр | Тип | По умолчанию | Назначение |
| --- | --- | --- | --- |
| `onChange` | `(color: string) => void` | пустая функция | Получает CSS-цвет после каждого завершённого изменения элемента управления. |
| `onApply` | `(color: string) => void` | пустая функция | Получает цвет после нажатия кнопки применения. |
| `onRemove` | `() => void` | пустая функция | Вызывается после нажатия кнопки удаления цвета. |
| `onFormatChange` | `(color: string, format: ColorFormat) => void` | пустая функция | Вызывается при смене формата вывода. |
| `showRemove` | `boolean` | `true` | Показывает или скрывает действие удаления. |

## API экземпляра

| Член API | Описание |
| --- | --- |
| `element` | Корневой `HTMLElement`, принадлежащий компоненту. |
| `open(color, alpha?)` | Разбирает CSS-цвет, при необходимости заменяет прозрачность, синхронизирует элементы управления и показывает компонент. |
| `close()` | Скрывает компонент, завершает перетаскивание и аннулирует ожидающий результат системной пипетки. |
| `destroy()` | Удаляет созданный DOM и обработчики. Повторный вызов безопасен; после уничтожения `open()` выбрасывает ошибку. |

`open()` принимает поддерживаемые строки HEX, RGB(A) и HSL(A). Некорректная строка приводит к ошибке. Отдельное конечное значение прозрачности ограничивается диапазоном `0..1`.

## Функции работы с цветом

Функции доступны из корня пакета и из облегчённой точки входа `color-math`:

```js
import {
  parseColorInput,
  formatColor,
  hsvToRgb,
} from '@shelamkoff/color-picker/color-math'

const hsva = parseColorInput('hsl(220, 100%, 60%)')
if (hsva) {
  const rgb = hsvToRgb(hsva.h, hsva.s, hsva.v)
  const css = formatColor(hsva.h, hsva.s, hsva.v, hsva.a, 'RGB')
  console.log(rgb, css)
}
```

Пакет экспортирует `COLOR_FORMATS`, `ColorFormat`, `hsvToHex`, `rgbToHsv`, `hexToHsv`, `hsvToRgb`, `hsvToHsl`, `formatColor`, `roundAlpha`, `parseRgbCss` и `parseColorInput`. Функции разбора возвращают `null` для некорректных или выходящих за диапазон значений и не исправляют их молча.

## Взаимодействие и жизненный цикл

- Поля насыщенности и яркости, тона и прозрачности поддерживают указатель, сенсорный ввод и клавиатуру.
- Кнопка системной пипетки появляется только при наличии соответствующего API браузера. `close()` и `destroy()` аннулируют ожидающий результат.
- Компонент не сохраняет цвет самостоятельно. За интеграцию отвечают переданные приложением обработчики `onApply`, `onChange` и `onRemove`.
- CSS-переменные с префиксом `--oe-` позволяют переопределить резервную тему компонента.

## Демо

Из каталога пакета:

```bash
npm run demo
```

Из корня рабочего пространства выполните `npm run demo:color-picker`. Команда запускает локальный сервер и открывает страницу примера.

## Точки входа пакета

- `@shelamkoff/color-picker` — компонент, типы, URL стилей и функции работы с цветом.
- `@shelamkoff/color-picker/color-math` — функции разбора и преобразования без интерфейса.
- `@shelamkoff/color-picker/styles.css` — стили компонента.

## Лицензия

MIT.
