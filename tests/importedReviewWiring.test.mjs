import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

async function source(path){return readFile(new URL(`../${path}`,import.meta.url),'utf8')}

test('canonical Office interop pipeline enriches classic notes then threaded Excel review before shared formulas',async()=>{
  const text=await source('src/officeInteropImport.ts')
  assert.match(text,/preserveXlsxCommentMetadata/)
  assert.match(text,/preserveXlsxThreadedCommentMetadata/)
  assert.match(text,/const withComments=await preserveXlsxCommentMetadata\(workspace,input,fileName,withLinks\)/)
  assert.match(text,/const withThreads=await preserveXlsxThreadedCommentMetadata\(workspace,input,fileName,withComments\)/)
  assert.match(text,/preserveXlsxSharedFormulaMetadata\(input,fileName,withThreads\)/)
})

test('semantic history uses the review-aware workspace comparator',async()=>{
  const browser=await source('src/components/HistoryBrowser.tsx')
  const revert=await source('src/revert.ts')
  assert.match(browser,/compareWorkspaceStatesWithReview/)
  assert.doesNotMatch(browser,/compareWorkspaceStates\(selected\.transaction\.before/)
  assert.match(revert,/compareWorkspaceStatesWithReview/)
})

test('imported Data cells render classic-note and threaded-review provenance',async()=>{
  const text=await source('src/components/ImportedTablesPanel.tsx')
  assert.match(text,/getImportedTableComment/)
  assert.match(text,/getImportedTableThread/)
  assert.match(text,/imported-note-badge/)
  assert.match(text,/imported-thread-badge/)
  assert.match(text,/MessageSquareText/)
})

test('Office export preflight exposes Frame-only note and thread counts',async()=>{
  const assessment=await source('src/officeExportAssessment.ts')
  const page=await source('src/OfficeExportPage.tsx')
  assert.match(assessment,/reviewNoteCells/)
  assert.match(assessment,/reviewThreadCells/)
  assert.match(assessment,/threadedComments/)
  assert.match(assessment,/rather than flattened into legacy notes/)
  assert.match(page,/Legacy review notes/)
  assert.match(page,/Review threads/)
  assert.match(page,/assessment\.xlsx\.reviewThreadCells/)
})

test('runtime imported-table codec owns note and threaded-review validation',async()=>{
  const commandCodec=await source('src/commandCodec.ts')
  const tableCodec=await source('src/importedTableCodec.ts')
  assert.match(commandCodec,/parseImportedDataTable/)
  assert.match(tableCodec,/commentByCell/)
  assert.match(tableCodec,/threadByCell/)
  assert.match(tableCodec,/parseImportedCellComment/)
  assert.match(tableCodec,/parseReviewThread/)
})

test('unified Context review inbox distinguishes source notes from source threads',async()=>{
  const inbox=await source('src/workspaceReviewInbox.ts')
  const context=await source('src/components/ContextPanel.tsx')
  assert.match(inbox,/source-thread/)
  assert.match(inbox,/importedOpenThreads/)
  assert.match(context,/source thread/)
  assert.match(context,/importedThreadComments/)
})
