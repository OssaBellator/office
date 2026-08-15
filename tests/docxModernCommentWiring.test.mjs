import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

async function source(path){return readFile(new URL(`../${path}`,import.meta.url),'utf8')}

test('DOCX comment importer preserves Microsoft modern reply resolution durable and UTC metadata',async()=>{
  const text=await source('src/docxCommentImport.ts')
  assert.match(text,/parseDocxCommentsExtended/)
  assert.match(text,/parseDocxCommentIds/)
  assert.match(text,/parseDocxCommentsExtensible/)
  assert.match(text,/paraIdParent/)
  assert.match(text,/durableId/)
  assert.match(text,/dateUtc/)
  assert.match(text,/parentSourceReviewId/)
  assert.match(text,/sourceByDurable/)
  assert.match(text,/resolveAnchor/)
})

test('workspace review codec owns optional Word thread metadata validation',async()=>{
  const model=await source('src/workspaceReviews.ts')
  const codec=await source('src/workspaceReviewCodec.ts')
  assert.match(model,/commentId\?:string/)
  assert.match(model,/paraId\?:string/)
  assert.match(model,/parentSourceReviewId\?:string/)
  assert.match(model,/durableId\?:string/)
  assert.match(model,/done\?:boolean/)
  assert.match(model,/dateUtc\?:string/)
  assert.match(codec,/paraId must be an 8-digit hexadecimal paragraph id/)
  assert.match(codec,/durableId must be an 8-digit hexadecimal durable id/)
})

test('Word source thread projection groups flat provenance without mutating source review',async()=>{
  const text=await source('src/wordReviewThreads.ts')
  assert.match(text,/getImportedWordReviewThreads/)
  assert.match(text,/parentSourceReviewId/)
  assert.match(text,/depth/)
  assert.match(text,/resolved:root\.sourceReview\.done===true/)
  assert.match(text,/summarizeImportedWordReview/)
})

test('durable identity regression changes ordinary Word comment id without detaching native review',async()=>{
  const text=await source('tests/docxModernCommentImport.test.mjs')
  assert.match(text,/rootId:'70'/)
  assert.match(text,/ROOT_DURABLE/)
  assert.match(text,/sourceReviewId,'word-comment:strategy\.docx:70'/)
  assert.match(text,/sourceDetached,undefined/)
})
