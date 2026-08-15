import assert from 'node:assert/strict'
import test from 'node:test'
import { cloneSeedWorkspace } from '../src/model.ts'
import { planBatchTriageWorkspaceReviews } from '../src/reviewBatchTriage.ts'
import { createVersionedWorkspaceSession, executeVersionedWorkspaceCommand, undoVersionedWorkspaceSession } from '../src/versioning.ts'
import { getWorkspaceReviews, withWorkspaceReviews } from '../src/workspaceReviews.ts'

const source={kind:'excel-note',source:'model.xlsx',tableId:'table:model',rowId:'row:1',columnId:'value',sourceReviewId:'excel-note:model.xlsx:Model:B2'}
function review(id,kind,status,owner){return{id,objectId:`review-target:${id}`,label:`Review ${id}`,kind,body:`Body ${id}`,owner,status,createdAt:'earlier',sourceReview:{...source,sourceReviewId:`${source.sourceReviewId}:${id}`}}}
function workspace(){return withWorkspaceReviews(cloneSeedWorkspace(),[
  review('task','task','open','Finance'),
  review('comment','comment','open','Strategy'),
  review('approval','approval','pending','CFO'),
  review('done','task','resolved','Finance'),
])}

test('batch triage completes mixed task comment and approval in one canonical review replacement',()=>{
  const base=workspace(),plan=planBatchTriageWorkspaceReviews(base,['task','comment','approval'],{complete:true})
  assert.equal(plan.command.type,'review.workspace.replace')
  assert.deepEqual(plan.changedReviewIds,['task','comment','approval'])
  const byId=new Map(plan.reviews.map((item)=>[item.id,item]))
  assert.equal(byId.get('task').status,'resolved')
  assert.equal(byId.get('comment').status,'resolved')
  assert.equal(byId.get('approval').status,'approved')
  assert.equal(byId.get('done').status,'resolved')
  assert.deepEqual(byId.get('task').sourceReview,base.workspaceReviews.find((item)=>item.id==='task').sourceReview)
})

test('batch triage reassigns owner while preserving native review identity source body status and timestamp',()=>{
  const base=workspace(),before=getWorkspaceReviews(base),plan=planBatchTriageWorkspaceReviews(base,['task','approval'],{owner:'Operating lead'})
  const task=plan.reviews.find((item)=>item.id==='task'),approval=plan.reviews.find((item)=>item.id==='approval')
  assert.equal(task.owner,'Operating lead');assert.equal(approval.owner,'Operating lead')
  assert.equal(task.status,'open');assert.equal(approval.status,'pending')
  for(const id of ['task','approval']){
    const left=before.find((item)=>item.id===id),right=plan.reviews.find((item)=>item.id===id)
    assert.equal(right.id,left.id);assert.equal(right.body,left.body);assert.equal(right.createdAt,left.createdAt);assert.deepEqual(right.sourceReview,left.sourceReview)
  }
})

test('batch triage can reassign and complete in the same semantic revision and one Undo restores the whole batch',()=>{
  let session=createVersionedWorkspaceSession(workspace())
  const before=getWorkspaceReviews(session.present)
  const plan=planBatchTriageWorkspaceReviews(session.present,['task','approval'],{owner:'Exec sponsor',complete:true})
  session=executeVersionedWorkspaceCommand(session,plan.command)
  assert.equal(session.past.length,1)
  assert.equal(getWorkspaceReviews(session.present).find((item)=>item.id==='task').status,'resolved')
  assert.equal(getWorkspaceReviews(session.present).find((item)=>item.id==='approval').status,'approved')
  assert.equal(getWorkspaceReviews(session.present).find((item)=>item.id==='task').owner,'Exec sponsor')
  session=undoVersionedWorkspaceSession(session)
  assert.deepEqual(getWorkspaceReviews(session.present),before)
})

test('batch triage rejects empty duplicate unknown blank-owner and ineffective requests before mutation',()=>{
  const base=workspace()
  assert.throws(()=>planBatchTriageWorkspaceReviews(base,[]),/Select at least one/)
  assert.throws(()=>planBatchTriageWorkspaceReviews(base,['task','task'],{complete:true}),/duplicate native review selections/)
  assert.throws(()=>planBatchTriageWorkspaceReviews(base,['missing'],{complete:true}),/Unknown native Data review/)
  assert.throws(()=>planBatchTriageWorkspaceReviews(base,['task'],{owner:'   '}),/must not be blank/)
  assert.throws(()=>planBatchTriageWorkspaceReviews(base,['task'],{}),/Choose a new owner/)
  assert.throws(()=>planBatchTriageWorkspaceReviews(base,['done'],{complete:true}),/already matches/)
})

test('batch triage leaves unselected native review unchanged',()=>{
  const base=workspace(),plan=planBatchTriageWorkspaceReviews(base,['task'],{complete:true})
  for(const id of ['comment','approval','done'])assert.deepEqual(plan.reviews.find((item)=>item.id===id),getWorkspaceReviews(base).find((item)=>item.id===id))
})
