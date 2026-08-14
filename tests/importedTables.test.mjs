import assert from 'node:assert/strict'
import test from 'node:test'
import { deserializeWorkspaceCommand, serializeWorkspaceCommand } from '../src/commandCodec.ts'
import { getImportedTables, importedTableFromSheet } from '../src/importedTables.ts'
import { cloneSeedWorkspace } from '../src/model.ts'
import { canExecuteWorkspaceCommand } from '../src/permissions.ts'
import { revertVersionedTransaction } from '../src/revert.ts'
import { searchWorkspace } from '../src/searchIndex.ts'
import { createVersionedWorkspaceSession, executeVersionedWorkspaceCommand } from '../src/versioning.ts'

test('arbitrary spreadsheet sheets become typed imported Frame tables',()=>{
  const table=importedTableFromSheet({name:'Pipeline',rows:[['Account','ARR','Stage'],['Acme',2.4,'Qualified'],['Nova',1.1,'Proposal']]},'sales.xlsx','test')
  assert.ok(table)
  assert.deepEqual(table.columns.map((column)=>[column.label,column.type]),[['Account','text'],['ARR','number'],['Stage','text']])
  assert.equal(table.rows[0].values.arr,2.4)
})

test('imported tables are versioned searchable and conflict-aware on revert',()=>{
  const table=importedTableFromSheet({name:'Pipeline',rows:[['Account','ARR'],['Acme',2.4]]},'sales.xlsx','test')
  let session=createVersionedWorkspaceSession(cloneSeedWorkspace())
  session=executeVersionedWorkspaceCommand(session,{type:'data.imported.replace',tables:[table]})
  assert.equal(getImportedTables(session.present).length,1)
  assert.equal(searchWorkspace(session.present,'Pipeline').some((result)=>result.kind==='table'),true)
  const transaction=session.past.at(-1)
  const reverted=revertVersionedTransaction(session,transaction.id)
  assert.equal(reverted.plan.canRevert,true)
  assert.deepEqual(getImportedTables(reverted.session.present),[])
})

test('imported-table commands round-trip through runtime decoding and Data permissions',()=>{
  const table=importedTableFromSheet({name:'Pipeline',rows:[['Account','ARR'],['Acme',2.4]]},'sales.xlsx','test')
  const command={type:'data.imported.replace',tables:[table]}
  assert.deepEqual(deserializeWorkspaceCommand(serializeWorkspaceCommand(command)),command)
  assert.equal(canExecuteWorkspaceCommand('owner',command),true)
  assert.equal(canExecuteWorkspaceCommand('editor',command),true)
  assert.equal(canExecuteWorkspaceCommand('reviewer',command),false)
})
