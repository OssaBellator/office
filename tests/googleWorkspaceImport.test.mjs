import assert from 'node:assert/strict'
import test from 'node:test'
import { getGoogleWorkspaceExportFormat, planGoogleWorkspaceImport } from '../src/googleWorkspaceImport.ts'
import { cloneSeedWorkspace } from '../src/model.ts'

const encoder=new TextEncoder()
function u16(value){return[value&255,(value>>8)&255]}
function u32(value){return[value&255,(value>>8)&255,(value>>16)&255,(value>>24)&255]}
function storedZip(files){const locals=[],centrals=[];let offset=0;for(const[name,text]of Object.entries(files)){const n=encoder.encode(name),d=encoder.encode(text);const local=Uint8Array.from([...u32(0x04034b50),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(d.length),...u32(d.length),...u16(n.length),...u16(0),...n,...d]);const central=Uint8Array.from([...u32(0x02014b50),...u16(20),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(d.length),...u32(d.length),...u16(n.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(offset),...n]);locals.push(local);centrals.push(central);offset+=local.length}const size=centrals.reduce((sum,item)=>sum+item.length,0),eocd=Uint8Array.from([...u32(0x06054b50),...u16(0),...u16(0),...u16(centrals.length),...u16(centrals.length),...u32(size),...u32(offset),...u16(0)]),result=new Uint8Array(offset+size+eocd.length);let cursor=0;for(const item of[...locals,...centrals,eocd]){result.set(item,cursor);cursor+=item.length}return result}

test('Google Workspace kinds map to standard Office export formats',()=>{
  assert.equal(getGoogleWorkspaceExportFormat('document').extension,'docx')
  assert.equal(getGoogleWorkspaceExportFormat('spreadsheet').extension,'xlsx')
  assert.equal(getGoogleWorkspaceExportFormat('presentation').extension,'pptx')
})

test('direct Google Docs provider output uses the same semantic DOCX planner',async()=>{
  const calls=[]
  const provider={exportFile:async(request)=>{calls.push(request);return storedZip({'word/document.xml':'<w:document><w:body><w:p><w:r><w:t>Imported from Google Docs</w:t></w:r></w:p></w:body></w:document>'})}}
  const plan=await planGoogleWorkspaceImport(cloneSeedWorkspace(),{id:'google-file-1',name:'Strategy',kind:'document'},provider)
  assert.equal(calls[0].fileId,'google-file-1')
  assert.match(calls[0].mimeType,/wordprocessingml/)
  assert.equal(plan.kind,'docx')
  assert.equal(plan.commands[0].block.text,'Imported from Google Docs')
})
