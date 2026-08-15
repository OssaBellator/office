import assert from 'node:assert/strict'
import test from 'node:test'
import { withImportedTables } from '../src/importedTables.ts'
import { cloneSeedWorkspace } from '../src/model.ts'
import { planDetachWorkspaceReviewSource } from '../src/reviewDetach.ts'
import { createVersionedWorkspaceSession, executeVersionedWorkspaceCommand, undoVersionedWorkspaceSession } from '../src/versioning.ts'
import { getWorkspaceReviews, withWorkspaceReviews } from '../src/workspaceReviews.ts'

function workspace(){return withImportedTables(cloneSeedWorkspace(),[{id:'table:pipeline',label:'Pipeline',source:'pipeline.xlsx',importedAt:'now',columns:[{id:'arr',label:'ARR',type:'number'}],rows:[{id:'row:1',values:{arr:2.4}}],commentByCell:{'row:1\u0000arr':{text:'Validate renewal',author:'Alice',sourceRef:'B2'}}}])}
const review={id:'frame-review:renewal',objectId:'table:table:pipeline:row:1',label:'Pipeline · ARR',kind:'task',body:'Validate renewal evidence',owner:'Finance',status:'resolved',createdAt:'2026-08-15T04:30:00Z',sourceReview:{kind:'excel-note',source:'pipeline.xlsx',tableId:'table:pipeline',rowId:'row:1',columnId:'arr',sourceReviewId:'excel-note:pipeline.xlsx:Pipeline:B2'}}

test('detach source preserves native review identity and authored state while clearing imported source pointer',()=>{
  const linked=withWorkspaceReviews(workspace(),[review]),plan=planDetachWorkspaceReviewSource(linked,review.id)
  assert.equal(plan.command.type,'review.workspace.replace')
  assert.equal(plan.previousSource.sourceReviewId,review.sourceReview.sourceReviewId)
  assert.equal(plan.review.id,review.id)
  assert.equal(plan.review.body,review.body)
  assert.equal(plan.review.owner,review.owner)
  assert.equal(plan.review.status,'resolved')
  assert.equal(plan.review.createdAt,review.createdAt)
  assert.equal(plan.review.sourceReview,undefined)
  assert.equal(plan.review.objectId,`review:${review.id}`)
})

test('detached native review survives deliberate source table removal and undo can restore the source link',()=>{
  const linked=withWorkspaceReviews(workspace(),[review])
  let session=createVersionedWorkspaceSession(linked)
  session=executeVersionedWorkspaceCommand(session,planDetachWorkspaceReviewSource(session.present,review.id).command)
  assert.equal(getWorkspaceReviews(session.present)[0].sourceReview,undefined)
  session=executeVersionedWorkspaceCommand(session,{type:'data.imported.replace',tables:[]})
  assert.equal(session.present.importedTables.length,0)
  assert.equal(getWorkspaceReviews(session.present)[0].id,review.id)
  session=undoVersionedWorkspaceSession(session)
  assert.equal(session.present.importedTables.length,1)
  session=undoVersionedWorkspaceSession(session)
  assert.equal(getWorkspaceReviews(session.present)[0].sourceReview.sourceReviewId,review.sourceReview.sourceReviewId)
})

test('detach refuses native review that no longer has imported source provenance',()=>{
  const detached=withWorkspaceReviews(workspace(),[{...review,objectId:`review:${review.id}`,sourceReview:undefined}])
  assert.throws(()=>planDetachWorkspaceReviewSource(detached,review.id),/already detached/)
})
