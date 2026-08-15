import assert from 'node:assert/strict'
import test from 'node:test'
import { createOfficeSmokeValidation } from '../src/officeSmokeValidation.ts'
import { appendOfficeSmokeValidation, createOfficeSmokeLedger, deserializeOfficeSmokeLedger, serializeOfficeSmokeLedger, validationsForArtifact } from '../src/officeSmokeLedger.ts'

function validation(sha='a'.repeat(64),application='microsoft-excel',testedAt='2026-08-15T00:00:00.000Z'){return createOfficeSmokeValidation({artifact:{fileName:'frame.xlsx',sha256:sha,kind:'xlsx'},application,testedAt,outcome:'pass',repairPrompt:false,observations:[],checks:{opens:true}})}

test('smoke ledger appends validated evidence and queries exact artifact hash',()=>{
  let ledger=createOfficeSmokeLedger();ledger=appendOfficeSmokeValidation(ledger,validation())
  assert.equal(validationsForArtifact(ledger,'A'.repeat(64)).length,1)
  assert.deepEqual(deserializeOfficeSmokeLedger(serializeOfficeSmokeLedger(ledger)),ledger)
})

test('smoke ledger deduplicates identical validation identity and caps history',()=>{
  let ledger=createOfficeSmokeLedger(),first=validation();ledger=appendOfficeSmokeValidation(ledger,first);ledger=appendOfficeSmokeValidation(ledger,{...first,observations:['updated']})
  assert.equal(ledger.validations.length,1)
  assert.deepEqual(ledger.validations[0].observations,['updated'])
  ledger=appendOfficeSmokeValidation(ledger,validation('b'.repeat(64),'microsoft-excel','2026-08-15T01:00:00.000Z'),1)
  assert.equal(ledger.validations.length,1)
  assert.equal(ledger.validations[0].artifact.sha256,'b'.repeat(64))
})

test('smoke ledger hydration drops malformed entries instead of trusting them',()=>{
  const restored=deserializeOfficeSmokeLedger(JSON.stringify({schema:'frame.office-smoke-ledger',version:1,validations:[validation(),{bad:true}]}))
  assert.equal(restored.validations.length,1)
})
