import assert from 'node:assert/strict'
import test from 'node:test'
import { deserializeWorkspaceCommand, serializeWorkspaceCommand } from '../src/commandCodec.ts'
import { withImportedTables } from '../src/importedTables.ts'
import { cloneSeedWorkspace } from '../src/model.ts'
import { listReviewRelinkCandidates, planRelinkPromotedReview } from '../src/reviewRelink.ts'
import { createVersionedWorkspaceSession, executeVersionedWorkspaceCommand, undoVersionedWorkspaceSession } from '../src/versioning.ts'
import { listWorkspaceReviewInbox } from '../src/workspaceReviewInbox.ts'
import { getWorkspaceReviews } from '../src/workspaceReviews.ts'

function nativeReview(overrides={}){return{id:'frame-review:renewal',objectId:'table:archive:row:old',label:'Pipeline · ARR',kind:'task',body:'Confirm renewal evidence before forecast lock',owner:'Finance',status:'open',createdAt:'2026-08-15T03:00:00Z',sourceReview:{kind:'excel-note',source:'pipeline.xlsx',tableId:'table:archive',rowId:'row:old',columnId:'arr',sourceReviewId:'excel-note:pipeline.xlsx:Pipeline:B2'},...overrides}}
function workspaceWithArchive(){
  return withImportedTables(cloneSeedWorkspace(),[
    {id:'table:archive',label:'Pipeline · review archive',source:'pipeline.xlsx',importedAt:'earlier',columns:[{id:'arr',label:'ARR',type:'number'}],rows:[{id:'row:old',values:{arr:2.4}}],commentByCell:{'row:old\u0000arr':{text:'Validate renewal assumption',author:'Alice',sourceRef:'B2'}},promotedReviews:[nativeReview()]},
    {id:'table:fresh',label:'Pipeline',source:'pipeline.xlsx',importedAt:'now',columns:[{id:'arr',label:'ARR',type:'number'}],rows:[{id:'row:new:1',values:{arr:2.4}},{id:'row:new:2',values:{arr:3.1}}],commentByCell:{'row:new:1\u0000arr':{text:'Validate renewal assumption',author:'Alice',sourceRef:'B3'},'row:new:2\u0000arr':{text:'Validate renewal assumption',author:'Alice',sourceRef:'B4'}}},
  ])
}

test('review archive exposes ranked same-source relink candidates without duplicate archive provenance',()=>{
  const workspace=workspaceWithArchive()
  const inbox=listWorkspaceReviewInbox(workspace)
  const native=inbox.find((item)=>item.origin==='frame-workspace')
  assert.ok(native)
  assert.equal(native.archived,true)
  assert.equal(inbox.filter((item)=>item.origin==='imported-excel').length,2)
  const candidates=listReviewRelinkCandidates(workspace,native.id)
  assert.equal(candidates.length,2)
  assert.equal(candidates.every((candidate)=>candidate.kind==='excel-note'&&candidate.source==='pipeline.xlsx'&&candidate.tableId==='table:fresh'),true)
  assert.equal(candidates[0].matchHints.includes('same sheet'),true)
  assert.equal(candidates[0].matchHints.includes('same source text'),true)
  assert.equal(candidates[0].matchHints.includes('same source author'),true)
})

