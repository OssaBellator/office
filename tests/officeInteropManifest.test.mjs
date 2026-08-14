import assert from 'node:assert/strict'
import test from 'node:test'
import { withImportedTables } from '../src/importedTables.ts'
import { cloneSeedWorkspace } from '../src/model.ts'
import { exportWorkspaceOfficeSetWithManifest, FRAME_INTEROP_MANIFEST_PATH, readFrameInteropManifest } from '../src/officeInteropManifest.ts'
import { readOfficeZip } from '../src/officeArchive.ts'
import { validateOfficePackage } from '../src/officePackageValidator.ts'
import { getSemanticDocument, withSemanticDocument } from '../src/semanticDocument.ts'

test('Frame Office exports can carry a standards-covered interoperability manifest part',async()=>{
  let workspace=cloneSeedWorkspace()
  const semantic=getSemanticDocument(workspace)
  semantic.blocks.push({id:'block:manifest-source',type:'paragraph',text:'Imported source',source:'legacy.docx'})
  workspace=withSemanticDocument(workspace,semantic)
  workspace=withImportedTables(workspace,[{id:'table:manifest',label:'Pipeline',source:'pipeline.xlsx',importedAt:'now',columns:[{id:'arr',label:'ARR',type:'number'}],rows:[{id:'row:1',values:{arr:2.4}}],formulaByCell:{'row:1\u0000arr':'1.2+1.2'}}])

  for(const file of exportWorkspaceOfficeSetWithManifest(workspace)){
    const entries=await readOfficeZip(file.bytes)
    assert.equal(entries.has(FRAME_INTEROP_MANIFEST_PATH),true)
    const validation=await validateOfficePackage(file.bytes)
    assert.equal(validation.valid,true,validation.issues.map((issue)=>issue.detail).join('; '))
    const manifest=await readFrameInteropManifest(file.bytes)
    assert.equal(manifest.generator,'Frame')
    assert.equal(manifest.workspaceTitle,workspace.title)
    assert.equal(manifest.workspaceFingerprint.startsWith('workspace:'),true)
    assert.equal(manifest.semanticDocument.blocks.some((block)=>block.id==='block:manifest-source'),true)
    assert.equal(manifest.importedTables[0].formulaByCell['row:1\u0000arr'],'1.2+1.2')
  }
})

test('manifest kind follows the Office projection',async()=>{
  const workspace=cloneSeedWorkspace()
  const files=exportWorkspaceOfficeSetWithManifest(workspace)
  assert.deepEqual(await Promise.all(files.map(async(file)=>(await readFrameInteropManifest(file.bytes)).kind)),['docx','pptx','xlsx'])
})
