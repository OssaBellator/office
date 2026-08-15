import assert from 'node:assert/strict'
import test from 'node:test'
import { deserializeWorkspaceCommand, serializeWorkspaceCommand } from '../src/commandCodec.ts'
import { withImportedTables } from '../src/importedTables.ts'
import { cloneSeedWorkspace } from '../src/model.ts'
import { synchronizeOfficeImportPlan } from '../src/officeImportSync.ts'
import { planPromoteSourceReview, planWorkspaceReviewStatusUpdate } from '../src/reviewPromotion.ts'
import { createVersionedWorkspaceSession, executeVersionedWorkspaceCommand } from '../src/versioning.ts'
import { assessWorkspaceReadiness } from '../src/workspaceDiagnostics.ts'
import { listWorkspaceReviewInbox } from '../src/workspaceReviewInbox.ts'
import { getWorkspaceReviews } from '../src/workspaceReviews.ts'

function sourceTable(id='table:old',rowId='row:old:1'){
  return{id,label:'Pipeline',source:'pipeline.xlsx',importedAt:'now',columns:[{id:'arr',label:'ARR',type:'number'}],rows:[{id:rowId,values:{arr:2.4}}],commentByCell:{[`${rowId}\u0000arr`]:{text:'Validate renewal assumption',author:'Alice',sourceRef:'B2'}},threadByCell:{[`${rowId}\u0000arr`]:{comments:[{id:'thread-root',personId:'person:alice',author:'Alice',text:'Review renewal',done:false},{id:'thread-reply',personId:'person:bob',author:'Bob',text:'Checking',parentId:'thread-root'}]}}}
}
function movedSourceTable(){
  return{id:'table:new',label:'Pipeline',source:'pipeline.xlsx',importedAt:'later',columns:[{id:'arr',label:'ARR',type:'number'}],rows:[{id:'row:new:1',values:{arr:1.1}},{id:'row:new:2',values:{arr:2.4}}],commentByCell:{'row:new:2\u0000arr':{text:'Validate renewal assumption',author:'Alice',sourceRef:'B3'}},threadByCell:{'row:new:2\u0000arr':{comments:[{id:'thread-root',personId:'person:alice',author:'Alice',text:'Review renewal',done:false},{id:'thread-reply',personId:'person:bob',author:'Bob',text:'Checking',parentId:'thread-root'}]}}}
}

test('promoting a source note creates a native Frame task without mutating source provenance',()=>{
  const workspace=withImportedTables(cloneSeedWorkspace(),[sourceTable()])
  const source=listWorkspaceReviewInbox(workspace).find((item)=>item.origin==='imported-excel')
  assert.ok(source)
  const promotion=planPromoteSourceReview(workspace,source.id,{createdAt:'2026-08-15T02:00:00Z'})
  assert.equal(promotion.review.kind,'task')
  assert.equal(promotion.review.status,'open')
  assert.equal(promotion.review.owner,'Unassigned')
  assert.equal(promotion.review.sourceReview.kind,'excel-note')
  assert.equal(promotion.review.sourceReview.sourceReviewId,'excel-note:pipeline.xlsx:Pipeline:B2')
  const decoded=deserializeWorkspaceCommand(serializeWorkspaceCommand(promotion.command))
  assert.deepEqual(decoded,promotion.command)

  let session=createVersionedWorkspaceSession(workspace)
  const before=assessWorkspaceReadiness(session.present).openTasks
  session=executeVersionedWorkspaceCommand(session,promotion.command)
  assert.equal(assessWorkspaceReadiness(session.present).openTasks,before+1)
  assert.equal(getWorkspaceReviews(session.present).length,1)
  const inbox=listWorkspaceReviewInbox(session.present)
  assert.equal(inbox.find((item)=>item.origin==='imported-excel').promotedReviewId,promotion.review.id)
  assert.equal(inbox.some((item)=>item.origin==='frame-data'&&item.id===promotion.review.id),true)
  assert.equal(inbox.some((item)=>item.origin==='imported-excel'&&item.body==='Validate renewal assumption'),true)
})

