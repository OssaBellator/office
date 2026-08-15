import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

async function source(path){return readFile(new URL(`../${path}`,import.meta.url),'utf8')}

test('live review workflows use canonical workspace review storage rather than table ownership',async()=>{
  for(const path of ['src/reviewPromotion.ts','src/reviewRelink.ts','src/reviewDetach.ts','src/workspaceReviewInbox.ts','src/workspaceReviewCompare.ts','src/components/ImportedTablesPanel.tsx']){
    const text=await source(path)
    assert.match(text,/getWorkspaceReviews|review\.workspace\.replace/)
    assert.doesNotMatch(text,/table\.promotedReviews|promotedReviews:\[/,`${path} should not own new native review inside Imported Data`)
  }
})

test('legacy promotedReviews remains isolated to migration and compatibility boundaries',async()=>{
  const tables=await source('src/importedTables.ts')
  const codec=await source('src/importedTableCodec.ts')
  const reviews=await source('src/workspaceReviews.ts')
  const commands=await source('src/semanticCommands.ts')
  assert.match(tables,/promotedReviews\?/)
  assert.match(codec,/promotedReviews/)
  assert.match(reviews,/legacyTableReviews/)
  assert.match(reviews,/promotedReviews:_legacy/)
  assert.match(commands,/legacyReviews/)
})

test('source synchronization emits separate Data and native review commands',async()=>{
  const sync=await source('src/officeImportSync.ts')
  assert.match(sync,/data\.imported\.replace/)
  assert.match(sync,/review\.workspace\.replace/)
  assert.match(sync,/synchronizeNativeReviews/)
  assert.match(sync,/insertReviewCommand/)
  assert.match(sync,/review archive/)
})
