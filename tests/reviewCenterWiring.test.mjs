import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

async function source(path){return readFile(new URL(`../${path}`,import.meta.url),'utf8')}

test('Context launches workspace-wide Review Center without replacing the compact inbox',async()=>{
  const context=await source('src/components/ContextPanel.tsx')
  assert.match(context,/ReviewCenterDialog/)
  assert.match(context,/setReviewCenterOpen\(true\)/)
  assert.match(context,/Review center/)
  assert.match(context,/listWorkspaceReviewInbox/)
})

test('Review Center reuses governed native review lifecycle actions',async()=>{
  const dialog=await source('src/components/ReviewCenterDialog.tsx')
  assert.match(dialog,/buildReviewCenterItems/)
  assert.match(dialog,/filterReviewCenterItems/)
  assert.match(dialog,/planWorkspaceReviewStatusUpdate/)
  assert.match(dialog,/ReviewPromotionDialog/)
  assert.match(dialog,/ReviewRelinkDialog/)
  assert.match(dialog,/ReviewDetachDialog/)
  assert.match(dialog,/onSemanticCommand/)
})

test('Review Center query reads Docs canonical Data and source review from their authoritative stores',async()=>{
  const query=await source('src/reviewCenter.ts')
  assert.match(query,/listReviewInbox/)
  assert.match(query,/getWorkspaceReviews/)
  assert.match(query,/getImportedDataReviewItems/)
  assert.match(query,/getImportedThreadedReviewItems/)
  assert.match(query,/review archive/)
})