test('relink preserves native review identity authored work and status while changing only target provenance',()=>{
  const workspace=workspaceWithArchive(),candidate=listReviewRelinkCandidates(workspace,'frame-review:renewal')[0]
  const plan=planRelinkPromotedReview(workspace,'frame-review:renewal',candidate.id)
  assert.equal(plan.review.id,'frame-review:renewal')
  assert.equal(plan.review.body,'Confirm renewal evidence before forecast lock')
  assert.equal(plan.review.owner,'Finance')
  assert.equal(plan.review.status,'open')
  assert.equal(plan.review.createdAt,'2026-08-15T03:00:00Z')
  assert.equal(plan.review.objectId,`table:table:fresh:${candidate.rowId}`)
  assert.equal(plan.review.sourceReview.sourceReviewId,candidate.sourceReviewId)
  assert.equal(plan.review.sourceReview.tableId,'table:fresh')
  assert.deepEqual(deserializeWorkspaceCommand(serializeWorkspaceCommand(plan.command)),plan.command)

  let session=createVersionedWorkspaceSession(workspace)
  session=executeVersionedWorkspaceCommand(session,plan.command)
  const reviews=getWorkspaceReviews(session.present)
  assert.equal(reviews.length,1)
  assert.equal(reviews[0].id,'frame-review:renewal')
  const inbox=listWorkspaceReviewInbox(session.present)
  const native=inbox.find((item)=>item.origin==='frame-workspace')
  assert.equal(native.archived,false)
  assert.equal(inbox.find((item)=>item.id===candidate.id).promotedReviewId,'frame-review:renewal')
  assert.equal(session.present.importedTables.find((table)=>table.id==='table:archive').promotedReviews,undefined)

  session=undoVersionedWorkspaceSession(session)
  const restored=listWorkspaceReviewInbox(session.present).find((item)=>item.origin==='frame-workspace')
  assert.equal(restored.archived,true)
  assert.equal(restored.id,'frame-review:renewal')
})

test('relink candidates exclude source review already claimed by another native review',()=>{
  const workspace=workspaceWithArchive()
  const tables=workspace.importedTables
  tables[1].promotedReviews=[nativeReview({id:'frame-review:other',objectId:'table:table:fresh:row:new:1',label:'Pipeline · ARR',body:'Other work',sourceReview:{kind:'excel-note',source:'pipeline.xlsx',tableId:'table:fresh',rowId:'row:new:1',columnId:'arr',sourceReviewId:'excel-note:pipeline.xlsx:Pipeline:B3'}})]
  const candidates=listReviewRelinkCandidates(workspace,'frame-review:renewal')
  assert.equal(candidates.length,1)
  assert.equal(candidates[0].sourceReviewId,'excel-note:pipeline.xlsx:Pipeline:B4')
  assert.throws(()=>planRelinkPromotedReview(workspace,'frame-review:renewal','review:table:fresh:row:new:1:arr'),/Unknown or unavailable review relink target/)
})

test('threaded review archives relink only to same-source threaded conversations',()=>{
  const review=nativeReview({id:'frame-review:thread',body:'Escalate review thread',sourceReview:{kind:'excel-thread',source:'pipeline.xlsx',tableId:'table:archive',rowId:'row:old',columnId:'arr',sourceReviewId:'thread:old'}})
  const workspace=withImportedTables(cloneSeedWorkspace(),[
    {id:'table:archive',label:'Pipeline · review archive',source:'pipeline.xlsx',importedAt:'earlier',columns:[{id:'arr',label:'ARR',type:'number'}],rows:[{id:'row:old',values:{arr:2.4}}],threadByCell:{'row:old\u0000arr':{comments:[{id:'thread:old',personId:'alice',author:'Alice',text:'Review renewal'}]}},promotedReviews:[review]},
    {id:'table:fresh',label:'Pipeline',source:'pipeline.xlsx',importedAt:'now',columns:[{id:'arr',label:'ARR',type:'number'}],rows:[{id:'row:new',values:{arr:2.4}}],commentByCell:{'row:new\u0000arr':{text:'Legacy note',author:'Alice',sourceRef:'B2'}},threadByCell:{'row:new\u0000arr':{comments:[{id:'thread:new',personId:'alice',author:'Alice',text:'Review renewal',done:false},{id:'thread:reply',personId:'bob',author:'Bob',text:'Checking',parentId:'thread:new'}]}}},
  ])
  const candidates=listReviewRelinkCandidates(workspace,'frame-review:thread')
  assert.equal(candidates.length,1)
  assert.equal(candidates[0].kind,'excel-thread')
  assert.equal(candidates[0].sourceReviewId,'thread:new')
  assert.equal(candidates[0].replyCount,1)
  const plan=planRelinkPromotedReview(workspace,'frame-review:thread',candidates[0].id)
  assert.equal(plan.review.sourceReview.kind,'excel-thread')
  assert.equal(plan.review.sourceReview.sourceReviewId,'thread:new')
  assert.equal(plan.review.id,'frame-review:thread')
})
