import assert from 'node:assert/strict'
import test from 'node:test'
import { cloneSeedWorkspace } from '../src/model.ts'
import { createStoredZip } from '../src/officeExport.ts'
import { planSecureOfficeImportBundle } from '../src/officeImportBundle.ts'

function docx(){return createStoredZip({'[Content_Types].xml':'<Types/>','word/document.xml':'<w:document><w:body><w:p><w:r><w:t>Imported strategy</w:t></w:r></w:p></w:body></w:document>'})}

test('secure Office import bundle returns semantic plan and immutable source receipt',async()=>{
  const bytes=docx(),bundle=await planSecureOfficeImportBundle(cloneSeedWorkspace(),bytes,'strategy.docx','2026-08-15T00:00:00.000Z')
  assert.equal(bundle.plan.kind,'docx')
  assert.equal(bundle.plan.commands.some((command)=>command.type==='document.block.insert'),true)
  assert.equal(bundle.receipt.kind,'docx')
  assert.equal(bundle.receipt.fileName,'strategy.docx')
  assert.equal(bundle.receipt.byteLength,bytes.byteLength)
  assert.equal(bundle.receipt.sha256.length,64)
  assert.equal(bundle.receipt.createdAt,'2026-08-15T00:00:00.000Z')
})
