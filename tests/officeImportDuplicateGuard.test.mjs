import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const page=readFileSync(new URL('../src/OfficeImportPreparedPage.tsx',import.meta.url),'utf8')

test('source-revision-aware Office import locks duplicate semantic review until explicit acknowledgement',()=>{
  assert.match(page,/classification==='duplicate-content'/)
  assert.match(page,/allowDuplicate/)
  assert.match(page,/I intend to apply byte-identical content again/)
  assert.match(page,/disabled=\{duplicate&&!allowDuplicate\}/)
  assert.match(page,/Acknowledge the duplicate projection before opening the semantic Apply preview/)
})
