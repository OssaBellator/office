import assert from 'node:assert/strict'
import test from 'node:test'
import { getImportedDataReviewItems, summarizeImportedDataReview, tableReviewItems } from '../src/importedDataReview.ts'
import { withImportedTables } from '../src/importedTables.ts'
import { cloneSeedWorkspace } from '../src/model.ts'

function table(){return{id:'table:pipeline',label:'Pipeline',source:'pipeline.xlsx',importedAt:'now',columns:[{id:'account',label:'Account',type:'text'},{id:'arr',label:'ARR',type:'number'}],rows:[{id:'row:1',values:{account:'Acme',arr:2.4}},{id:'row:2',values:{account:'Nova',arr:1.1}}],commentByCell:{'row:1\u0000arr':{text:'Validate renewal assumption',author:'Alice'},'row:2\u0000account':{text:'Confirm legal entity',author:'Bob'}}}}

test('imported cell notes expose review items with cell context',()=>{
  const items=tableReviewItems(table())
  assert.equal(items.length,2)
  assert.deepEqual(items[0],{id:'review:table:pipeline:row:1:arr',tableId:'table:pipeline',tableLabel:'Pipeline',source:'pipeline.xlsx',rowId:'row:1',columnId:'arr',columnLabel:'ARR',value:2.4,author:'Alice',text:'Validate renewal assumption'})
})

test('workspace review summary groups note provenance by source author and table',()=>{
  const workspace=withImportedTables(cloneSeedWorkspace(),[table()])
  assert.equal(getImportedDataReviewItems(workspace).length,2)
  assert.deepEqual(summarizeImportedDataReview(workspace),{total:2,sources:['pipeline.xlsx'],authors:['Alice','Bob'],tables:['Pipeline']})
})
