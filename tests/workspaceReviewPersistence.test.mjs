import assert from 'node:assert/strict'
import test from 'node:test'
import { withImportedTables } from '../src/importedTables.ts'
import { cloneSeedWorkspace } from '../src/model.ts'
import { hydrateWorkspaceSession, serializeWorkspaceSession } from '../src/sessionStore.ts'
import { createVersionedWorkspaceSession, executeVersionedWorkspaceCommand, undoVersionedWorkspaceSession } from '../src/versioning.ts'
import { getWorkspaceReviews } from '../src/workspaceReviews.ts'

function workspace(){return withImportedTables(cloneSeedWorkspace(),[{id:'table:pipeline',label:'Pipeline',source:'pipeline.xlsx',importedAt:'now',columns:[{id:'arr',label:'ARR',type:'number'}],rows:[{id:'row:1',values:{arr:2.4}}],commentByCell:{'row:1\u0000arr':{text:'Validate renewal',author:'Alice',sourceRef:'B2'}}}])}
const review={id:'frame-review:renewal',objectId:'table:table:pipeline:row:1',label:'Pipeline · ARR',kind:'task',body:'Validate renewal',owner:'Finance',status:'open',createdAt:'now',sourceReview:{kind:'excel-note',source:'pipeline.xlsx',tableId:'table:pipeline',rowId:'row:1',columnId:'arr',sourceReviewId:'excel-note:pipeline.xlsx:Pipeline:B2'}}

test('canonical workspace review survives session serialize and hydrate in present and ledger',()=>{
  let session=createVersionedWorkspaceSession(workspace())
  session=executeVersionedWorkspaceCommand(session,{type:'review.workspace.replace',reviews:[review]})
  const hydrated=hydrateWorkspaceSession(JSON.parse(serializeWorkspaceSession(session)))
  assert.deepEqual(getWorkspaceReviews(hydrated.present),[review])
  assert.deepEqual(getWorkspaceReviews(hydrated.past[0].after),[review])
  assert.deepEqual(getWorkspaceReviews(hydrated.ledger[0].after),[review])
  assert.equal(hydrated.present.importedTables[0].promotedReviews,undefined)
})

test('redo snapshot retains canonical review after persistence while undone present remains clean',()=>{
  let session=createVersionedWorkspaceSession(workspace())
  session=executeVersionedWorkspaceCommand(session,{type:'review.workspace.replace',reviews:[review]})
  session=undoVersionedWorkspaceSession(session)
  const hydrated=hydrateWorkspaceSession(JSON.parse(serializeWorkspaceSession(session)))
  assert.equal(getWorkspaceReviews(hydrated.present).length,0)
  assert.equal(hydrated.future.length,1)
  assert.deepEqual(getWorkspaceReviews(hydrated.future[0].after),[review])
  assert.deepEqual(getWorkspaceReviews(hydrated.ledger[0].after),[review])
})
