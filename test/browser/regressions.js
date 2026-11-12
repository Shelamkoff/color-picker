import { ColorPicker } from '../../index.js'
import { runColorPickerRegressions } from './regression-suite.js'

const result = await runColorPickerRegressions(ColorPicker)
document.body.dataset.status = result.failed ? 'fail' : 'pass'
document.querySelector('#result').textContent = JSON.stringify(result, null, 2)
