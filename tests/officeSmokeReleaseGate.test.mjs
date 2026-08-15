import assert from 'node:assert/strict'
import test from 'node:test'
import { createOfficeSmokeValidation, smokeValidationPassesReleaseGate } from '../src/officeSmokeValidation.ts'

function validation(checks){return createOfficeSmokeValidation({artifact:{fileName:'frame.xlsx',sha256:'a'.repeat(64),kind:'xlsx'},application:'microsoft-excel',testedAt:'2026-08-15T00:00:00.000Z',outcome:'pass',repairPrompt:false,observations:[],checks})}

test('Office smoke release gate requires at least one explicit passing check',()=>{
  assert.equal(smokeValidationPassesReleaseGate(validation({})),false)
  assert.equal(smokeValidationPassesReleaseGate(validation({opens:true})),true)
  assert.equal(smokeValidationPassesReleaseGate(validation({opens:true,notes:false})),false)
})
