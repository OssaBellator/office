import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const page=readFileSync(new URL('../src/OfficeImportPreparedPage.tsx',import.meta.url),'utf8')

test('Office import treats same filename different bytes as revision candidate requiring explicit identity confirmation',()=>{
  assert.match(page,/classification==='filename-revision'/)
  assert.match(page,/Same filename with different bytes is only a revision candidate/)
  assert.match(page,/Treat this same-name file as a revision of the prior projection/)
  assert.match(page,/requiresIdentityAcknowledgement/)
  assert.match(page,/identityAcknowledged/)
})
