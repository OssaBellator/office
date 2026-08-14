import assert from 'node:assert/strict'
import test from 'node:test'
import { cloneSeedWorkspace } from '../src/model.ts'
import { createStoredZip, exportWorkspaceDocx, exportWorkspacePptx, exportWorkspaceXlsx } from '../src/officeExport.ts'
import { validateOfficePackage } from '../src/officePackageValidator.ts'

test('all Frame Office compatibility exports have complete OPC relationships and content types',async()=>{
  const workspace=cloneSeedWorkspace()
  for(const file of [exportWorkspaceDocx(workspace),exportWorkspacePptx(workspace),exportWorkspaceXlsx(workspace)]){
    const validation=await validateOfficePackage(file.bytes)
    assert.equal(validation.valid,true,`${file.filename}: ${validation.issues.map((issue)=>issue.detail).join('; ')}`)
    assert.equal(validation.partCount>3,true)
    assert.equal(validation.relationshipCount>0,true)
  }
})

test('OPC validator reports missing relationship targets',async()=>{
  const broken=createStoredZip({
    '[Content_Types].xml':'<Types><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/></Types>',
    '_rels/.rels':'<Relationships><Relationship Id="rId1" Target="word/document.xml"/></Relationships>',
  })
  const validation=await validateOfficePackage(broken)
  assert.equal(validation.valid,false)
  assert.equal(validation.issues.some((issue)=>issue.kind==='missing-relationship-target'&&/word\/document\.xml/.test(issue.detail)),true)
})

test('OPC validator reports duplicate relationship ids and uncovered parts',async()=>{
  const broken=createStoredZip({
    '[Content_Types].xml':'<Types><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/></Types>',
    '_rels/.rels':'<Relationships><Relationship Id="rId1" Target="a.bin"/><Relationship Id="rId1" Target="b.bin"/></Relationships>',
    'a.bin':new Uint8Array([1]),
    'b.bin':new Uint8Array([2]),
  })
  const validation=await validateOfficePackage(broken)
  assert.equal(validation.issues.some((issue)=>issue.kind==='duplicate-relationship-id'),true)
  assert.equal(validation.issues.filter((issue)=>issue.kind==='missing-content-type').length,2)
})
