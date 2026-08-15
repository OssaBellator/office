import assert from 'node:assert/strict'
import test from 'node:test'
import { deserializeOfficeExportBundleReceipt, parseOfficeExportBundleReceipt, parseOfficeExportReceipt, serializeOfficeExportBundleReceipt } from '../src/officeExportReceiptCodec.ts'

function artifact(kind='xlsx',sha='a'.repeat(64)){return{schema:'frame.office-export-receipt',version:1,kind,fileName:`frame.${kind}`,mimeType:'application/test',byteLength:10,sha256:sha,generatedAt:'2026-08-15T00:00:00.000Z'}}
function bundle(){return{schema:'frame.office-export-bundle-receipt',version:1,generatedAt:'2026-08-15T00:00:00.000Z',artifacts:[artifact('docx','a'.repeat(64)),artifact('pptx','b'.repeat(64)),artifact('xlsx','c'.repeat(64))],fidelity:{exportAssessment:{},importedCellNotes:{total:0,sources:[],authors:[],tables:[]},warnings:[]}}}

test('Office export bundle receipts round-trip through runtime validation',()=>{
  const value=bundle()
  assert.deepEqual(deserializeOfficeExportBundleReceipt(serializeOfficeExportBundleReceipt(value)),value)
})

test('Office export receipt validation rejects malformed hashes lengths and duplicate kinds',()=>{
  assert.throws(()=>parseOfficeExportReceipt({...artifact(),sha256:'bad'}),/64-character/)
  assert.throws(()=>parseOfficeExportReceipt({...artifact(),byteLength:-1}),/non-negative integer/)
  assert.throws(()=>parseOfficeExportBundleReceipt({...bundle(),artifacts:[artifact('xlsx','a'.repeat(64)),artifact('xlsx','b'.repeat(64))]}),/duplicate artifact kinds/)
  assert.throws(()=>deserializeOfficeExportBundleReceipt('{bad'),/not valid JSON/)
})
