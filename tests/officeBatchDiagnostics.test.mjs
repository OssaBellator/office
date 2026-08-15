import assert from 'node:assert/strict'
import test from 'node:test'
import { cloneSeedWorkspace } from '../src/model.ts'
import { diagnoseOfficeBatch } from '../src/officeBatchDiagnostics.ts'
import { createStoredZip } from '../src/officeExport.ts'

function docx(text){return createStoredZip({'[Content_Types].xml':'<Types/>','word/document.xml':`<w:document><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`})}

test('batch diagnostics plans valid files, records failures and detects duplicate content',async()=>{
  const first=docx('Strategy'),duplicate=first.slice(),invalid=new Uint8Array([1,2,3])
  const report=await diagnoseOfficeBatch(cloneSeedWorkspace(),[
    {name:'strategy.docx',bytes:first},
    {name:'copy.docx',bytes:duplicate},
    {name:'broken.docx',bytes:invalid},
  ])
  assert.equal(report.totals.files,3)
  assert.equal(report.totals.ok,2)
  assert.equal(report.totals.failed,1)
  assert.equal(report.totals.duplicates,1)
  assert.equal(report.files[0].kind,'docx')
  assert.equal(report.files[1].classification,'duplicate-content')
  assert.match(report.files[2].error,/ZIP|Office|package|DOCX/i)
  assert.equal(report.ledger.revisions.length,2)
})

test('batch diagnostics include export-review state for the current workspace',async()=>{
  const report=await diagnoseOfficeBatch(cloneSeedWorkspace(),[])
  assert.equal(report.totals.files,0)
  assert.equal(Array.isArray(report.workspaceExportReview.warnings),true)
  assert.ok(report.workspaceExportReview.exportAssessment)
})
