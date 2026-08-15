import assert from 'node:assert/strict'
import test from 'node:test'
import { withImportedTables } from '../src/importedTables.ts'
import { cloneSeedWorkspace } from '../src/model.ts'
import { planBatchPromoteSourceReviews } from '../src/reviewBatchPromotion.ts'
import { buildReviewCenterItems } from '../src/reviewCenter.ts'
import { createVersionedWorkspaceSession, executeVersionedWorkspaceCommand, undoVersionedWorkspaceSession } from '../src/versioning.ts'
import { getWorkspaceReviews, withWorkspaceReviews } from '../src/workspaceReviews.ts'

function workspace(){return withImportedTables(cloneSeedWorkspace(),[
  {id:'table:pipeline',label:'Pipeline',source:'pipeline.xlsx',importedAt:'now',columns:[{id:'account',label:'Account',type:'text'},{id:'arr',label:'ARR',type:'number'}],rows:[{id:'row:1',values:{account:'Acme',arr:2.4}},{id:'row:2',values:{account:'Nova',arr:1.2}}],commentByCell:{'row:1\u0000arr':{text:'Validate renewal',author:'Alice',sourceRef:'B2'},'row:2\u0000arr':{text:'Confirm expansion ARR',author:'Bob',sourceRef:'B3'}},threadByCell:{'row:1\u0000account':{comments:[{id:'thread:root',personId:'alice',author:'Alice',text:'Confirm legal entity',done:false},{id:'thread:reply',personId:'legal',author:'Legal',text:'Checking',parentId:'thread:root'}]}}},
])}
function sourceIds(workspace){return buildReviewCenterItems(workspace).filter((item)=>item.origin==='source-note'||item.origin==='source-thread').map((item)=>item.id)}

test('batch promotion creates all selected native reviews in one workspace review replacement',()=>{
  const base=workspace(),ids=sourceIds(base),plan=planBatchPromoteSourceReviews(base,ids,{kind:'task',owner:'Finance',createdAt:'2026-08-15T05:00:00Z'})
  assert.equal(ids.length,3)
  assert.equal(plan.command.type,'review.workspace.replace')
  assert.equal(plan.reviews.length,3)
  assert.equal(plan.command.reviews.length,3)
  assert.equal(plan.reviews.every((review)=>review.kind==='task'&&review.owner==='Finance'&&review.status==='open'),true)
  assert.equal(new Set(plan.reviews.map((review)=>review.sourceReview.sourceReviewId)).size,3)
  assert.deepEqual(plan.reviews.map((review)=>review.body).sort(),['Confirm expansion ARR','Confirm legal entity','Validate renewal'])
})

test('batch promotion preserves existing native review and one Undo removes the entire new batch',()=>{
  let base=workspace()
  const existing={id:'frame-review:existing',objectId:'review:frame-review:existing',label:'Existing',kind:'comment',body:'Keep me',owner:'Strategy',status:'open',createdAt:'earlier'}
  base=withWorkspaceReviews(base,[existing])
  const plan=planBatchPromoteSourceReviews(base,sourceIds(base),{owner:'Finance'})
  let session=createVersionedWorkspaceSession(base)
  session=executeVersionedWorkspaceCommand(session,plan.command)
  assert.equal(session.past.length,1)
  assert.equal(session.past[0].command.type,'review.workspace.replace')
  assert.equal(getWorkspaceReviews(session.present).length,4)
  assert.equal(getWorkspaceReviews(session.present).some((review)=>review.id===existing.id),true)
  session=undoVersionedWorkspaceSession(session)
  assert.deepEqual(getWorkspaceReviews(session.present),[existing])
})

test('batch approvals require explicit owner and create pending approvals atomically',()=>{
  const base=workspace(),ids=sourceIds(base)
  assert.throws(()=>planBatchPromoteSourceReviews(base,ids,{kind:'approval'}),/explicit owner/)
  const plan=planBatchPromoteSourceReviews(base,ids,{kind:'approval',owner:'Finance lead'})
  assert.equal(plan.reviews.every((review)=>review.kind==='approval'&&review.status==='pending'&&review.owner==='Finance lead'),true)
})

test('batch promotion rejects duplicate selections and any source review already promoted',()=>{
  const base=workspace(),ids=sourceIds(base)
  assert.throws(()=>planBatchPromoteSourceReviews(base,[ids[0],ids[0]]),/duplicate source review selections/)
  const first=planBatchPromoteSourceReviews(base,[ids[0]],{owner:'Finance'}),promoted=executeVersionedWorkspaceCommand(createVersionedWorkspaceSession(base),first.command).present
  assert.throws(()=>planBatchPromoteSourceReviews(promoted,[...ids.slice(1),ids[0]],{owner:'Finance'}),/already promoted/)
})

test('batch promotion rejects empty selection before producing a replacement command',()=>{
  assert.throws(()=>planBatchPromoteSourceReviews(workspace(),[]),/Select at least one/)
})
