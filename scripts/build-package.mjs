import { cp, mkdir, rm } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
const dist = new URL('../dist/', import.meta.url)
const files = [
  'index.js', 'index.d.ts',
  'ColorPicker.js', 'ColorPicker.d.ts',
  'colorMath.js', 'colorMath.d.ts',
  'colorPicker.css',
]

await rm(dist, { recursive: true, force: true })
await mkdir(dist, { recursive: true })
for (const file of files) await cp(new URL(file, root), new URL(file, dist))
