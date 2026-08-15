import assert from 'node:assert/strict'
import test from 'node:test'
import { withImportedTables } from '../src/importedTables.ts'
import { cloneSeedWorkspace } from '../src/model.ts'
import { getSemanticDocument, withSemanticDocument } from '../src/semanticDocument.ts'
import { listWorkspaceReviewInbox, summarizeWorkspaceReviewInbox } from '../src/workspaceReviewInbox.ts'

const sourceThread={comments:[{id:'thread:1',personId:'person:alice',author:'Alice',text:'Review renewal',done:false},{id:'thread:2',personId:'person:bob',author:'Bob',text:'Validated',parentId:'thread:1'}]}

test('workspace review inbox keeps native reviews actionable and imported Excel review read-only',()=>{
  let workspace=cloneSeedWorkspace()
  const semantic=getSemanticDocument(workspace)
  semantic.annotations.push({id:'annotation:native',blockId:semantic.blocks[0].id,kind:'task',body:'Confirm board owner',owner:'Ossa',status:'open'})
  workspace=withSemanticDocument(workspace,semantic)
  workspace=withImportedTables(workspace,[{id:'table:pipeline',label:'Pipeline',source:'pipeline.xlsx',importedAt:'now',columns:[{id:'arr',label:'ARR',type:'number'}],rows:[{id:'row:1',values:{arr:2.4}}],commentByCell:{'row:1\u0000arr':{text:'Validate renewal assumption',author:'Alice'}},threadByCell:{'row:1\u0000arr':sourceThread}}])
  const inbox=listWorkspaceReviewInbox(workspace)
  const native=inbox.find((item)=>item.id==='annotation:native')
  const note=inbox.find((item)=>item.origin==='imported-excel')
  const thread=inbox.find((item)=>item.origin==='imported-excel-thread')
  assert.ok(native);assert.ok(note);assert.ok(thread)
  assert.equal(native.actionable,true)
  assert.equal(note.actionable,false)
  assert.equal(note.kind,'source-note')
  assert.equal(note.status,'source')
  assert.equal(note.owner,'Alice')
  assert.equal(note.label,'Pipeline · ARR')
  assert.equal(note.source,'pipeline.xlsx')
  assert.equal(thread.actionable,false)
  assert.equal(thread.kind,'source-thread')
  assert.equal(thread.status,'source')
  assert.equal(thread.sourceStatus,'open')
  assert.equal(thread.replyCount,1)
  assert.deepEqual(thread.participants,['Alice','Bob'])
})

test('workspace review summary separates native open work, source notes and source threads',()=>{
  const workspace=withImportedTables(cloneSeedWorkspace(),[
    {id:'table:a',label:'Pipeline',source:'pipeline.xlsx',importedAt:'now',columns:[{id:'arr',label:'ARR',type:'number'}],rows:[{id:'row:1',values:{arr:2.4}}],commentByCell:{'row:1\u0000arr':{text:'Validate renewal',author:'Alice'}},threadByCell:{'row:1\u0000arr':sourceThread}},
    {id:'table:b',label:'Controls',source:'controls.xlsx',importedAt:'now',columns:[{id:'enabled',label:'Enabled',type:'boolean'}],rows:[{id:'row:2',values:{enabled:true}}],commentByCell:{'row:2\u0000enabled':{text:'Check control'}}},
  ])
  const summary=summarizeWorkspaceReviewInbox(workspace)
  assert.equal(summary.importedSourceNotes,2)
  assert.equal(summary.importedThreads,1)
  assert.equal(summary.importedOpenThreads,1)
  assert.equal(summary.importedThreadComments,2)
  assert.deepEqual(summary.importedSources,['controls.xlsx','pipeline.xlsx'])
  assert.equal(summary.total,summary.nativeOpen+3)
})
