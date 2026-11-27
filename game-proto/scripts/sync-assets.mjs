// A játék által használt GLB fájlokat átmásolja a ../assets mappából a public/ mappába.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, '..', 'assets')
const dst = join(root, 'public')
const files = ['factory.glb', 'truck.glb']

mkdirSync(dst, { recursive: true })
for (const f of files) {
  const from = join(src, f)
  if (existsSync(from)) {
    copyFileSync(from, join(dst, f))
    console.log(`asset: ${f}`)
  } else if (existsSync(join(dst, f))) {
    console.log(`asset: ${f} (nincs a ../assets-ben, a meglévő public/ példány marad)`)
  } else {
    console.error(`HIÁNYZIK: ${f}`)
    process.exitCode = 1
  }
}
