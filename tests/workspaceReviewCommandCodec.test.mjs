import assert from 'node:assert/strict'
import test from 'node:test'
import { deserializeWorkspaceCommand, serializeWorkspaceCommand } from '../src/commandCodec.ts'

const review={id:'frame-review:renewal',objectId:'table:table:pipeline:row:1',label:'Pipeline · ARR',kind:'approval',body:'Approve renewal evidence',owner:'Finance lead',status:'pending',createdAt:'2026-08-15T04:00:00Z',sourceReview:{kind:'excel-note',source:'pipeline.xlsx',tableId:'table:pipeline',rowId:'row:1',columnId:'arr',sourceReviewId:'excel-note:pipeline.xlsx:Pipeline:B2'}}

test('workspace review replacement command round-trips through runtime codec',()=>{
  const command={type:'review.workspace.replace',reviews:[review],changedAt:'2026-08-15T04:01:00Z'}
  assert.deepEqual(deserializeWorkspaceCommand(serializeWorkspaceCommand(command)),command)
})

test('workspace review replacement command validates native review payloads',()=>{
  assert.throws(()=>deserializeWorkspaceCommand(JSON.stringify({type:'review.workspace.replace',reviews:[{...review,status:'mystery'}]})),/workspaceReview.status/)
  assert.throws(()=>deserializeWorkspaceCommand(JSON.stringify({type:'review.workspace.replace',reviews:[{...review,sourceReview:{...review.sourceReview,sourceReviewId:''}}]})),/sourceReviewId/)
})
