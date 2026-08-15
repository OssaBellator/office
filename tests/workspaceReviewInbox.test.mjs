import assert from 'node:assert/strict'
import test from 'node:test'
import { withImportedTables } from '../src/importedTables.ts'
import { cloneSeedWorkspace } from '../src/model.ts'
import { getSemanticDocument, withSemanticDocument } from '../src/semanticDocument.ts'
import { listWorkspaceReviewInbox, summarizeWorkspaceReviewInbox } from '../src/workspaceReviewInbox.ts'

test('workspace review inbox keeps native reviews actionable and imported Excel notes read-only',()=>{
  let workspace=cloneSeedWorkspace()
  const semantic=getSemanticDocument(workspace)
  semantic.annotations.push({id:'annotation:native',blockId:semantic.blocks[0].id,kind:'task',body:'Confirm board owner',owner:'Ossa',status:'open'})
  workspace=withSemanticDocument(workspace,semantic)
  workspace=withImportedTables(workspace,[{id:'table:pipeline',label:'Pipeline',source:'pipeline.xlsx',importedAt:'now',columns:[{id:'arr',label:'ARR',type:'number'}],rows:[{id:'row:1',values:{arr:2.4}}],commentByCell:{'row:1\u0000arr':{text:'Validate renewal assumption',author:'Alice'}}}])
  const inbox=listWorkspaceReviewInbox(workspace)
  const native=inbox.find((item)=>item.id==='annotation:native')
  const imported=inbox.find((item)=>item.origin==='imported-excel')
  assert.ok(native);assert.ok(imported)
  assert.equal(native.actionable,true)
  assert.equal(imported.actionable,false)
  assert.equal(imported.kind,'source-note')
  assert.equal(imported.status,'source')
  assert.equal(imported.owner,'Alice')
  assert.equal(imported.label,'Pipeline · ARR')
  assert.equal(imported.source,'pipeline.xlsx')
})

test('workspace review summary separates native open work from source provenance',()=>{
  const workspace=withImportedTables(cloneSeedWorkspace(),[
    {id:'table:a',label:'Pipeline',source:'pipeline.xlsx',importedAt:'now',columns:[{id:'arr',label:'ARR',type:'number'}],rows:[{id:'row:1',values:{arr:2.4}}],commentByCell:{'row:1\u0000arr':{text:'Validate renewal',author:'Alice'}}},
    {id:'table:b',label:'Controls',source:'controls.xlsx',importedAt:'now',columns:[{id:'enabled',label:'Enabled',type:'boolean'}],rows:[{id:'row:2',values:{enabled:true}}],commentByCell:{'row:2\u0000enabled':{text:'Check control'}}},
  ])
  const summary=summarizeWorkspaceReviewInbox(workspace)
  assert.equal(summary.importedSourceNotes,2)
  assert.deepEqual(summary.importedSources,['controls.xlsx','pipeline.xlsx'])
  assert.equal(summary.total,summary.nativeOpen+2)
})
