import assert from 'node:assert/strict'
import test from 'node:test'
import { withImportedTables } from '../src/importedTables.ts'
import { cloneSeedWorkspace } from '../src/model.ts'
import { createVersionedWorkspaceSession, executeVersionedWorkspaceCommand, hydrateVersionedWorkspaceSession } from '../src/versioning.ts'
import { getWorkspaceReviews, withWorkspaceReviews } from '../src/workspaceReviews.ts'

function table(id='table:pipeline',promotedReviews){return{id,label:'Pipeline',source:'pipeline.xlsx',importedAt:'now',columns:[{id:'arr',label:'ARR',type:'number'}],rows:[{id:'row:1',values:{arr:2.4}}],commentByCell:{'row:1\u0000arr':{text:'Validate renewal',author:'Alice',sourceRef:'B2'}},...(promotedReviews?{promotedReviews}:{})}}
function review(id='frame-review:renewal',tableId='table:pipeline'){return{id,objectId:`table:${tableId}:row:1`,label:'Pipeline · ARR',kind:'task',body:'Validate renewal',owner:'Finance',status:'open',createdAt:'now',sourceReview:{kind:'excel-note',source:'pipeline.xlsx',tableId,rowId:'row:1',columnId:'arr',sourceReviewId:'excel-note:pipeline.xlsx:Pipeline:B2'}}}

test('versioned session materializes legacy table-owned review into canonical workspace storage',()=>{
  const legacy=withImportedTables(cloneSeedWorkspace(),[table('table:pipeline',[review()])])
  const session=createVersionedWorkspaceSession(legacy)
  assert.deepEqual(getWorkspaceReviews(session.present),[review()])
  assert.equal(session.present.importedTables[0].promotedReviews,undefined)
  assert.deepEqual(session.present.workspaceReviews,[review()])
})

test('workspace review replacement changes native review without mutating imported Data',()=>{
  const workspace=withImportedTables(cloneSeedWorkspace(),[table()]),session=createVersionedWorkspaceSession(workspace),beforeTables=structuredClone(session.present.importedTables)
  const next=executeVersionedWorkspaceCommand(session,{type:'review.workspace.replace',reviews:[review()]})
  assert.deepEqual(next.present.importedTables,beforeTables)
  assert.deepEqual(getWorkspaceReviews(next.present),[review()])
  assert.equal(next.past.at(-1).command.type,'review.workspace.replace')
})

test('legacy data replacement carrying promoted reviews merges with existing canonical native review',()=>{
  let workspace=withImportedTables(cloneSeedWorkspace(),[table('table:pipeline')])
  const existing=review('frame-review:existing'),legacy=review('frame-review:legacy')
  workspace=withWorkspaceReviews(workspace,[existing])
  const session=createVersionedWorkspaceSession(workspace)
  const next=executeVersionedWorkspaceCommand(session,{type:'data.imported.replace',tables:[table('table:pipeline',[legacy])]})
  assert.deepEqual(getWorkspaceReviews(next.present).map((item)=>item.id).sort(),['frame-review:existing','frame-review:legacy'])
  assert.equal(next.present.importedTables[0].promotedReviews,undefined)
})

test('hydration materializes legacy review storage in present and historical snapshots',()=>{
  const before=withImportedTables(cloneSeedWorkspace(),[table('table:pipeline')]),after=withImportedTables(cloneSeedWorkspace(),[table('table:pipeline',[review()])])
  const transaction={id:'transaction:1',revision:1,createdAt:'legacy',eventId:'event:1',kind:'change',command:{type:'data.imported.replace',tables:[table('table:pipeline',[review()])]},summary:'Legacy imported review',before,after}
  const hydrated=hydrateVersionedWorkspaceSession({present:after,past:[transaction],future:[],ledger:[transaction],nextRevision:2})
  assert.equal(hydrated.present.importedTables[0].promotedReviews,undefined)
  assert.equal(hydrated.past[0].after.importedTables[0].promotedReviews,undefined)
  assert.equal(hydrated.ledger[0].after.importedTables[0].promotedReviews,undefined)
  assert.equal(getWorkspaceReviews(hydrated.present).length,1)
  assert.equal(getWorkspaceReviews(hydrated.past[0].after).length,1)
})
