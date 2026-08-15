import assert from 'node:assert/strict'
import test from 'node:test'
import { cloneSeedWorkspace } from '../src/model.ts'
import { createStoredZip } from '../src/officeExport.ts'
import { migrationBatchMatchesWorkspace, prepareOfficeMigrationBatch } from '../src/officeMigrationBatch.ts'

function docx(text){return createStoredZip({'[Content_Types].xml':'<Types/>','word/document.xml':`<w:document><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`})}

test('Office migration batch binds sequential commands to base/projected workspace fingerprints',async()=>{
  const workspace=cloneSeedWorkspace(),batch=await prepareOfficeMigrationBatch(workspace,[{name:'a.docx',bytes:docx('A')},{name:'b.docx',bytes:docx('B')}],{createdAt:'2026-08-15T00:00:00.000Z'})
  assert.equal(batch.schema,'frame.office-migration-batch')
  assert.equal(batch.files.every((file)=>file.status==='planned'),true)
  assert.equal(batch.commands.length>=2,true)
  assert.equal(batch.baseWorkspaceSha256.length,64)
  assert.equal(batch.projectedWorkspaceSha256.length,64)
  assert.notEqual(batch.baseWorkspaceSha256,batch.projectedWorkspaceSha256)
  assert.equal(await migrationBatchMatchesWorkspace(batch,workspace),true)
  const changed=cloneSeedWorkspace();changed.document.title='Changed elsewhere'
  assert.equal(await migrationBatchMatchesWorkspace(batch,changed),false)
})

test('Office migration batch skips exact duplicates and records command ranges for planned files',async()=>{
  const bytes=docx('Same'),batch=await prepareOfficeMigrationBatch(cloneSeedWorkspace(),[{name:'one.docx',bytes},{name:'copy.docx',bytes:bytes.slice()}])
  assert.equal(batch.files[0].status,'planned')
  assert.equal(batch.files[0].commandStart,0)
  assert.equal(batch.files[0].commandCount>0,true)
  assert.equal(batch.files[1].status,'duplicate-skipped')
  assert.equal(batch.files[1].classification,'duplicate-content')
  assert.equal(batch.ledger.revisions.length,2)
})
