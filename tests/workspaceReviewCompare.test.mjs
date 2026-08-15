import assert from 'node:assert/strict'
import test from 'node:test'
import { withImportedTables } from '../src/importedTables.ts'
import { cloneSeedWorkspace } from '../src/model.ts'
import { compareWorkspaceStatesWithReview } from '../src/workspaceReviewCompare.ts'

function workspace(note){return withImportedTables(cloneSeedWorkspace(),[{id:'table:pipeline',label:'Pipeline',source:'pipeline.xlsx',importedAt:'now',columns:[{id:'arr',label:'ARR',type:'number'}],rows:[{id:'row:1',values:{arr:2.4}}],...(note?{commentByCell:{'row:1\u0000arr':{text:note,author:'Alice'}}}:{})}])}

test('review-aware semantic comparison adds imported cell-note diffs without changing cell values',()=>{
  const diffs=compareWorkspaceStatesWithReview(workspace('Validate renewal'),workspace('Validated with Finance'))
  assert.equal(diffs.some((diff)=>diff.field==='ARR'&&diff.before!==diff.after),false)
  const note=diffs.find((diff)=>diff.field==='ARR note')
  assert.ok(note)
  assert.match(String(note.before),/Validate renewal/)
  assert.match(String(note.after),/Validated with Finance/)
})

test('review-aware comparison reports note addition and removal',()=>{
  assert.equal(compareWorkspaceStatesWithReview(workspace(null),workspace('New review')).find((diff)=>diff.field==='ARR note').change,'added')
  assert.equal(compareWorkspaceStatesWithReview(workspace('Old review'),workspace(null)).find((diff)=>diff.field==='ARR note').change,'removed')
})
