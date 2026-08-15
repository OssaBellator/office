import assert from 'node:assert/strict'
import test from 'node:test'
import { withImportedTables } from '../src/importedTables.ts'
import { cloneSeedWorkspace } from '../src/model.ts'
import { planTransactionRevert, revertVersionedTransaction } from '../src/revert.ts'
import { createVersionedWorkspaceSession, executeVersionedWorkspaceCommand } from '../src/versioning.ts'
import { getWorkspaceReviews } from '../src/workspaceReviews.ts'

function workspace(){return withImportedTables(cloneSeedWorkspace(),[{id:'table:pipeline',label:'Pipeline',source:'pipeline.xlsx',importedAt:'now',columns:[{id:'arr',label:'ARR',type:'number'}],rows:[{id:'row:1',values:{arr:2.4}}],commentByCell:{'row:1\u0000arr':{text:'Validate renewal',author:'Alice',sourceRef:'B2'}}}])}
const review={id:'frame-review:renewal',objectId:'table:table:pipeline:row:1',label:'Pipeline · ARR',kind:'task',body:'Validate renewal evidence',owner:'Finance',status:'open',createdAt:'now',sourceReview:{kind:'excel-note',source:'pipeline.xlsx',tableId:'table:pipeline',rowId:'row:1',columnId:'arr',sourceReviewId:'excel-note:pipeline.xlsx:Pipeline:B2'}}

test('workspace review replacement can revert as a new semantic revision when review state is unchanged',()=>{
  let session=createVersionedWorkspaceSession(workspace())
  session=executeVersionedWorkspaceCommand(session,{type:'review.workspace.replace',reviews:[review]})
  const target=session.past.at(-1)
  const plan=planTransactionRevert(session,target.id)
  assert.equal(plan.canRevert,true)
  assert.equal(plan.inverseCommand.type,'review.workspace.replace')
  assert.deepEqual(plan.inverseCommand.reviews,[])
  const reverted=revertVersionedTransaction(session,target.id).session
  assert.equal(getWorkspaceReviews(reverted.present).length,0)
  assert.equal(reverted.past.at(-1).kind,'revert')
  assert.equal(reverted.past.at(-1).reverts,target.id)
})

test('workspace review revert refuses to overwrite a later native review change',()=>{
  let session=createVersionedWorkspaceSession(workspace())
  session=executeVersionedWorkspaceCommand(session,{type:'review.workspace.replace',reviews:[review]})
  const target=session.past.at(-1)
  session=executeVersionedWorkspaceCommand(session,{type:'review.workspace.replace',reviews:[{...review,status:'resolved'}]})
  const plan=planTransactionRevert(session,target.id)
  assert.equal(plan.canRevert,false)
  assert.equal(plan.conflicts.some((item)=>item.objectId==='review:workspace'&&/changed again/.test(item.message)),true)
  assert.equal(revertVersionedTransaction(session,target.id).session,session)
  assert.equal(getWorkspaceReviews(session.present)[0].status,'resolved')
})
