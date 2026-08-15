import assert from 'node:assert/strict'
import test from 'node:test'
import { withImportedTables } from '../src/importedTables.ts'
import { cloneSeedWorkspace } from '../src/model.ts'
import { buildReviewCenterItems, filterReviewCenterItems, summarizeReviewCenter } from '../src/reviewCenter.ts'
import { getSemanticDocument, withSemanticDocument } from '../src/semanticDocument.ts'
import { withWorkspaceReviews } from '../src/workspaceReviews.ts'

function workspace(){
  let workspace=cloneSeedWorkspace()
  const semantic=getSemanticDocument(workspace)
  const blockId=semantic.blocks[0].id
  semantic.annotations.push({id:'annotation:docs-open',blockId,kind:'task',body:'Confirm board owner',owner:'Ossa',status:'open'})
  semantic.annotations.push({id:'annotation:docs-done',blockId,kind:'comment',body:'Wording reviewed',owner:'Maya',status:'resolved'})
  workspace=withSemanticDocument(workspace,semantic)
  workspace=withImportedTables(workspace,[
    {id:'table:pipeline',label:'Pipeline',source:'pipeline.xlsx',importedAt:'now',columns:[{id:'arr',label:'ARR',type:'number'}],rows:[{id:'row:1',values:{arr:2.4}}],commentByCell:{'row:1\u0000arr':{text:'Validate renewal',author:'Alice',sourceRef:'B2'}},threadByCell:{'row:1\u0000arr':{comments:[{id:'thread:1',personId:'alice',author:'Alice',text:'Review renewal',done:false},{id:'thread:2',personId:'bob',author:'Bob',text:'Checking',parentId:'thread:1'}]}}},
    {id:'table:archive',label:'Controls · review archive',source:'controls.xlsx',importedAt:'earlier',columns:[{id:'enabled',label:'Enabled',type:'boolean'}],rows:[{id:'row:old',values:{enabled:true}}],commentByCell:{'row:old\u0000enabled':{text:'Check control',author:'Ravi',sourceRef:'C4'}}},
  ])
  return withWorkspaceReviews(workspace,[
    {id:'frame-review:renewal',objectId:'table:table:pipeline:row:1',label:'Pipeline · ARR',kind:'approval',body:'Approve renewal evidence',owner:'Finance',status:'pending',createdAt:'now',sourceReview:{kind:'excel-note',source:'pipeline.xlsx',tableId:'table:pipeline',rowId:'row:1',columnId:'arr',sourceReviewId:'excel-note:pipeline.xlsx:Pipeline:B2'}},
    {id:'frame-review:archive',objectId:'table:table:archive:row:old',label:'Controls · Enabled',kind:'task',body:'Confirm control owner',owner:'Ravi',status:'open',createdAt:'now',sourceReview:{kind:'excel-note',source:'controls.xlsx',tableId:'table:archive',rowId:'row:old',columnId:'enabled',sourceReviewId:'excel-note:controls.xlsx:Controls:C4'}},
    {id:'frame-review:done',objectId:'review:frame-review:done',label:'Historical follow-up',kind:'task',body:'Closed follow-up',owner:'Finance',status:'resolved',createdAt:'earlier'},
  ])
}

test('Review Center unifies Docs Data source review archive and completed work',()=>{
  const items=buildReviewCenterItems(workspace()),summary=summarizeReviewCenter(items)
  assert.equal(items.some((item)=>item.origin==='docs'&&item.id==='annotation:docs-open'&&item.state==='active'),true)
  assert.equal(items.some((item)=>item.origin==='docs'&&item.id==='annotation:docs-done'&&item.state==='completed'),true)
  assert.equal(items.some((item)=>item.origin==='data'&&item.id==='frame-review:renewal'&&item.state==='active'),true)
  assert.equal(items.some((item)=>item.origin==='data'&&item.id==='frame-review:archive'&&item.state==='archived'),true)
  assert.equal(items.some((item)=>item.origin==='data'&&item.id==='frame-review:done'&&item.state==='completed'),true)
  assert.equal(items.some((item)=>item.origin==='source-note'&&item.promotedReviewId==='frame-review:renewal'),true)
  assert.equal(items.some((item)=>item.origin==='source-thread'&&item.replyCount===1),true)
  assert.equal(items.some((item)=>item.origin==='source-note'&&item.source==='controls.xlsx'),false)
  assert.equal(summary.active>=2,true)
  assert.equal(summary.archived,1)
  assert.equal(summary.pendingApprovals,1)
  assert.equal(summary.completed>=2,true)
  assert.equal(summary.source,2)
})

test('Review Center filters by state kind owner and free-text together',()=>{
  const items=buildReviewCenterItems(workspace())
  assert.deepEqual(filterReviewCenterItems(items,{state:'archived'}).map((item)=>item.id),['frame-review:archive'])
  assert.equal(filterReviewCenterItems(items,{kind:'approval'}).some((item)=>item.id==='frame-review:renewal'),true)
  assert.equal(filterReviewCenterItems(items,{owner:'Finance'}).every((item)=>item.owner==='Finance'),true)
  const searched=filterReviewCenterItems(items,{query:'pipeline renewal finance'})
  assert.equal(searched.some((item)=>item.id==='frame-review:renewal'),true)
  assert.equal(searched.some((item)=>item.origin==='source-note'),false)
})

test('Review Center owner summary includes both native owners and source authors',()=>{
  const summary=summarizeReviewCenter(buildReviewCenterItems(workspace()))
  assert.equal(summary.owners.includes('Finance'),true)
  assert.equal(summary.owners.includes('Ossa'),true)
  assert.equal(summary.owners.includes('Alice'),true)
  assert.equal(summary.owners.includes('Maya'),true)
})
