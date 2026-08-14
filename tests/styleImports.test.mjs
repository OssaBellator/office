import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const repoRoot = fileURLToPath(new URL('../', import.meta.url))
const srcRoot = join(repoRoot, 'src')

function sourceFiles(directory) {
  const files = []
  for (const entry of readdirSync(directory, { withFileTypes:true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...sourceFiles(path))
    else if (/\.(?:ts|tsx)$/.test(entry.name)) files.push(path)
  }
  return files
}

test('side-effect CSS imports resolve and have an ambient TypeScript declaration', () => {
  const missing = []
  const importPattern = /import\s+['"]([^'"]+\.css)['"]/g
  for (const sourcePath of sourceFiles(srcRoot)) {
    const source = readFileSync(sourcePath, 'utf8')
    for (const match of source.matchAll(importPattern)) {
      const target = resolve(dirname(sourcePath), match[1])
      if (!existsSync(target)) missing.push(`${sourcePath.slice(repoRoot.length)} -> ${match[1]}`)
    }
  }
  assert.deepEqual(missing, [], `Missing CSS side-effect imports: ${missing.join(', ')}`)

  const declarationsPath = join(srcRoot, 'vite-env.d.ts')
  assert.equal(existsSync(declarationsPath), true, 'src/vite-env.d.ts must exist for Vite asset declarations')
  assert.match(readFileSync(declarationsPath, 'utf8'), /declare module ['"]\*\.css['"]|reference types=['"]vite\/client['"]/, 'CSS imports need Vite or explicit *.css declarations')
})
