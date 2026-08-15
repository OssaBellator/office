import assert from 'node:assert/strict'
import test from 'node:test'
import { cloneSeedWorkspace } from '../src/model.ts'
import { getImportedWordReviewThreads, summarizeImportedWordReview } from '../src/wordReviewThreads.ts'
import { withWorkspaceReviews } from '../src/workspaceReviews.ts'

function source(id,body,author,sourceReview){return{id:`source-review:${id}`,objectId:'block:imported',label:sourceReview.parentSourceReviewId?'Word reply · Imported':'Word comment · Imported',kind:'comment',body,owner:author,status:'open',createdAt:sourceReview.dateUtc??'source',sourceOnly:true,sourceReview:{kind:'word-comment',source:'strategy.docx',blockId:'block:imported',sourceReviewId:id,...sourceReview}}}

test('Word source review projection groups replies under roots and exposes resolution state',()=>{
  const root=source('word-comment:strategy.docx:7','Confirm revenue','Alice',{commentId:'7',paraId:'11111111',durableId:'AAAA0001',done:true,dateUtc:'2026-08-15T03:01:00Z'})
  const reply=source('word-comment:strategy.docx:8','Validated','Bob',{commentId:'8',paraId:'22222222',durableId:'BBBB0002',parentSourceReviewId:'word-comment:strategy.docx:7',done:false,dateUtc:'2026-08-15T03:04:00Z'})
  const workspace=withWorkspaceReviews(cloneSeedWorkspace(),[reply,root])
  const threads=getImportedWordReviewThreads(workspace)
  assert.equal(threads.length,1)
  assert.equal(threads[0].root.sourceReviewId,'word-comment:strategy.docx:7')
  assert.equal(threads[0].resolved,true)
  assert.equal(threads[0].replyCount,1)
  assert.deepEqual(threads[0].participants,['Alice','Bob'])
  assert.deepEqual(threads[0].messages.map((message)=>message.depth),[0,1])
  assert.equal(threads[0].messages[1].parentSourceReviewId,'word-comment:strategy.docx:7')
  assert.equal(threads[0].messages[1].durableId,'BBBB0002')
})

test('missing parent and parent cycles are kept as conservative roots instead of guessed threads',()=>{
  const missing=source('word-comment:strategy.docx:9','Orphan reply','Carol',{commentId:'9',paraId:'33333333',parentSourceReviewId:'word-comment:strategy.docx:404'})
  const cycleA=source('word-comment:strategy.docx:10','Cycle A','Dan',{commentId:'10',paraId:'44444444',parentSourceReviewId:'word-comment:strategy.docx:11'})
  const cycleB=source('word-comment:strategy.docx:11','Cycle B','Erin',{commentId:'11',paraId:'55555555',parentSourceReviewId:'word-comment:strategy.docx:10'})
  const workspace=withWorkspaceReviews(cloneSeedWorkspace(),[missing,cycleA,cycleB])
  const threads=getImportedWordReviewThreads(workspace)
  assert.equal(threads.some((thread)=>thread.messages.some((message)=>message.id===missing.id)),true)
  assert.equal(threads.reduce((sum,thread)=>sum+thread.messages.length,0),3)
})

test('Word source review summary counts threads replies participants and sources',()=>{
  const root=source('word-comment:strategy.docx:7','Root','Alice',{done:false})
  const reply=source('word-comment:strategy.docx:8','Reply','Bob',{parentSourceReviewId:'word-comment:strategy.docx:7'})
  const second=source('word-comment:strategy.docx:12','Second root','Alice',{done:true})
  const workspace=withWorkspaceReviews(cloneSeedWorkspace(),[root,reply,second])
  assert.deepEqual(summarizeImportedWordReview(workspace),{threads:2,comments:3,open:1,resolved:1,replies:1,participants:['Alice','Bob'],sources:['strategy.docx']})
})
