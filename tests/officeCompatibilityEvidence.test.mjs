import assert from 'node:assert/strict'
import test from 'node:test'
import { defaultOfficeCompatibilityRequirements, evaluateOfficeCompatibilityEvidence } from '../src/officeCompatibilityEvidence.ts'
import { createOfficeSmokeValidation } from '../src/officeSmokeValidation.ts'

function artifact(kind,sha){return{schema:'frame.office-export-receipt',version:1,kind,fileName:`frame.${kind}`,mimeType:'application/test',byteLength:10,sha256:sha,generatedAt:'2026-08-15T00:00:00.000Z'}}
function bundle(){return{schema:'frame.office-export-bundle-receipt',version:1,generatedAt:'2026-08-15T00:00:00.000Z',artifacts:[artifact('docx','a'.repeat(64)),artifact('pptx','b'.repeat(64)),artifact('xlsx','c'.repeat(64))],fidelity:{exportAssessment:{},importedCellNotes:{total:0,sources:[],authors:[],tables:[]},warnings:[]}}}
function validation(kind,sha,application,outcome='pass',repairPrompt=false){return createOfficeSmokeValidation({artifact:{fileName:`frame.${kind}`,sha256:sha,kind},application,testedAt:'2026-08-15T01:00:00.000Z',outcome,repairPrompt,observations:[],checks:{opens:true}})}

test('compatibility evidence requires passing validation for each exact exported artifact hash',()=>{
  const validations=[validation('docx','a'.repeat(64),'microsoft-word'),validation('pptx','b'.repeat(64),'microsoft-powerpoint'),validation('xlsx','c'.repeat(64),'microsoft-excel')]
  const evidence=evaluateOfficeCompatibilityEvidence(bundle(),validations,defaultOfficeCompatibilityRequirements())
  assert.equal(evidence.ready,true)
  assert.equal(evidence.artifacts.every((item)=>item.ready),true)
})

test('compatibility evidence ignores validation for a different artifact hash and blocks repair prompts',()=>{
  const validations=[validation('docx','d'.repeat(64),'microsoft-word'),validation('pptx','b'.repeat(64),'microsoft-powerpoint'),validation('xlsx','c'.repeat(64),'microsoft-excel','repair-required',true)]
  const evidence=evaluateOfficeCompatibilityEvidence(bundle(),validations,defaultOfficeCompatibilityRequirements())
  assert.equal(evidence.ready,false)
  assert.deepEqual(evidence.artifacts.find((item)=>item.receipt.kind==='docx').missingApplications,['microsoft-word'])
  assert.deepEqual(evidence.artifacts.find((item)=>item.receipt.kind==='xlsx').missingApplications,['microsoft-excel'])
})
