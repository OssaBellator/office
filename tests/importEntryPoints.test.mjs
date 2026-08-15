import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

function source(relativePath){return readFileSync(new URL(relativePath,import.meta.url),'utf8')}

test('workspace routes Office export, secure Office import, and Google Drive through dedicated product entrypoints',()=>{
  const dialog=source('../src/components/WorkspaceTransferDialog.tsx')
  assert.match(dialog,/window\.location\.assign\('\.\/office-export\.html'\)/)
  assert.match(dialog,/window\.location\.assign\('\.\/office-import\.html'\)/)
  assert.match(dialog,/window\.location\.assign\('\.\/google-drive\.html'\)/)
  assert.match(dialog,/Macro\/control safety gate|reject macro\/control payloads/i)
  assert.match(dialog,/Review fidelity decisions/i)
})

test('secure Office import page stages governed semantic changes and persists the shared session',()=>{
  const page=source('../src/OfficeImportPage.tsx')
  assert.match(page,/planSecureOfficeImport/)
  assert.match(page,/supportedLocalOfficeAccept/)
  assert.match(page,/planGovernedAutomation/)
  assert.match(page,/approveAutomation/)
  assert.match(page,/executeGovernedAutomation/)
  assert.match(page,/SESSION_STORAGE_KEY/)
  assert.match(page,/LEGACY_WORKSPACE_STORAGE_KEY/)
  assert.doesNotMatch(page,/planOfficeImport\(/)
})

test('Office export page assesses fidelity before generating clean compatibility files',()=>{
  const page=source('../src/OfficeExportPage.tsx')
  assert.match(page,/assessOfficeExport/)
  assert.match(page,/exportWorkspaceDocx/)
  assert.match(page,/exportWorkspacePptx/)
  assert.match(page,/exportWorkspaceXlsx/)
  assert.match(page,/suppressedDateLikeFormatCells/)
  assert.match(page,/do not carry hidden Frame-only manifest metadata/i)
})

test('Google Drive chooser uses the secure interoperability facade, not the raw Google planner',()=>{
  const chooser=source('../src/components/GoogleDriveImportDialog.tsx')
  assert.match(chooser,/planGoogleWorkspaceInteropImport/)
  assert.doesNotMatch(chooser,/planGoogleWorkspaceImport\(/)
})

test('production Vite build declares all interoperability HTML entrypoints',()=>{
  const config=source('../vite.config.ts')
  assert.match(config,/office-export\.html/)
  assert.match(config,/office-import\.html/)
  assert.match(config,/google-drive\.html/)
  assert.match(source('../office-export.html'),/office-export-main\.tsx/)
  assert.match(source('../office-import.html'),/office-import-main\.tsx/)
  assert.match(source('../google-drive.html'),/google-drive-main\.tsx/)
})
