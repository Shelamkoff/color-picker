import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { cp, mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const fixtures = new URL('../test/package/', import.meta.url)
const compiler = createRequire(import.meta.url).resolve('typescript/lib/tsc.js')
const temporary = await mkdtemp(join(tmpdir(), 'color-picker-package-'))
const consumer = join(temporary, 'consumer')

function runNpm(args, cwd) {
  // npm supplies its CLI path to scripts, including on Windows where .cmd files
  // cannot be executed directly without a shell.
  if (process.env.npm_execpath) {
    execFileSync(process.execPath, [process.env.npm_execpath, ...args], { cwd, stdio: 'inherit' })
    return
  }
  if (process.platform === 'win32') {
    throw new Error('Run this check with npm run test:package so the npm CLI path is available')
  }
  execFileSync('npm', args, { cwd, stdio: 'inherit' })
}

try {
  await mkdir(consumer)
  await cp(fixtures, consumer, { recursive: true })
  await writeFile(join(consumer, 'package.json'), JSON.stringify({
    name: 'color-picker-package-consumer',
    version: '1.0.0',
    private: true,
    type: 'module',
  }))

  // Pack the real distribution, including its prepack build, then install only
  // that tarball. No symlink to the source checkout participates in resolution.
  runNpm(['--prefix', root, 'pack', '--loglevel=error', '--pack-destination', temporary], root)
  const archives = (await readdir(temporary)).filter(name => name.endsWith('.tgz'))
  assert.equal(archives.length, 1, 'npm pack must produce exactly one tarball')
  runNpm([
    '--prefix', consumer, 'install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund',
    join(temporary, archives[0]),
  ], consumer)

  execFileSync(process.execPath, ['runtime.mjs'], { cwd: consumer, stdio: 'inherit' })
  for (const resolution of ['NodeNext', 'Bundler']) {
    execFileSync(process.execPath, [
      compiler, '--noEmit', '--strict', '--target', 'ES2022',
      '--module', resolution === 'NodeNext' ? 'NodeNext' : 'ESNext',
      '--moduleResolution', resolution, 'consumer.ts',
    ], { cwd: consumer, stdio: 'inherit' })
    console.log(`Package declarations (${resolution}, strict): PASS`)
  }

  execFileSync(process.execPath, [
    compiler, '--noEmit', '--strict', '--target', 'ES2022', '--lib', 'ES2022',
    '--module', 'NodeNext', '--moduleResolution', 'NodeNext', 'math-only.ts',
  ], { cwd: consumer, stdio: 'inherit' })
  console.log('Color-math declarations without DOM types: PASS')
} finally {
  await rm(temporary, { recursive: true, force: true })
}
