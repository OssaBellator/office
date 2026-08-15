import assert from 'node:assert/strict'
import test from 'node:test'
import { createOfficeImportReceipt, sameOfficeFilename, sameOfficeSource, sha256OfficeInput } from '../src/officeImportReceipt.ts'

const encoder=new TextEncoder()
function plan(kind='xlsx'){return{kind,label:'input',importedItems:2,warnings:['one warning'],commands:[{type:'source.status',sourceId:'source:finance',status:'live'},{type:'source.status',sourceId:'source:finance',status:'stale'}]}}

test('Office import receipts are deterministic for identical bytes and record plan shape',async()=>{
  const input=encoder.encode('same Office bytes')
  const first=await createOfficeImportReceipt(input,'model.xlsx',plan(),'2026-08-15T00:00:00.000Z')
  const second=await createOfficeImportReceipt(input.slice(),'MODEL.XLSX',plan(),'2026-08-15T00:01:00.000Z')
  assert.equal(first.sha256,await sha256OfficeInput(input))
  assert.equal(first.sha256.length,64)
  assert.equal(first.sourceIdentity,`xlsx:${first.sha256}`)
  assert.equal(first.byteLength,input.byteLength)
  assert.equal(first.commandTypes['source.status'],2)
  assert.equal(first.warningCount,1)
  assert.equal(sameOfficeSource(first,second),true)
  assert.equal(sameOfficeFilename(first,second),true)
})

test('same filename with different bytes is not treated as the same cryptographic source',async()=>{
  const first=await createOfficeImportReceipt(encoder.encode('revision A'),'model.xlsx',plan())
  const second=await createOfficeImportReceipt(encoder.encode('revision B'),'model.xlsx',plan())
  assert.equal(sameOfficeFilename(first,second),true)
  assert.equal(sameOfficeSource(first,second),false)
})
