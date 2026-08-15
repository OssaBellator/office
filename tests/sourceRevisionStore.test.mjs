import assert from 'node:assert/strict'
import test from 'node:test'
import { classifyStoredSourceRevision, loadSourceRevisionLedger, recordSourceRevision, SOURCE_REVISION_STORAGE_KEY } from '../src/sourceRevisionStore.ts'

function receipt(name,sha){return{version:1,fileName:name,kind:'xlsx',byteLength:10,sha256:sha,sourceIdentity:`xlsx:${sha}`,importedItems:1,warningCount:0,commandTypes:{'data.imported.replace':1},createdAt:'2026-08-15T00:00:00.000Z'}}
function storage(){const values=new Map();return{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),values}}
const A='a'.repeat(64),B='b'.repeat(64)

test('source revision store persists receipts and classifies subsequent imports',()=>{
  const memory=storage()
  assert.equal(classifyStoredSourceRevision(receipt('model.xlsx',A),memory),'new-source')
  const first=recordSourceRevision(receipt('model.xlsx',A),memory)
  assert.equal(first.classification,'new-source')
  assert.equal(memory.values.has(SOURCE_REVISION_STORAGE_KEY),true)
  assert.equal(classifyStoredSourceRevision(receipt('MODEL.XLSX',B),memory),'filename-revision')
  assert.equal(classifyStoredSourceRevision(receipt('copy.xlsx',A),memory),'duplicate-content')
  assert.equal(loadSourceRevisionLedger(memory).revisions.length,1)
})

test('source revision store recovers from malformed storage',()=>{
  const memory=storage();memory.setItem(SOURCE_REVISION_STORAGE_KEY,'{bad json')
  assert.deepEqual(loadSourceRevisionLedger(memory),{version:1,revisions:[]})
})
