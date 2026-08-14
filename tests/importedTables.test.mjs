import assert from 'node:assert/strict'
import test from 'node:test'
import { deserializeWorkspaceCommand, serializeWorkspaceCommand } from '../src/commandCodec.ts'
import { getImportedTableFormula, getImportedTables, importedTableCellKey, importedTableFromSheet } from '../src/importedTables.ts'
import { cloneSeedWorkspace } from '../src/model.ts'
import { canExecuteWorkspaceCommand } from '../src/permissions.ts'
import { revertVersionedTransaction } from '../src/revert.ts'
import { searchWorkspace } from '../src/searchIndex.ts'
import { compareWorkspaceStates } from '../src/workspaceCompare.ts'
import { createVersionedWorkspaceSession, executeVersionedWorkspaceCommand } from '../src/versioning.ts'

test('arbitrary spreadsheet sheets become typed imported Frame tables',()=>{
  const table=importedTableFromSheet({name:'Pipeline',rows:[['Account','ARR','Stage'],['Acme',2.4,'Qualified'],['Nova',1.1,'Proposal']]},'sales.xlsx','test')
  assert.ok(table)
  assert.deepEqual(table.columns.map((column)=>[column.label,column.type]),[['Account','text'],['ARR','number'],['Stage','text']])
  assert.equal(table.rows[0].values.arr,2.4)
})

test('imported spreadsheet formulas are retained beside cached values',()=>{
  const table=importedTableFromSheet({name:'Pipeline',rows:[['Account','ARR'],['Acme',2.4]],formulas:[[null,null],[null,'SUM(B3:B5)']]},'sales.xlsx','formula')
  assert.ok(table)
  const row=table.rows[0]
  assert.equal(row.values.arr,2.4)
  assert.equal(getImportedTableFormula(table,row.id,'arr'),'SUM(B3:B5)')
  assert.equal(table.formulaByCell[importedTableCellKey(row.id,'arr')],'SUM(B3:B5)')
})

test('imported tables are versioned searchable and conflict-aware on revert',()=>{
  const table=importedTableFromSheet({name:'Pipeline',rows:[['Account','ARR'],['Acme',2.4]],formulas:[[null,null],[null,'1.2+1.2']]},'sales.xlsx','test')
  let session=createVersionedWorkspaceSession(cloneSeedWorkspace())
  session=executeVersionedWorkspaceCommand(session,{type:'data.imported.replace',tables:[table]})
  assert.equal(getImportedTables(session.present).length,1)
  assert.equal(searchWorkspace(session.present,'Pipeline').some((result)=>result.kind==='table'),true)
  assert.equal(searchWorkspace(session.present,'1.2 1.2',{kinds:['table']})[0].id,`table:${table.id}`)
  const transaction=session.past.at(-1)
  const reverted=revertVersionedTransaction(session,transaction.id)
  assert.equal(reverted.plan.canRevert,true)
  assert.deepEqual(getImportedTables(reverted.session.present),[])
})

test('imported formula changes are semantic diffs separate from cached values',()=>{
  const table=importedTableFromSheet({name:'Pipeline',rows:[['Account','ARR'],['Acme',2.4]],formulas:[[null,null],[null,'1.2+1.2']]},'sales.xlsx','test')
  const before=executeVersionedWorkspaceCommand(createVersionedWorkspaceSession(cloneSeedWorkspace()),{type:'data.imported.replace',tables:[table]}).present
  const changed=structuredClone(table)
  changed.formulaByCell[importedTableCellKey(changed.rows[0].id,'arr')]='1.4+1.0'
  const after=executeVersionedWorkspaceCommand(createVersionedWorkspaceSession(before),{type:'data.imported.replace',tables:[changed]}).present
  const diff=compareWorkspaceStates(before,after).find((item)=>item.field==='ARR formula')
  assert.deepEqual([diff.before,diff.after],['1.2+1.2','1.4+1.0'])
})

test('imported-table commands round-trip formula metadata through runtime decoding and Data permissions',()=>{
  const table=importedTableFromSheet({name:'Pipeline',rows:[['Account','ARR'],['Acme',2.4]],formulas:[[null,null],[null,'1.2+1.2']]},'sales.xlsx','test')
  const command={type:'data.imported.replace',tables:[table]}
  assert.deepEqual(deserializeWorkspaceCommand(serializeWorkspaceCommand(command)),command)
  assert.equal(canExecuteWorkspaceCommand('owner',command),true)
  assert.equal(canExecuteWorkspaceCommand('editor',command),true)
  assert.equal(canExecuteWorkspaceCommand('reviewer',command),false)
})

test('runtime decoding rejects imported formulas that point at unknown cells',()=>{
  const table=importedTableFromSheet({name:'Pipeline',rows:[['Account','ARR'],['Acme',2.4]]},'sales.xlsx','test')
  table.formulaByCell={'missing-row\u0000arr':'A1'}
  assert.throws(()=>deserializeWorkspaceCommand(serializeWorkspaceCommand({type:'data.imported.replace',tables:[table]})),/unknown cell/)
})
