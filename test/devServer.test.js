import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { copyFile, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { request } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

async function startServer(t) {
  const fixture = await mkdtemp(join(tmpdir(), 'color-picker-server-'))
  const root = join(fixture, 'public')
  await mkdir(join(root, 'scripts'), { recursive: true })
  await copyFile(new URL('../scripts/dev-server.mjs', import.meta.url), join(root, 'scripts/dev-server.mjs'))
  await writeFile(join(root, 'demo.html'), '<h1>Color picker</h1>')
  await mkdir(join(root, '.git'))
  await writeFile(join(root, '.git/config'), 'private fixture configuration')
  await writeFile(join(fixture, 'private.txt'), 'outside fixture root')
  const child = spawn(process.execPath, [join(root, 'scripts/dev-server.mjs')], {
    env: { ...process.env, HOST: '127.0.0.1', PORT: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stderr = ''
  child.stderr.on('data', chunk => { stderr += chunk })
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit')
      child.kill('SIGTERM')
      await exited
    }
    await rm(fixture, { recursive: true, force: true })
  })
  const startup = await new Promise((resolve, reject) => {
    child.stdout.once('data', resolve)
    child.once('error', reject)
    child.once('exit', code => reject(new Error(`Server exited (${code}): ${stderr}`)))
  })
  const port = Number(String(startup).match(/127\.0\.0\.1:(\d+)/)?.[1])
  assert.ok(port > 0, `Invalid server address: ${startup}`)
  const get = (path, method = 'GET') => new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path, method, agent: false }, response => {
      let body = ''
      response.setEncoding('utf8')
      response.on('data', chunk => { body += chunk })
      response.once('end', () => resolve({ status: response.statusCode, body }))
      response.once('error', reject)
    })
    req.once('error', reject)
    req.setTimeout(5000, () => req.destroy(new Error('Demo server request timed out')))
    req.end()
  })
  return { get, root, fixture }
}

test('demo server handles missing directory indexes without stopping', async t => {
  const { get } = await startServer(t)
  assert.equal((await get('/scripts/', 'HEAD')).status, 404)
  assert.equal((await get('/scripts/')).status, 404)
  assert.equal((await get('/demo.html')).status, 200)
})

test('demo server does not expose hidden files or traversal outside its root', async t => {
  const { get } = await startServer(t)
  for (const path of ['/.git/config', '/%2egit/config', '/%2e%2e%2fprivate.txt']) {
    assert.equal((await get(path)).status, 404, path)
  }
  assert.deepEqual(await get('/demo.html'), { status: 200, body: '<h1>Color picker</h1>' })
})

test('demo server rejects symlinks to hidden files or outside its root', async t => {
  const { get, root, fixture } = await startServer(t)
  try {
    await symlink(join(fixture, 'private.txt'), join(root, 'outside.txt'))
    await symlink(join(root, '.git/config'), join(root, 'hidden.txt'))
  } catch (error) {
    if (process.platform !== 'win32' || error.code !== 'EPERM') throw error
    t.skip('Creating symlinks requires Windows Developer Mode or elevated privileges')
    return
  }
  for (const path of ['/hidden.txt', '/outside.txt']) {
    assert.equal((await get(path)).status, 404, path)
  }
})

test('demo server survives malformed request URLs and rejects unsupported methods', async t => {
  const { get } = await startServer(t)
  assert.equal((await get('http://[')).status, 404)
  assert.equal((await get('/%zz')).status, 404)
  assert.equal((await get('/demo.html', 'POST')).status, 405)
  assert.deepEqual(await get('/demo.html', 'HEAD'), { status: 200, body: '' })
  assert.equal((await get('/')).status, 200)
})
