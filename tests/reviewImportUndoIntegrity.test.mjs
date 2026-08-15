import assert from 'node:assert/strict'
import test from 'node:test'
import { withImportedTables } from '../src/importedTables.ts'
import { cloneSeedWorkspace } from '../src/model.ts'
import { synchronizeOfficeImportPlan } from '../src/officeImportSync.ts'
import { planPromoteSourceReview } from '../src/reviewPromotion.ts'
import { createVersionedWorkspaceSession, executeVersionedWorkspaceCommand, undoVersionedWorkspaceSession } from '../src/versioning.ts'
import { listWorkspaceReviewInbox } from '../src/workspaceReviewInbox.ts'
import { getWorkspaceReviews } from '../src/workspaceReviews.ts'

function oldTable(){return{id:'table:old',label:'Pipeline',source:'pipeline.xlsx',importedAt:'earlier',columns:[{id:'arr',label:'ARR',type:'number'}],rows:[{id:'row:old',values:{arr:2.4}}],commentByCell:{'row:old\u0000arr':{text:'Validate renewal',author:'Alice',sourceRef:'B2'}}}}
function freshTable(){return{id:'table:new',label:'Pipeline',source:'pipeline.xlsx',importedAt:'now',columns:[{id:'arr',label:'ARR',type:'number'}],rows:[{id:'row:new',values:{arr:2.4}}],commentByCell:{'row:new\u0000arr':{text:'Validate renewal',author:'Alice',sourceRef:'B3'}}}}
function sourceTableExists(workspace,review){return workspace.importedTables.some((table)=>table.id===review.sourceReview?.tableId)}

test('stepwise undo of source refresh never leaves native review pointing at removed Data',()=>{
  let workspace=withImportedTables(cloneSeedWorkspace(),[oldTable()])
  const source=listWorkspaceReviewInbox(workspace).find((item)=>item.origin==='imported-excel')
  let session=createVersionedWorkspaceSession(workspace)
  session=executeVersionedWorkspaceCommand(session,planPromoteSourceReview(session.present,source.id).command)
  const promoted=session.present
  const synced=synchronizeOfficeImportPlan(promoted,{kind:'xlsx',label:'pipeline.xlsx',importedItems:1,warnings:[],commands:[{type:'data.imported.replace',tables:[oldTable(),freshTable()]}]},'pipeline.xlsx')
  const data=synced.commands.find((command)=>command.type==='data.imported.replace'),review=synced.commands.find((command)=>command.type==='review.workspace.replace')
  assert.ok(data);assert.ok(review)

  session=executeVersionedWorkspaceCommand(session,data)
  assert.equal(sourceTableExists(session.present,getWorkspaceReviews(session.present)[0]),true)
  session=executeVersionedWorkspaceCommand(session,review)
  assert.equal(getWorkspaceReviews(session.present)[0].sourceReview.tableId,'table:new')
  assert.equal(sourceTableExists(session.present,getWorkspaceReviews(session.present)[0]),true)

  session=undoVersionedWorkspaceSession(session)
  assert.equal(getWorkspaceReviews(session.present)[0].sourceReview.tableId,'table:old')
  assert.equal(session.present.importedTables.find((table)=>table.id==='table:old').label,'Pipeline · review archive')
  assert.equal(sourceTableExists(session.present,getWorkspaceReviews(session.present)[0]),true)

  session=undoVersionedWorkspaceSession(session)
  assert.equal(session.present.importedTables.length,1)
  assert.equal(session.present.importedTables[0].id,'table:old')
  assert.equal(session.present.importedTables[0].label,'Pipeline')
  assert.equal(sourceTableExists(session.present,getWorkspaceReviews(session.present)[0]),true)
})
