import assert from 'node:assert/strict'
import test from 'node:test'
import { cloneSeedWorkspace } from '../src/model.ts'
import { createStoredZip } from '../src/officeExport.ts'
import { prepareSecureOfficeImport, sourceRevisionMessage } from '../src/officeImportPreparation.ts'
import { appendSourceRevision, createSourceRevisionLedger } from '../src/sourceRevisionLedger.ts'

function docx(text){return createStoredZip({'[Content_Types].xml':'<Types/>','word/document.xml':`<w:document><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`})}

test('prepared secure Office import classifies unseen source',async()=>{
  const prepared=await prepareSecureOfficeImport(cloneSeedWorkspace(),docx('First'),'strategy.docx',createSourceRevisionLedger(),'2026-08-15T00:00:00.000Z')
  assert.equal(prepared.classification,'new-source')
  assert.match(sourceRevisionMessage(prepared),/not been seen before/)
})

test('prepared secure Office import recognizes duplicate content despite filename change',async()=>{
  const bytes=docx('Same')
  const first=await prepareSecureOfficeImport(cloneSeedWorkspace(),bytes,'strategy.docx',createSourceRevisionLedger(),'2026-08-15T00:00:00.000Z')
  const ledger=appendSourceRevision(createSourceRevisionLedger(),first.receipt)
  const duplicate=await prepareSecureOfficeImport(cloneSeedWorkspace(),bytes,'copy.docx',ledger,'2026-08-15T01:00:00.000Z')
  assert.equal(duplicate.classification,'duplicate-content')
  assert.match(sourceRevisionMessage(duplicate),/Identical Office content/)
})

test('prepared secure Office import recognizes same-name content revision',async()=>{
  const first=await prepareSecureOfficeImport(cloneSeedWorkspace(),docx('Version one'),'strategy.docx',createSourceRevisionLedger(),'2026-08-15T00:00:00.000Z')
  const ledger=appendSourceRevision(createSourceRevisionLedger(),first.receipt)
  const revision=await prepareSecureOfficeImport(cloneSeedWorkspace(),docx('Version two'),'STRATEGY.DOCX',ledger,'2026-08-15T01:00:00.000Z')
  assert.equal(revision.classification,'filename-revision')
  assert.equal(revision.previousFilenameRevision.sha256,first.receipt.sha256)
  assert.match(sourceRevisionMessage(revision),/new revision/)
})
