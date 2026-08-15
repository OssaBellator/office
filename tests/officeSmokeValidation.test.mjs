import assert from 'node:assert/strict'
import test from 'node:test'
import { createOfficeSmokeValidation, deserializeOfficeSmokeValidation, parseOfficeSmokeValidation, serializeOfficeSmokeValidation, smokeValidationPassesReleaseGate } from '../src/officeSmokeValidation.ts'

function validation(overrides={}){return createOfficeSmokeValidation({artifact:{fileName:'frame-model.xlsx',sha256:'a'.repeat(64),kind:'xlsx'},application:'microsoft-excel',applicationVersion:'Microsoft 365',platform:'Windows 11',testedAt:'2026-08-15T00:00:00.000Z',testedBy:'QA',outcome:'pass',repairPrompt:false,observations:[],checks:{opens:true,notes:true,hyperlinks:true},...overrides})}

test('Office smoke validation records round-trip and satisfy release gate when all checks pass',()=>{
  const value=validation()
  assert.deepEqual(deserializeOfficeSmokeValidation(serializeOfficeSmokeValidation(value)),value)
  assert.equal(smokeValidationPassesReleaseGate(value),true)
})

test('repair prompts and failed checks block Office compatibility release gate',()=>{
  assert.equal(smokeValidationPassesReleaseGate(validation({outcome:'repair-required',repairPrompt:true})),false)
  assert.equal(smokeValidationPassesReleaseGate(validation({checks:{opens:true,notes:false}})),false)
})

test('Office smoke validation parser rejects malformed artifacts and application values',()=>{
  const raw=validation()
  assert.throws(()=>parseOfficeSmokeValidation({...raw,artifact:{...raw.artifact,sha256:'bad'}}),/SHA-256/)
  assert.throws(()=>parseOfficeSmokeValidation({...raw,application:'random-editor'}),/Unsupported Office smoke application/)
  assert.throws(()=>deserializeOfficeSmokeValidation('{bad'),/not valid JSON/)
})
