import assert from 'node:assert/strict'
import test from 'node:test'
import { withImportedTables } from '../src/importedTables.ts'
import { cloneSeedWorkspace } from '../src/model.ts'
import { listWorkspaceReviewInbox, summarizeWorkspaceReviewInbox } from '../src/workspaceReviewInbox.ts'
import { withWorkspaceReviews } from '../src/workspaceReviews.ts'

function table(){return{id:'table:pipeline',label:'Pipeline',source:'pipeline.xlsx',importedAt:'now',columns:[{id:'arr',label:'ARR',type:'number'}],rows:[{id:'row:1',values:{arr:2.4}}],commentByCell:{'row:1\u0000arr':{text:'Validate renewal',author:'Alice',sourceRef:'B2'}}}}
function review(status='resolved',tableId='table:pipeline'){return{id:'frame-review:renewal',objectId:`table:${tableId}:row:1`,label:'Pipeline · ARR',kind:'task',body:'Validate renewal evidence',owner:'Finance',status,createdAt:'now',sourceReview:{kind:'excel-note',source:'pipeline.xlsx',tableId,rowId:'row:1',columnId:'arr',sourceReviewId:'excel-note:pipeline.xlsx:Pipeline:B2'}}}

test('completed native Data review remains visible for detach lifecycle actions but is not counted open',()=>{
  let workspace=withImportedTables(cloneSeedWorkspace(),[table()])
  workspace=withWorkspaceReviews(workspace,[review('resolved')])
  const item=listWorkspaceReviewInbox(workspace).find((candidate)=>candidate.origin==='frame-data')
  assert.ok(item)
  assert.equal(item.status,'resolved')
  assert.equal(item.linkedSource,true)
  assert.equal(item.archived,false)
  const summary=summarizeWorkspaceReviewInbox(workspace)
  assert.equal(summary.promotedNativeTotal,1)
  assert.equal(summary.promotedNativeOpen,0)
  assert.equal(summary.nativeOpen,0)
})

test('native review whose source table is missing is surfaced as archived relink work rather than disappearing',()=>{
  let workspace=withImportedTables(cloneSeedWorkspace(),[])
  workspace=withWorkspaceReviews(workspace,[review('open','table:missing')])
  const item=listWorkspaceReviewInbox(workspace).find((candidate)=>candidate.origin==='frame-data')
  assert.ok(item)
  assert.equal(item.linkedSource,true)
  assert.equal(item.archived,true)
  const summary=summarizeWorkspaceReviewInbox(workspace)
  assert.equal(summary.archivedNativeOpen,1)
})
