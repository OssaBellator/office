import assert from 'node:assert/strict'
import test from 'node:test'
import { createSourceRevisionEnvelope, deserializeSourceRevisionEnvelope, parseSourceRevisionEnvelope, serializeSourceRevisionEnvelope } from '../src/sourceRevisionEnvelope.ts'

function receipt(){const sha='a'.repeat(64);return{version:1,fileName:'model.xlsx',kind:'xlsx',byteLength:10,sha256:sha,sourceIdentity:`xlsx:${sha}`,importedItems:2,warningCount:1,commandTypes:{'data.imported.replace':1},createdAt:'2026-08-15T00:00:00.000Z'}}

test('source revision envelopes round-trip validated receipt metadata',()=>{
  const envelope=createSourceRevisionEnvelope(receipt(),{workspaceId:'workspace:fy26',recordedBy:'owner@example.com',recordedAt:'2026-08-15T01:00:00.000Z'})
  assert.deepEqual(deserializeSourceRevisionEnvelope(serializeSourceRevisionEnvelope(envelope)),envelope)
})

test('source revision envelopes reject malformed schema and receipts',()=>{
  assert.throws(()=>parseSourceRevisionEnvelope({schema:'other',version:1,receipt:receipt(),recordedAt:'now'}),/Unsupported source revision envelope/)
  assert.throws(()=>parseSourceRevisionEnvelope({schema:'frame.office-source-revision',version:1,receipt:{bad:true},recordedAt:'now'}),/receipt is invalid/)
  assert.throws(()=>deserializeSourceRevisionEnvelope('{bad'),/not valid JSON/)
})
