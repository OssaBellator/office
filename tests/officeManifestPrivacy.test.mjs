import assert from 'node:assert/strict'
import test from 'node:test'
import { cloneSeedWorkspace } from '../src/model.ts'
import { exportWorkspaceDocx, exportWorkspacePptx, exportWorkspaceXlsx } from '../src/officeExport.ts'
import { readOfficeZip } from '../src/officeArchive.ts'
import { FRAME_INTEROP_MANIFEST_PATH, exportWorkspaceOfficeSetWithManifest } from '../src/officeInteropManifest.ts'

test('normal external Office exports do not embed hidden Frame semantic manifests',async()=>{
  const workspace=cloneSeedWorkspace()
  for(const file of [exportWorkspaceDocx(workspace),exportWorkspacePptx(workspace),exportWorkspaceXlsx(workspace)]){
    const entries=await readOfficeZip(file.bytes)
    assert.equal(entries.has(FRAME_INTEROP_MANIFEST_PATH),false,file.filename)
  }
})

test('manifest-bearing Office packages require the explicit internal round-trip API',async()=>{
  const workspace=cloneSeedWorkspace()
  for(const file of exportWorkspaceOfficeSetWithManifest(workspace)){
    const entries=await readOfficeZip(file.bytes)
    assert.equal(entries.has(FRAME_INTEROP_MANIFEST_PATH),true,file.filename)
  }
})
