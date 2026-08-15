import assert from 'node:assert/strict'
import test from 'node:test'
import { executePreparedOfficeMigration, prepareGovernedOfficeMigration } from '../src/governedOfficeMigration.ts'
import { cloneSeedWorkspace } from '../src/model.ts'
import { createStoredZip } from '../src/officeExport.ts'
import { prepareOfficeMigrationBatch } from '../src/officeMigrationBatch.ts'
import { createVersionedWorkspaceSession, executeVersionedWorkspaceCommand } from '../src/versioning.ts'

function docx(text){return createStoredZip({'[Content_Types].xml':'<Types/>','word/document.xml':`<w:document><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`})}

test('prepared Office migration batch enters existing governance and applies semantic commands',async()=>{
  const workspace=cloneSeedWorkspace(),batch=await prepareOfficeMigrationBatch(workspace,[{name:'strategy.docx',bytes:docx('Imported strategy')}]),session=createVersionedWorkspaceSession(workspace)
  const prepared=await prepareGovernedOfficeMigration(session,batch,'owner')
  assert.equal(prepared.automation.plan.steps.length,batch.commands.length)
  const next=await executePreparedOfficeMigration(session,batch,{approvedBy:'Owner'})
  assert.equal(next.past.length>session.past.length,true)
})

test('governed Office migration refuses a stale workspace before approval',async()=>{
  const workspace=cloneSeedWorkspace(),batch=await prepareOfficeMigrationBatch(workspace,[{name:'strategy.docx',bytes:docx('Imported strategy')}])
  let session=createVersionedWorkspaceSession(workspace)
  session=executeVersionedWorkspaceCommand(session,{type:'document.update',field:'summary',value:'Changed after batch planning'})
  await assert.rejects(()=>prepareGovernedOfficeMigration(session,batch,'owner'),/batch is stale/)
})

test('governed Office migration refuses batch plans that contain failed source files',async()=>{
  const workspace=cloneSeedWorkspace(),batch=await prepareOfficeMigrationBatch(workspace,[{name:'broken.docx',bytes:new Uint8Array([1,2,3])}]),session=createVersionedWorkspaceSession(workspace)
  await assert.rejects(()=>prepareGovernedOfficeMigration(session,batch,'owner'),/contains failed source files/)
})
