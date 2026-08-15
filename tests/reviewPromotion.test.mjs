import assert from 'node:assert/strict'
import test from 'node:test'
import { deserializeWorkspaceCommand, serializeWorkspaceCommand } from '../src/commandCodec.ts'
import { getImportedTables, withImportedTables } from '../src/importedTables.ts'
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
function sameCellDifferentFrameRow(){
  return{id:'table:stable-cell',label:'Pipeline',source:'pipeline.xlsx',importedAt:'later',columns:[{id:'arr',label:'ARR',type:'number'}],rows:[{id:'row:stable:1',values:{arr:1.1}},{id:'row:stable:2',values:{arr:2.4}}],commentByCell:{'row:stable:2\u0000arr':{text:'Validate renewal assumption',author:'Alice',sourceRef:'B2'}}}
}
function ambiguousSourceTable(){
  return{id:'table:new',label:'Pipeline',source:'pipeline.xlsx',importedAt:'later',columns:[{id:'arr',label:'ARR',type:'number'}],rows:[{id:'row:new:1',values:{arr:1.1}},{id:'row:new:2',values:{arr:2.4}}],commentByCell:{'row:new:1\u0000arr':{text:'Validate renewal assumption',author:'Alice',sourceRef:'B3'},'row:new:2\u0000arr':{text:'Validate renewal assumption',author:'Alice',sourceRef:'B4'}}}
}
function recoveredSourceTable(){
  return{id:'table:recovered',label:'Pipeline',source:'pipeline.xlsx',importedAt:'recovered',columns:[{id:'arr',label:'ARR',type:'number'}],rows:[{id:'row:recovered:1',values:{arr:2.4}}],commentByCell:{'row:recovered:1\u0000arr':{text:'Validate renewal assumption',author:'Alice',sourceRef:'B2'}}}
}
function applyCommands(workspace,commands){let session=createVersionedWorkspaceSession(workspace);for(const command of commands)session=executeVersionedWorkspaceCommand(session,command);return session.present}

test('promoting a source note creates a native Frame task without mutating source provenance',()=>{
  const workspace=withImportedTables(cloneSeedWorkspace(),[sourceTable()])
  const source=listWorkspaceReviewInbox(workspace).find((item)=>item.origin==='imported-excel')
  assert.ok(source)
  const promotion=planPromoteSourceReview(workspace,source.id,{createdAt:'2026-08-15T02:00:00Z'})
  assert.equal(promotion.review.kind,'task')
  assert.equal(promotion.review.status,'open')
  assert.equal(promotion.review.owner,'Unassigned')
  assert.equal(promotion.review.body,'Validate renewal assumption')
  assert.equal(promotion.review.sourceReview.kind,'excel-note')
  assert.equal(promotion.review.sourceReview.sourceReviewId,'excel-note:pipeline.xlsx:Pipeline:B2')
  const decoded=deserializeWorkspaceCommand(serializeWorkspaceCommand(promotion.command))
  assert.deepEqual(decoded,promotion.command)

  let session=createVersionedWorkspaceSession(workspace)
  const before=assessWorkspaceReadiness(session.present).openTasks
  session=executeVersionedWorkspaceCommand(session,promotion.command)
  assert.equal(assessWorkspaceReadiness(session.present).openTasks,before+1)
  assert.equal(getWorkspaceReviews(session.present).length,1)
  assert.equal(getImportedTables(session.present)[0].promotedReviews,undefined)
  const inbox=listWorkspaceReviewInbox(session.present)
  assert.equal(inbox.find((item)=>item.origin==='imported-excel').promotedReviewId,promotion.review.id)
  assert.equal(inbox.some((item)=>item.origin==='frame-workspace'&&item.id===promotion.review.id),true)
  assert.equal(inbox.some((item)=>item.origin==='imported-excel'&&item.body==='Validate renewal assumption'),true)
})

