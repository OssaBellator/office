import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const srcRoot = fileURLToPath(new URL('../src/', import.meta.url))

function collectTypeScriptFiles(directory) {
  const files = []
  for (const entry of readdirSync(directory, { withFileTypes:true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== 'components') files.push(...collectTypeScriptFiles(path))
      continue
    }
    if (entry.isFile() && entry.name.endsWith('.ts')) files.push(path)
  }
  return files
}

test('runtime TypeScript avoids constructor parameter-properties unsupported by Node strip-only mode', () => {
  const offenders = []
  const parameterProperty = /constructor\s*\([^)]*\b(?:private|protected|public|readonly)\s+[A-Za-z_$][\w$]*\s*(?::|[=,)])/s
  for (const path of collectTypeScriptFiles(srcRoot)) {
    const source = readFileSync(path, 'utf8')
    if (parameterProperty.test(source)) offenders.push(path.slice(srcRoot.length))
  }
  assert.deepEqual(offenders, [], `Node strip-only mode cannot erase constructor parameter-properties: ${offenders.join(', ')}`)
})
