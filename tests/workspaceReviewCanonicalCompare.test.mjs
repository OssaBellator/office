import assert from 'node:assert/strict'
import test from 'node:test'
import { withImportedTables } from '../src/importedTables.ts'
import { cloneSeedWorkspace } from '../src/model.ts'
import { compareWorkspaceStatesWithReview } from '../src/workspaceReviewCompare.ts'
import { withWorkspaceReviews } from '../src/workspaceReviews.ts'

function workspace(){return withImportedTables(cloneSeedWorkspace(),[{id:'table:pipeline',label:'Pipeline',source:'pipeline.xlsx',importedAt:'now',columns:[{id:'arr',label:'ARR',type:'number'}],rows:[{id:'row:1',values:{arr:2.4}}],commentByCell:{'row:1\u0000arr':{text:'Validate renewal',author:'Alice',sourceRef:'B2'}}}])}
const review={id:'frame-review:renewal',objectId:'table:table:pipeline:row:1',label:'Pipeline · ARR',kind:'task',body:'Validate renewal evidence',owner:'Finance',status:'open',createdAt:'now',sourceReview:{kind:'excel-note',source:'pipeline.xlsx',tableId:'table:pipeline',rowId:'row:1',columnId:'arr',sourceReviewId:'excel-note:pipeline.xlsx:Pipeline:B2'}}

test('canonical native review add is versioned separately from imported cell value and source note',()=>{
  const before=workspace(),after=withWorkspaceReviews(workspace(),[review])
  const diffs=compareWorkspaceStatesWithReview(before,after)
  assert.equal(diffs.some((diff)=>diff.field==='ARR'),false)
  assert.equal(diffs.some((diff)=>diff.field==='ARR note'),false)
  const added=diffs.find((diff)=>diff.field==='Frame review')
  assert.ok(added)
  assert.equal(added.change,'added')
  assert.match(String(added.after),/Validate renewal evidence/)
})

test('canonical native review status and source relink produce inspectable review-only diffs',()=>{
  const before=withWorkspaceReviews(workspace(),[review])
  const relinked={...review,objectId:'table:table:pipeline:row:1',status:'resolved',sourceReview:{...review.sourceReview,sourceReviewId:'excel-note:pipeline.xlsx:Pipeline:B3'}}
  const after=withWorkspaceReviews(workspace(),[relinked])
  const diffs=compareWorkspaceStatesWithReview(before,after)
  const status=diffs.find((diff)=>diff.field==='Frame review status')
  const source=diffs.find((diff)=>diff.field==='Frame review source')
  assert.ok(status);assert.ok(source)
  assert.equal(status.before,'open')
  assert.equal(status.after,'resolved')
  assert.match(String(source.before),/B2/)
  assert.match(String(source.after),/B3/)
})
