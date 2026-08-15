import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

async function source(path){return readFile(new URL(`../${path}`,import.meta.url),'utf8')}

test('canonical Office interop pipeline enriches classic Excel cell notes',async()=>{
  const text=await source('src/officeInteropImport.ts')
  assert.match(text,/preserveXlsxCommentMetadata/)
  assert.match(text,/const withComments=await preserveXlsxCommentMetadata\(workspace,input,fileName,withLinks\)/)
  assert.match(text,/preserveXlsxSharedFormulaMetadata\(input,fileName,withComments\)/)
})

test('semantic history uses the review-aware workspace comparator',async()=>{
  const text=await source('src/components/HistoryBrowser.tsx')
  assert.match(text,/compareWorkspaceStatesWithReview/)
  assert.doesNotMatch(text,/compareWorkspaceStates\(selected\.transaction\.before/)
})

test('imported Data cells render classic-note review provenance',async()=>{
  const text=await source('src/components/ImportedTablesPanel.tsx')
  assert.match(text,/getImportedTableComment/)
  assert.match(text,/imported-note-badge/)
  assert.match(text,/MessageSquareText/)
})

test('Office export preflight exposes Frame-only review-note count',async()=>{
  const assessment=await source('src/officeExportAssessment.ts')
  const page=await source('src/OfficeExportPage.tsx')
  assert.match(assessment,/reviewNoteCells/)
  assert.match(assessment,/default XLSX compatibility projection/)
  assert.match(page,/Frame review notes/)
  assert.match(page,/assessment\.xlsx\.reviewNoteCells/)
})

test('runtime imported-table codec owns classic-note validation',async()=>{
  const commandCodec=await source('src/commandCodec.ts')
  const tableCodec=await source('src/importedTableCodec.ts')
  assert.match(commandCodec,/parseImportedDataTable/)
  assert.match(tableCodec,/commentByCell/)
  assert.match(tableCodec,/parseComment/)
})