test('promoted review resolves independently while source review remains immutable and marked promoted',()=>{
  const workspace=withImportedTables(cloneSeedWorkspace(),[sourceTable()])
  const source=listWorkspaceReviewInbox(workspace).find((item)=>item.origin==='imported-excel-thread')
  const promotion=planPromoteSourceReview(workspace,source.id,{createdAt:'now'})
  let session=createVersionedWorkspaceSession(workspace)
  session=executeVersionedWorkspaceCommand(session,promotion.command)
  session=executeVersionedWorkspaceCommand(session,planWorkspaceReviewStatusUpdate(session.present,promotion.review.id,'resolved'))
  const reviews=getWorkspaceReviews(session.present)
  assert.equal(reviews[0].status,'resolved')
  const inbox=listWorkspaceReviewInbox(session.present)
  const sourceAfter=inbox.find((item)=>item.origin==='imported-excel-thread')
  assert.equal(sourceAfter.promotedReviewId,promotion.review.id)
  assert.equal(sourceAfter.body,'Review renewal')
  assert.equal(inbox.some((item)=>item.origin==='frame-data'&&item.id===promotion.review.id),false)
})

test('same source review cannot be promoted twice',()=>{
  const workspace=withImportedTables(cloneSeedWorkspace(),[sourceTable()])
  const source=listWorkspaceReviewInbox(workspace).find((item)=>item.origin==='imported-excel')
  const first=planPromoteSourceReview(workspace,source.id)
  const applied=executeVersionedWorkspaceCommand(createVersionedWorkspaceSession(workspace),first.command).present
  assert.throws(()=>planPromoteSourceReview(applied,listWorkspaceReviewInbox(applied).find((item)=>item.origin==='imported-excel').id),/already promoted/)
})

test('promoted approvals participate in readiness blockers only after explicit promotion',()=>{
  const workspace=withImportedTables(cloneSeedWorkspace(),[sourceTable()])
  const baseline=assessWorkspaceReadiness(workspace).openApprovals
  const source=listWorkspaceReviewInbox(workspace).find((item)=>item.origin==='imported-excel')
  const promotion=planPromoteSourceReview(workspace,source.id,{kind:'approval',owner:'Finance'})
  const applied=executeVersionedWorkspaceCommand(createVersionedWorkspaceSession(workspace),promotion.command).present
  assert.equal(assessWorkspaceReadiness(applied).openApprovals,baseline+1)
  assert.equal(getWorkspaceReviews(applied)[0].status,'pending')
})

test('source re-import remaps a moved classic note by source provenance instead of Frame row position',()=>{
  const workspace=withImportedTables(cloneSeedWorkspace(),[sourceTable()])
  const source=listWorkspaceReviewInbox(workspace).find((item)=>item.origin==='imported-excel')
  const promoted=executeVersionedWorkspaceCommand(createVersionedWorkspaceSession(workspace),planPromoteSourceReview(workspace,source.id).command).present
  const oldTable=promoted.importedTables?.[0]
  const fresh=movedSourceTable();delete fresh.promotedReviews
  const plan={kind:'xlsx',label:'pipeline.xlsx',importedItems:2,warnings:[],commands:[{type:'data.imported.replace',tables:[oldTable,fresh]}]}
  const synced=synchronizeOfficeImportPlan(promoted,plan,'pipeline.xlsx')
  const replacement=synced.commands.find((command)=>command.type==='data.imported.replace')
  assert.equal(replacement.tables.length,1)
  assert.equal(replacement.tables[0].id,'table:new')
  const review=replacement.tables[0].promotedReviews[0]
  assert.equal(review.objectId,'table:table:new:row:new:2')
  assert.equal(review.sourceReview.tableId,'table:new')
  assert.equal(review.sourceReview.rowId,'row:new:2')
  assert.equal(review.sourceReview.sourceReviewId,'excel-note:pipeline.xlsx:Pipeline:B3')
})

test('source re-import remaps threaded review by stable root comment id even when its row moves',()=>{
  const workspace=withImportedTables(cloneSeedWorkspace(),[sourceTable()])
  const source=listWorkspaceReviewInbox(workspace).find((item)=>item.origin==='imported-excel-thread')
  const promoted=executeVersionedWorkspaceCommand(createVersionedWorkspaceSession(workspace),planPromoteSourceReview(workspace,source.id).command).present
  const oldTable=promoted.importedTables?.[0]
  const fresh=movedSourceTable();delete fresh.promotedReviews
  const plan={kind:'xlsx',label:'pipeline.xlsx',importedItems:2,warnings:[],commands:[{type:'data.imported.replace',tables:[oldTable,fresh]}]}
  const synced=synchronizeOfficeImportPlan(promoted,plan,'pipeline.xlsx')
  const replacement=synced.commands.find((command)=>command.type==='data.imported.replace')
  const review=replacement.tables[0].promotedReviews[0]
  assert.equal(review.objectId,'table:table:new:row:new:2')
  assert.equal(review.sourceReview.sourceReviewId,'thread-root')
})
