import assert from 'node:assert/strict'
import test from 'node:test'
import { cloneSeedWorkspace } from '../src/model.ts'
import { readOfficeZip } from '../src/officeArchive.ts'
import { exportWorkspaceOfficeSetWithManifest, FRAME_INTEROP_MANIFEST_PATH, readFrameInteropManifest } from '../src/officeInteropManifest.ts'
import { stripFrameInteropManifest } from '../src/officeInteropManifestStrip.ts'
import { validateOfficePackage } from '../src/officePackageValidator.ts'

test('internal Frame manifests can be stripped into normal valid Office packages',async()=>{
  const workspace=cloneSeedWorkspace()
  for(const internal of exportWorkspaceOfficeSetWithManifest(workspace)){
    assert.ok(await readFrameInteropManifest(internal.bytes))
    const external=stripFrameInteropManifest(internal)
    assert.equal((await readOfficeZip(external.bytes)).has(FRAME_INTEROP_MANIFEST_PATH),false)
    assert.equal(await readFrameInteropManifest(external.bytes),null)
    const validation=await validateOfficePackage(external.bytes)
    assert.equal(validation.valid,true,validation.issues.map((issue)=>issue.detail).join('; '))
  }
})

test('stripping is idempotent for normal manifest-free Office exports',()=>{
  const internal=exportWorkspaceOfficeSetWithManifest(cloneSeedWorkspace())[0]
  const once=stripFrameInteropManifest(internal)
  const twice=stripFrameInteropManifest(once)
  assert.deepEqual([...twice.bytes],[...once.bytes])
})
