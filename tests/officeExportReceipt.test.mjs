import assert from 'node:assert/strict'
import test from 'node:test'
import { cloneSeedWorkspace } from '../src/model.ts'
import { createOfficeExportBundleReceipt, createOfficeExportReceipt, exportReceiptMatchesArtifact } from '../src/officeExportReceipt.ts'
import { exportWorkspaceXlsx } from '../src/officeExport.ts'

test('Office export receipt fingerprints exact compatibility artifact bytes',async()=>{
  const file=exportWorkspaceXlsx(cloneSeedWorkspace())
  const receipt=await createOfficeExportReceipt(file,'2026-08-15T00:00:00.000Z')
  assert.equal(receipt.kind,'xlsx')
  assert.equal(receipt.fileName,file.filename)
  assert.equal(receipt.byteLength,file.bytes.byteLength)
  assert.equal(receipt.sha256.length,64)
  assert.equal(exportReceiptMatchesArtifact(receipt,file),true)
  assert.equal(exportReceiptMatchesArtifact({...receipt,byteLength:receipt.byteLength+1},file),false)
})

test('Office export bundle receipt fingerprints DOCX PPTX XLSX and snapshots fidelity assessment',async()=>{
  const bundle=await createOfficeExportBundleReceipt(cloneSeedWorkspace(),'2026-08-15T01:00:00.000Z')
  assert.deepEqual(bundle.receipt.artifacts.map((item)=>item.kind),['docx','pptx','xlsx'])
  assert.equal(bundle.receipt.artifacts.every((item)=>item.sha256.length===64),true)
  assert.equal(bundle.receipt.generatedAt,'2026-08-15T01:00:00.000Z')
  assert.ok(bundle.receipt.fidelity.exportAssessment)
})
