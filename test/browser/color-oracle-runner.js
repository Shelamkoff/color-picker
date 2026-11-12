import { runColorOracle, assertColorOracle } from './color-oracle.js'

let report
try {
  report = runColorOracle()
  assertColorOracle(report)
  document.body.dataset.status = 'pass'
  document.querySelector('#result').textContent = JSON.stringify(report, null, 2)
} catch (error) {
  document.body.dataset.status = 'fail'
  document.querySelector('#result').textContent = JSON.stringify({
    ...report,
    error: error?.stack || String(error),
  }, null, 2)
}
