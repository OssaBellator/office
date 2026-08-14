import assert from 'node:assert/strict'
import test from 'node:test'
import { cloneSeedWorkspace } from '../src/model.ts'
import { assertOfficeImportSafe, inspectOfficeImportSecurity } from '../src/officeImportSecurity.ts'
import { planSecureOfficeImport } from '../src/officeSecureImport.ts'

const encoder=new TextEncoder()
function u16(value){return[value&255,(value>>8)&255]}
function u32(value){return[value&255,(value>>8)&255,(value>>16)&255,(value>>24)&255]}
function zip(files){const locals=[],centrals=[];let offset=0;for(const[name,value]of Object.entries(files)){const n=encoder.encode(name),d=typeof value==='string'?encoder.encode(value):value,local=Uint8Array.from([...u32(0x04034b50),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(d.length),...u32(d.length),...u16(n.length),...u16(0),...n,...d]),central=Uint8Array.from([...u32(0x02014b50),...u16(20),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(d.length),...u32(d.length),...u16(n.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(offset),...n]);locals.push(local);centrals.push(central);offset+=local.length}const size=centrals.reduce((sum,item)=>sum+item.length,0),end=Uint8Array.from([...u32(0x06054b50),...u16(0),...u16(0),...u16(centrals.length),...u16(centrals.length),...u32(size),...u32(offset),...u16(0)]),out=new Uint8Array(offset+size+end.length);let cursor=0;for(const part of[...locals,...centrals,end]){out.set(part,cursor);cursor+=part.length}return out}

test('VBA macro projects are hard-rejected even when the package otherwise looks like DOCX',async()=>{
  const bytes=zip({'word/document.xml':'<w:document><w:body><w:p><w:r><w:t>Visible text</w:t></w:r></w:p></w:body></w:document>','word/vbaProject.bin':new Uint8Array([1,2,3])})
  const findings=await inspectOfficeImportSecurity(bytes)
  assert.equal(findings.some((finding)=>finding.kind==='vba'&&finding.severity==='reject'),true)
  await assert.rejects(()=>assertOfficeImportSafe(bytes),/VBA part word\/vbaProject\.bin/)
  await assert.rejects(()=>planSecureOfficeImport(cloneSeedWorkspace(),bytes,'renamed.docx'),/macro\/control-free/)
})

test('ActiveX controls are hard-rejected',async()=>{
  const bytes=zip({'xl/workbook.xml':'<workbook/>','xl/activeX/activeX1.bin':new Uint8Array([1])})
  await assert.rejects(()=>assertOfficeImportSafe(bytes),/ACTIVEX part/)
})

test('OLE/custom UI parts are notices rather than executed content',async()=>{
  const bytes=zip({'word/document.xml':'<w:document><w:body><w:p><w:r><w:t>Text</w:t></w:r></w:p></w:body></w:document>','word/embeddings/oleObject1.bin':new Uint8Array([1]),'customUI/customUI.xml':'<customUI/>'})
  const findings=await assertOfficeImportSafe(bytes)
  assert.equal(findings.some((finding)=>finding.kind==='ole'&&finding.severity==='notice'),true)
  assert.equal(findings.some((finding)=>finding.kind==='custom-ui'&&finding.severity==='notice'),true)
})
