import assert from 'node:assert/strict'
import test from 'node:test'
import { detectOfficePackageKind, normalizedOfficeFileName, officeKindFromFileName } from '../src/officeKindDetection.ts'
import { planDetectedOfficeImport } from '../src/officeDetectedImport.ts'
import { cloneSeedWorkspace } from '../src/model.ts'

const encoder=new TextEncoder()
function u16(value){return[value&255,(value>>8)&255]}
function u32(value){return[value&255,(value>>8)&255,(value>>16)&255,(value>>24)&255]}
function zip(files){const locals=[],centrals=[];let offset=0;for(const[name,text]of Object.entries(files)){const n=encoder.encode(name),d=encoder.encode(text),local=Uint8Array.from([...u32(0x04034b50),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(d.length),...u32(d.length),...u16(n.length),...u16(0),...n,...d]),central=Uint8Array.from([...u32(0x02014b50),...u16(20),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(d.length),...u32(d.length),...u16(n.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(offset),...n]);locals.push(local);centrals.push(central);offset+=local.length}const size=centrals.reduce((sum,item)=>sum+item.length,0),end=Uint8Array.from([...u32(0x06054b50),...u16(0),...u16(0),...u16(centrals.length),...u16(centrals.length),...u32(size),...u32(offset),...u16(0)]),out=new Uint8Array(offset+size+end.length);let cursor=0;for(const part of[...locals,...centrals,end]){out.set(part,cursor);cursor+=part.length}return out}

test('Office kind detection uses characteristic OOXML parts',async()=>{
  assert.equal((await detectOfficePackageKind(zip({'word/document.xml':'<w:document/>'}))).kind,'docx')
  assert.equal((await detectOfficePackageKind(zip({'ppt/presentation.xml':'<p:presentation/>'}))).kind,'pptx')
  assert.equal((await detectOfficePackageKind(zip({'xl/workbook.xml':'<workbook/>'}))).kind,'xlsx')
})

test('Office kind detection rejects ambiguous package structures',async()=>{
  await assert.rejects(()=>detectOfficePackageKind(zip({'word/document.xml':'<w:document/>','xl/workbook.xml':'<workbook/>'})),/ambiguous/)
})

test('filename helpers normalize wrong or missing extensions without changing correct names',()=>{
  assert.equal(officeKindFromFileName('report.DOCX'),'docx')
  assert.equal(officeKindFromFileName('report.zip'),null)
  assert.equal(normalizedOfficeFileName('report.zip','docx'),'report.docx')
  assert.equal(normalizedOfficeFileName('report','xlsx'),'report.xlsx')
  assert.equal(normalizedOfficeFileName('deck.pptx','pptx'),'deck.pptx')
})

test('detected import corrects a misleading extension and still produces semantic commands',async()=>{
  const bytes=zip({'word/document.xml':'<w:document><w:body><w:p><w:r><w:t>Renamed strategy</w:t></w:r></w:p></w:body></w:document>'})
  const plan=await planDetectedOfficeImport(cloneSeedWorkspace(),bytes,'strategy.xlsx')
  assert.equal(plan.kind,'docx')
  assert.equal(plan.detectedFileName,'strategy.docx')
  assert.equal(plan.fileNameCorrected,true)
  assert.equal(plan.commands.some((command)=>command.type==='document.block.insert'&&command.block.text==='Renamed strategy'),true)
  assert.equal(plan.warnings[0].includes('filename declares .xlsx'),true)
})
