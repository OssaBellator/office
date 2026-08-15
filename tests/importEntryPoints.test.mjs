import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

function source(relativePath){return readFileSync(new URL(relativePath,import.meta.url),'utf8')}

test('workspace Import routes local Office and Google Drive through dedicated product entrypoints',()=>{
  const dialog=source('../src/components/WorkspaceTransferDialog.tsx')
  assert.match(dialog,/window\.location\.assign\('\.\/office-import\.html'\)/)
  assert.match(dialog,/window\.location\.assign\('\.\/google-drive\.html'\)/)
  assert.match(dialog,/Macro\/control safety gate|reject macro\/control payloads/i)
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

test('Google Drive chooser uses the secure interoperability facade, not the raw Google planner',()=>{
  const chooser=source('../src/components/GoogleDriveImportDialog.tsx')
  assert.match(chooser,/planGoogleWorkspaceInteropImport/)
  assert.doesNotMatch(chooser,/planGoogleWorkspaceImport\(/)
})

test('production Vite build declares both import pages as HTML entrypoints',()=>{
  const config=source('../vite.config.ts')
  assert.match(config,/office-import\.html/)
  assert.match(config,/google-drive\.html/)
  assert.match(source('../office-import.html'),/office-import-main\.tsx/)
  assert.match(source('../google-drive.html'),/google-drive-main\.tsx/)
})
