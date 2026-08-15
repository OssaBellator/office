import assert from 'node:assert/strict'
import test from 'node:test'
import { withImportedTables } from '../src/importedTables.ts'
import { cloneSeedWorkspace } from '../src/model.ts'
import { planDetachWorkspaceReviewSource } from '../src/reviewDetach.ts'
import { planBatchPromoteSourceReviews } from '../src/reviewBatchPromotion.ts'
import { planPromoteSourceReview } from '../src/reviewPromotion.ts'
import { createVersionedWorkspaceSession, executeVersionedWorkspaceCommand } from '../src/versioning.ts'
import { listWorkspaceReviewInbox } from '../src/workspaceReviewInbox.ts'
import { getWorkspaceReviews } from '../src/workspaceReviews.ts'

function workspace(){return withImportedTables(cloneSeedWorkspace(),[{id:'table:pipeline',label:'Pipeline',source:'pipeline.xlsx',importedAt:'now',columns:[{id:'arr',label:'ARR',type:'number'}],rows:[{id:'row:1',values:{arr:2.4}}],commentByCell:{'row:1\u0000arr':{text:'Validate renewal',author:'Alice',sourceRef:'B2'}}}])}

test('source review can be promoted again after deliberate detach without reusing native review identity',()=>{
  let session=createVersionedWorkspaceSession(workspace())
  const sourceId=listWorkspaceReviewInbox(session.present).find((item)=>item.origin==='imported-excel').id
  const first=planPromoteSourceReview(session.present,sourceId,{owner:'Finance'})
  session=executeVersionedWorkspaceCommand(session,first.command)
  session=executeVersionedWorkspaceCommand(session,planDetachWorkspaceReviewSource(session.present,first.review.id).command)
  const sourceAfterDetach=listWorkspaceReviewInbox(session.present).find((item)=>item.origin==='imported-excel')
  assert.equal(sourceAfterDetach.promotedReviewId,undefined)
  const second=planPromoteSourceReview(session.present,sourceAfterDetach.id,{owner:'RevOps'})
  assert.equal(second.review.id,`${first.review.id}:2`)
  session=executeVersionedWorkspaceCommand(session,second.command)
  const reviews=getWorkspaceReviews(session.present)
  assert.equal(reviews.length,2)
  assert.equal(reviews.find((review)=>review.id===first.review.id).sourceReview,undefined)
  assert.equal(reviews.find((review)=>review.id===second.review.id).sourceReview.sourceReviewId,'excel-note:pipeline.xlsx:Pipeline:B2')
})

test('atomic batch promotion also allocates next identity when same source had a detached native review',()=>{
  let session=createVersionedWorkspaceSession(workspace())
  const sourceId=listWorkspaceReviewInbox(session.present).find((item)=>item.origin==='imported-excel').id
  const first=planPromoteSourceReview(session.present,sourceId)
  session=executeVersionedWorkspaceCommand(session,first.command)
  session=executeVersionedWorkspaceCommand(session,planDetachWorkspaceReviewSource(session.present,first.review.id).command)
  const batch=planBatchPromoteSourceReviews(session.present,[sourceId],{owner:'Finance'})
  assert.equal(batch.reviews[0].id,`${first.review.id}:2`)
})
