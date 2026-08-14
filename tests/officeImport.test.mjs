import assert from 'node:assert/strict'
import test from 'node:test'
import { cloneSeedWorkspace } from '../src/model.ts'
import { planDocxImport, planPptxImport, planXlsxImport } from '../src/officeImportPlanner.ts'

const encoder = new TextEncoder()
function u16(value){return [value&255,(value>>8)&255]}
function u32(value){return [value&255,(value>>8)&255,(value>>16)&255,(value>>24)&255]}
function storedZip(files){
  const locals=[],centrals=[];let offset=0
  for(const [name,text] of Object.entries(files)){
    const nameBytes=encoder.encode(name),data=encoder.encode(text)
    const local=Uint8Array.from([...u32(0x04034b50),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(data.length),...u32(data.length),...u16(nameBytes.length),...u16(0),...nameBytes,...data])
    const central=Uint8Array.from([...u32(0x02014b50),...u16(20),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(data.length),...u32(data.length),...u16(nameBytes.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(offset),...nameBytes])
    locals.push(local);centrals.push(central);offset+=local.length
  }
  const centralSize=centrals.reduce((sum,item)=>sum+item.length,0)
  const eocd=Uint8Array.from([...u32(0x06054b50),...u16(0),...u16(0),...u16(centrals.length),...u16(centrals.length),...u32(centralSize),...u32(offset),...u16(0)])
  const result=new Uint8Array(offset+centralSize+eocd.length);let cursor=0
  for(const item of [...locals,...centrals,eocd]){result.set(item,cursor);cursor+=item.length}
  return result
}

test('DOCX import becomes editable semantic document blocks with structure cues', async()=>{
  const bytes=storedZip({
    'word/document.xml':'<w:document><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Imported strategy</w:t></w:r></w:p><w:p><w:r><w:t>Body text</w:t></w:r></w:p></w:body></w:document>',
    'word/numbering.xml':'<w:numbering/>',
  })
  const plan=await planDocxImport(cloneSeedWorkspace(),bytes,'strategy.docx')
  assert.equal(plan.kind,'docx');assert.equal(plan.commands.length,2)
  assert.equal(plan.commands[0].block.style,'heading-1')
  assert.equal(plan.commands[1].block.text,'Body text')
})

test('PPTX import appends true presentation scenes with body and source attribution',async()=>{
  const bytes=storedZip({
    'ppt/slides/slide1.xml':'<p:sld><p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><a:p><a:r><a:t>Imported deck</a:t></a:r></a:p></p:sp><p:sp><a:p><a:r><a:t>First point</a:t></a:r></a:p></p:sp></p:sld>',
    'ppt/notesSlides/notesSlide1.xml':'<a:t>Speaker cue</a:t>',
  })
  const plan=await planPptxImport(cloneSeedWorkspace(),bytes,'board.pptx')
  assert.equal(plan.commands.length,1);const state=plan.commands[0].value
  assert.equal(state.importedScenes.length,1);assert.equal(state.importedScenes[0].title,'Imported deck')
  assert.deepEqual(state.importedScenes[0].body,['First point']);assert.equal(state.order.at(-1),state.importedScenes[0].id)
})

test('XLSX import maps compatible actual and plan sheets to semantic row updates',async()=>{
  const bytes=storedZip({
    'xl/workbook.xml':'<workbook><sheets><sheet name="Actuals" sheetId="1" r:id="rId1"/><sheet name="Plan" sheetId="2" r:id="rId2"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels':'<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="worksheets/sheet2.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml':'<worksheet><sheetData><row><c r="A1" t="inlineStr"><is><t>Region</t></is></c><c r="B1" t="inlineStr"><is><t>Revenue</t></is></c><c r="C1" t="inlineStr"><is><t>Growth</t></is></c><c r="D1" t="inlineStr"><is><t>Margin</t></is></c></row><row><c r="A2" t="inlineStr"><is><t>APAC</t></is></c><c r="B2"><v>10</v></c><c r="C2"><v>0.32</v></c><c r="D2"><v>0.69</v></c></row></sheetData></worksheet>',
    'xl/worksheets/sheet2.xml':'<worksheet><sheetData><row><c r="A1" t="inlineStr"><is><t>Region</t></is></c><c r="B1" t="inlineStr"><is><t>Revenue</t></is></c></row><row><c r="A2" t="inlineStr"><is><t>APAC</t></is></c><c r="B2"><v>10.5</v></c></row></sheetData></worksheet>',
  })
  const plan=await planXlsxImport(cloneSeedWorkspace(),bytes,'model.xlsx')
  assert.equal(plan.commands.some((command)=>command.type==='region.update'&&command.field==='growth'&&command.value===32),true)
  assert.equal(plan.commands.some((command)=>command.type==='plan.update'&&command.value===10.5),true)
})

test('Google pointer files are rejected with an export instruction instead of being treated as content',async()=>{
  const { planOfficeImport }=await import('../src/officeImportPlanner.ts')
  await assert.rejects(()=>planOfficeImport(cloneSeedWorkspace(),new Uint8Array(),'strategy.gdoc'),/File → Download/)
})
