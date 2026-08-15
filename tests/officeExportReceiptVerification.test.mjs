import assert from 'node:assert/strict'
import test from 'node:test'
import { cloneSeedWorkspace } from '../src/model.ts'
import { createOfficeExportReceipt } from '../src/officeExportReceipt.ts'
import { verifyOfficeExportReceipt } from '../src/officeExportReceiptVerification.ts'
import { exportWorkspaceXlsx } from '../src/officeExport.ts'

test('Office export receipt verification recomputes exact artifact SHA',async()=>{
  const file=exportWorkspaceXlsx(cloneSeedWorkspace()),receipt=await createOfficeExportReceipt(file)
  const verification=await verifyOfficeExportReceipt(receipt,file)
  assert.equal(verification.matches,true)
  assert.equal(verification.metadataMatches,true)
  assert.equal(verification.hashMatches,true)
})

test('Office export receipt verification catches byte changes even when metadata is reused',async()=>{
  const file=exportWorkspaceXlsx(cloneSeedWorkspace()),receipt=await createOfficeExportReceipt(file),tampered={...file,bytes:file.bytes.slice()}
  tampered.bytes[tampered.bytes.length-1]^=1
  const verification=await verifyOfficeExportReceipt(receipt,tampered)
  assert.equal(verification.metadataMatches,true)
  assert.equal(verification.hashMatches,false)
  assert.equal(verification.matches,false)
})
