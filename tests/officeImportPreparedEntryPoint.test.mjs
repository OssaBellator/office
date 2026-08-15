import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

function source(path){return readFileSync(new URL(path,import.meta.url),'utf8')}

test('Office import entry uses source-revision-aware governed import page',()=>{
  const entry=source('../src/office-import-main.tsx'),page=source('../src/OfficeImportPreparedPage.tsx')
  assert.match(entry,/OfficeImportPreparedPage/)
  assert.match(page,/prepareSecureOfficeImport/)
  assert.match(page,/loadSourceRevisionLedger/)
  assert.match(page,/recordSourceRevision/)
  assert.match(page,/planGovernedAutomation/)
  assert.match(page,/executeGovernedAutomation/)
  assert.match(page,/SourceRevisionPreview/)
})

test('Office source receipt is recorded only after governed automation succeeds',()=>{
  const page=source('../src/OfficeImportPreparedPage.tsx')
  const executeIndex=page.indexOf('executeGovernedAutomation')
  const recordIndex=page.indexOf('recordSourceRevision(prepared.receipt)')
  assert.equal(executeIndex>=0,true)
  assert.equal(recordIndex>executeIndex,true)
})
