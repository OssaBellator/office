import assert from 'node:assert/strict'
import test from 'node:test'
import { withImportedTables } from '../src/importedTables.ts'
import { cloneSeedWorkspace } from '../src/model.ts'
import { buildReviewHistory, reviewHistoryEntry } from '../src/reviewHistory.ts'

function state(note){return withImportedTables(cloneSeedWorkspace(),[{id:'table:pipeline',label:'Pipeline',source:'pipeline.xlsx',importedAt:'now',columns:[{id:'arr',label:'ARR',type:'number'}],rows:[{id:'row:1',values:{arr:2.4}}],...(note?{commentByCell:{'row:1\u0000arr':{text:note,author:'Alice'}}}:{})}])}
function transaction(id,before,after){return{id,summary:`Transaction ${id}`,command:{type:'source.status',sourceId:'source:finance',status:'live'},before,after}}

test('review history counts imported cell-note changes separately',()=>{
  const entry=reviewHistoryEntry(transaction('tx:1',state('Validate'),state('Validated')))
  assert.equal(entry.reviewChanges,1)
  assert.equal(entry.changedReviewFields.includes('ARR note'),true)
  assert.equal(entry.semanticChanges>=1,true)
})

test('review history returns latest transactions first and respects a limit',()=>{
  const transactions=[transaction('tx:1',state(null),state('One')),transaction('tx:2',state('One'),state('Two')),transaction('tx:3',state('Two'),state('Three'))]
  assert.deepEqual(buildReviewHistory(transactions,2).map((entry)=>entry.transactionId),['tx:3','tx:2'])
})
