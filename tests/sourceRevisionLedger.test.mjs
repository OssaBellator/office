import assert from 'node:assert/strict'
import test from 'node:test'
import { appendSourceRevision, classifySourceRevision, createSourceRevisionLedger, hydrateSourceRevisionLedger, latestSourceRevision, serializeSourceRevisionLedger } from '../src/sourceRevisionLedger.ts'

function receipt(name,sha,createdAt='2026-08-15T00:00:00.000Z'){return{version:1,fileName:name,kind:'xlsx',byteLength:10,sha256:sha,sourceIdentity:`xlsx:${sha}`,importedItems:2,warningCount:0,commandTypes:{'data.imported.replace':1},createdAt}}
const A='a'.repeat(64),B='b'.repeat(64)

test('source revision ledger distinguishes duplicates revisions and new sources',()=>{
  let ledger=createSourceRevisionLedger()
  const first=receipt('model.xlsx',A)
  assert.equal(classifySourceRevision(ledger,first),'new-source')
  ledger=appendSourceRevision(ledger,first)
  assert.equal(classifySourceRevision(ledger,receipt('copy.xlsx',A)),'duplicate-content')
  assert.equal(classifySourceRevision(ledger,receipt('MODEL.XLSX',B)),'filename-revision')
  assert.equal(classifySourceRevision(ledger,receipt('other.xlsx',B)),'new-source')
})

test('source revision ledger returns latest filename revision and persists defensively',()=>{
  let ledger=createSourceRevisionLedger()
  ledger=appendSourceRevision(ledger,receipt('model.xlsx',A,'2026-08-15T00:00:00.000Z'))
  ledger=appendSourceRevision(ledger,receipt('model.xlsx',B,'2026-08-15T01:00:00.000Z'))
  assert.equal(latestSourceRevision(ledger,'MODEL.XLSX').sha256,B)
  const restored=hydrateSourceRevisionLedger(JSON.parse(serializeSourceRevisionLedger(ledger)))
  assert.deepEqual(restored,ledger)
  assert.deepEqual(hydrateSourceRevisionLedger({version:1,revisions:[{bad:true}]}),{version:1,revisions:[]})
})

test('source revision ledger caps retained history',()=>{
  let ledger=createSourceRevisionLedger()
  for(let index=0;index<5;index++)ledger=appendSourceRevision(ledger,receipt(`model-${index}.xlsx`,String(index).repeat(64).slice(0,64)),`2026-08-15T0${index}:00:00.000Z`),3)
  assert.equal(ledger.revisions.length,3)
  assert.equal(ledger.revisions[0].fileName,'model-2.xlsx')
})