test('promotion can author native kind owner and follow-up without changing the source review',()=>{
  const workspace=withImportedTables(cloneSeedWorkspace(),[sourceTable()])
  const source=listWorkspaceReviewInbox(workspace).find((item)=>item.origin==='imported-excel-thread')
  assert.throws(()=>planPromoteSourceReview(workspace,source.id,{kind:'approval'}),/explicit owner/)
  const promotion=planPromoteSourceReview(workspace,source.id,{kind:'approval',owner:'Finance lead',body:'Approve renewal evidence before forecast lock',createdAt:'now'})
  assert.equal(promotion.review.kind,'approval')
  assert.equal(promotion.review.status,'pending')
  assert.equal(promotion.review.owner,'Finance lead')
  assert.equal(promotion.review.body,'Approve renewal evidence before forecast lock')
  const applied=executeVersionedWorkspaceCommand(createVersionedWorkspaceSession(workspace),promotion.command).present
  assert.equal(listWorkspaceReviewInbox(applied).find((item)=>item.origin==='imported-excel-thread').body,'Review renewal')
  assert.equal(getWorkspaceReviews(applied)[0].body,'Approve renewal evidence before forecast lock')
  assert.throws(()=>planPromoteSourceReview(workspace,source.id,{body:'   '}),/must not be blank/)
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
  assert.equal(inbox.some((item)=>item.origin==='frame-workspace'&&item.id===promotion.review.id),false)
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

test('source re-import remaps a moved classic note in canonical workspace review state',()=>{
  const workspace=withImportedTables(cloneSeedWorkspace(),[sourceTable()])
  const source=listWorkspaceReviewInbox(workspace).find((item)=>item.origin==='imported-excel')
  const promoted=executeVersionedWorkspaceCommand(createVersionedWorkspaceSession(workspace),planPromoteSourceReview(workspace,source.id).command).present
  const oldTable=getImportedTables(promoted)[0],fresh=movedSourceTable()
  const plan={kind:'xlsx',label:'pipeline.xlsx',importedItems:2,warnings:[],commands:[{type:'data.imported.replace',tables:[oldTable,fresh]}]}
  const synced=synchronizeOfficeImportPlan(promoted,plan,'pipeline.xlsx')
  const replacement=synced.commands.find((command)=>command.type==='data.imported.replace')
  const reviewCommand=synced.commands.find((command)=>command.type==='review.workspace.replace')
  assert.equal(replacement.tables.length,1)
  assert.equal(replacement.tables[0].id,'table:new')
  assert.equal(replacement.tables[0].promotedReviews,undefined)
  assert.ok(reviewCommand)
  const review=reviewCommand.reviews[0]
  assert.equal(review.objectId,'table:table:new:row:new:2')
  assert.equal(review.sourceReview.tableId,'table:new')
  assert.equal(review.sourceReview.rowId,'row:new:2')
  assert.equal(review.sourceReview.sourceReviewId,'excel-note:pipeline.xlsx:Pipeline:B3')
})

test('source re-import prefers stable classic-note cell reference over Frame row position',()=>{
  const workspace=withImportedTables(cloneSeedWorkspace(),[sourceTable()])
  const source=listWorkspaceReviewInbox(workspace).find((item)=>item.origin==='imported-excel')
  const promoted=executeVersionedWorkspaceCommand(createVersionedWorkspaceSession(workspace),planPromoteSourceReview(workspace,source.id).command).present
  const oldTable=getImportedTables(promoted)[0],fresh=sameCellDifferentFrameRow()
  const synced=synchronizeOfficeImportPlan(promoted,{kind:'xlsx',label:'pipeline.xlsx',importedItems:2,warnings:[],commands:[{type:'data.imported.replace',tables:[oldTable,fresh]}]},'pipeline.xlsx')
  const review=synced.commands.find((command)=>command.type==='review.workspace.replace').reviews[0]
  assert.equal(review.objectId,'table:table:stable-cell:row:stable:2')
  assert.equal(review.sourceReview.sourceReviewId,'excel-note:pipeline.xlsx:Pipeline:B2')
})

test('source re-import remaps threaded review by stable root comment id even when its row moves',()=>{
  const workspace=withImportedTables(cloneSeedWorkspace(),[sourceTable()])
  const source=listWorkspaceReviewInbox(workspace).find((item)=>item.origin==='imported-excel-thread')
  const promoted=executeVersionedWorkspaceCommand(createVersionedWorkspaceSession(workspace),planPromoteSourceReview(workspace,source.id).command).present
  const oldTable=getImportedTables(promoted)[0],fresh=movedSourceTable()
  const synced=synchronizeOfficeImportPlan(promoted,{kind:'xlsx',label:'pipeline.xlsx',importedItems:2,warnings:[],commands:[{type:'data.imported.replace',tables:[oldTable,fresh]}]},'pipeline.xlsx')
  const review=synced.commands.find((command)=>command.type==='review.workspace.replace').reviews[0]
  assert.equal(review.objectId,'table:table:new:row:new:2')
  assert.equal(review.sourceReview.sourceReviewId,'thread-root')
})

test('ambiguous classic-note re-import archives source context instead of guessing a target',()=>{
  const workspace=withImportedTables(cloneSeedWorkspace(),[sourceTable()])
  const source=listWorkspaceReviewInbox(workspace).find((item)=>item.origin==='imported-excel')
  const promoted=executeVersionedWorkspaceCommand(createVersionedWorkspaceSession(workspace),planPromoteSourceReview(workspace,source.id).command).present
  const oldTable=getImportedTables(promoted)[0],fresh=ambiguousSourceTable()
  const synced=synchronizeOfficeImportPlan(promoted,{kind:'xlsx',label:'pipeline.xlsx',importedItems:2,warnings:[],commands:[{type:'data.imported.replace',tables:[oldTable,fresh]}]},'pipeline.xlsx')
  const replacement=synced.commands.find((command)=>command.type==='data.imported.replace')
  assert.equal(replacement.tables.length,2)
  assert.equal(replacement.tables.some((table)=>table.id==='table:new'),true)
  const archive=replacement.tables.find((table)=>table.label==='Pipeline · review archive')
  assert.ok(archive)
  assert.equal(archive.promotedReviews,undefined)
  assert.equal(synced.commands.some((command)=>command.type==='review.workspace.replace'),false)
  assert.equal(getWorkspaceReviews(promoted)[0].objectId,'table:table:old:row:old:1')
  assert.equal(synced.warnings.some((warning)=>/retained against a review archive table instead of being dropped or guessed/.test(warning)),true)
})

test('missing source sheet retains source context on a review archive table',()=>{
  const workspace=withImportedTables(cloneSeedWorkspace(),[sourceTable()])
  const source=listWorkspaceReviewInbox(workspace).find((item)=>item.origin==='imported-excel')
  const promoted=executeVersionedWorkspaceCommand(createVersionedWorkspaceSession(workspace),planPromoteSourceReview(workspace,source.id).command).present
  const synced=synchronizeOfficeImportPlan(promoted,{kind:'xlsx',label:'pipeline.xlsx',importedItems:0,warnings:[],commands:[]},'pipeline.xlsx')
  const replacement=synced.commands.find((command)=>command.type==='data.imported.replace')
  assert.ok(replacement)
  assert.equal(replacement.tables.length,1)
  assert.equal(replacement.tables[0].label,'Pipeline · review archive')
  assert.equal(replacement.tables[0].promotedReviews,undefined)
  assert.equal(synced.warnings.some((warning)=>/review archive table/.test(warning)),true)
})

test('an archived review can safely reattach when the same source review returns later',()=>{
  const workspace=withImportedTables(cloneSeedWorkspace(),[sourceTable()])
  const source=listWorkspaceReviewInbox(workspace).find((item)=>item.origin==='imported-excel')
  const promoted=executeVersionedWorkspaceCommand(createVersionedWorkspaceSession(workspace),planPromoteSourceReview(workspace,source.id).command).present
  const oldTable=getImportedTables(promoted)[0],ambiguous=ambiguousSourceTable()
  const first=synchronizeOfficeImportPlan(promoted,{kind:'xlsx',label:'pipeline.xlsx',importedItems:2,warnings:[],commands:[{type:'data.imported.replace',tables:[oldTable,ambiguous]}]},'pipeline.xlsx')
  const archivedWorkspace=applyCommands(promoted,first.commands)
  const recovered=recoveredSourceTable()
  const second=synchronizeOfficeImportPlan(archivedWorkspace,{kind:'xlsx',label:'pipeline.xlsx',importedItems:1,warnings:[],commands:[{type:'data.imported.replace',tables:[...getImportedTables(archivedWorkspace),recovered]}]},'pipeline.xlsx')
  const replacement=second.commands.find((command)=>command.type==='data.imported.replace')
  const reviewCommand=second.commands.find((command)=>command.type==='review.workspace.replace')
  assert.equal(replacement.tables.length,1)
  assert.equal(replacement.tables[0].id,'table:recovered')
  assert.ok(reviewCommand)
  assert.equal(reviewCommand.reviews[0].objectId,'table:table:recovered:row:recovered:1')
  assert.equal(reviewCommand.reviews[0].sourceReview.sourceReviewId,'excel-note:pipeline.xlsx:Pipeline:B2')
})
