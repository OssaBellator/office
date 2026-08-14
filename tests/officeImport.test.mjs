import assert from 'node:assert/strict'
import test from 'node:test'
import { deflateRawSync } from 'node:zlib'
import { cloneSeedWorkspace } from '../src/model.ts'
import { planDocxImport, planPptxImport, planXlsxImport } from '../src/officeImportPlanner.ts'

const encoder = new TextEncoder()
function u16(value){return [value&255,(value>>8)&255]}
function u32(value){return [value&255,(value>>8)&255,(value>>16)&255,(value>>24)&255]}
function zip(files,{deflate=false}={}){
  const locals=[],centrals=[];let offset=0
  for(const [name,text] of Object.entries(files)){
    const nameBytes=encoder.encode(name),raw=encoder.encode(text),data=deflate?new Uint8Array(deflateRawSync(raw)):raw,method=deflate?8:0
    const local=Uint8Array.from([...u32(0x04034b50),...u16(20),...u16(0),...u16(method),...u16(0),...u16(0),...u32(0),...u32(data.length),...u32(raw.length),...u16(nameBytes.length),...u16(0),...nameBytes,...data])
    const central=Uint8Array.from([...u32(0x02014b50),...u16(20),...u16(20),...u16(0),...u16(method),...u16(0),...u16(0),...u32(0),...u32(data.length),...u32(raw.length),...u16(nameBytes.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(offset),...nameBytes])
    locals.push(local);centrals.push(central);offset+=local.length
  }
  const centralSize=centrals.reduce((sum,item)=>sum+item.length,0)
  const eocd=Uint8Array.from([...u32(0x06054b50),...u16(0),...u16(0),...u16(centrals.length),...u16(centrals.length),...u32(centralSize),...u32(offset),...u16(0)])
  const result=new Uint8Array(offset+centralSize+eocd.length);let cursor=0
  for(const item of [...locals,...centrals,eocd]){result.set(item,cursor);cursor+=item.length}
  return result
}

test('DOCX import becomes editable semantic document blocks with Word and Google structure cues', async()=>{
  const bytes=zip({
    'word/document.xml':'<w:document><w:body><w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>Imported strategy</w:t></w:r></w:p><w:p><w:pPr><w:pStyle w:val="Subtitle"/></w:pPr><w:r><w:t>Operating model</w:t></w:r></w:p><w:p><w:r><w:t>Body text</w:t></w:r></w:p></w:body></w:document>',
    'word/numbering.xml':'<w:numbering/>',
  },{deflate:true})
  const plan=await planDocxImport(cloneSeedWorkspace(),bytes,'strategy.docx')
  assert.equal(plan.kind,'docx');assert.equal(plan.commands.length,3)
  assert.equal(plan.commands[0].block.style,'heading-1')
  assert.equal(plan.commands[1].block.style,'heading-2')
  assert.equal(plan.commands[2].block.text,'Body text')
})

test('PPTX import follows presentation relationship order and resolves slide notes',async()=>{
  const bytes=zip({
    'ppt/presentation.xml':'<p:presentation><p:sldIdLst><p:sldId id="256" r:id="rId2"/><p:sldId id="257" r:id="rId1"/></p:sldIdLst></p:presentation>',
    'ppt/_rels/presentation.xml.rels':'<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/></Relationships>',
    'ppt/slides/slide1.xml':'<p:sld><p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><a:p><a:r><a:t>Second slide</a:t></a:r></a:p></p:sp></p:sld>',
    'ppt/slides/slide2.xml':'<p:sld><p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><a:p><a:r><a:t>First slide</a:t></a:r></a:p></p:sp><p:sp><a:p><a:r><a:t>First point</a:t></a:r></a:p></p:sp></p:sld>',
    'ppt/slides/_rels/slide2.xml.rels':'<Relationships><Relationship Id="rIdNotes" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide9.xml"/></Relationships>',
    'ppt/notesSlides/notesSlide9.xml':'<a:t>Speaker cue</a:t>',
  },{deflate:true})
  const plan=await planPptxImport(cloneSeedWorkspace(),bytes,'board.pptx')
  assert.equal(plan.commands.length,1);const state=plan.commands[0].value
  assert.equal(state.importedScenes.length,2);assert.equal(state.importedScenes[0].title,'First slide')
  assert.deepEqual(state.importedScenes[0].body,['First point']);assert.equal(state.importedScenes[0].note,'Speaker cue')
  assert.equal(state.importedScenes[1].title,'Second slide')
})

test('PPTX and DOCX imports surface unsupported media as explicit warnings',async()=>{
  const ppt=await planPptxImport(cloneSeedWorkspace(),zip({'ppt/slides/slide1.xml':'<p:sld><p:sp><a:p><a:r><a:t>Slide</a:t></a:r></a:p></p:sp></p:sld>','ppt/media/image1.png':'binary'}),'media.pptx')
  assert.equal(ppt.warnings.some((warning)=>/images and media/.test(warning)),true)
  const doc=await planDocxImport(cloneSeedWorkspace(),zip({'word/document.xml':'<w:document><w:body><w:p><w:r><w:t>Text</w:t></w:r></w:p></w:body></w:document>','word/media/image1.png':'binary'}),'media.docx')
  assert.equal(doc.warnings.some((warning)=>/images/.test(warning)),true)
})

test('XLSX import maps compatible actual and plan sheets to semantic row updates and warns about cached formulas',async()=>{
  const bytes=zip({
    'xl/workbook.xml':'<workbook><sheets><sheet name="Actuals" sheetId="1" r:id="rId1"/><sheet name="Plan" sheetId="2" r:id="rId2"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels':'<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="worksheets/sheet2.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml':'<worksheet><sheetData><row><c r="A1" t="inlineStr"><is><t>Region</t></is></c><c r="B1" t="inlineStr"><is><t>Revenue</t></is></c><c r="C1" t="inlineStr"><is><t>Growth</t></is></c><c r="D1" t="inlineStr"><is><t>Margin</t></is></c></row><row><c r="A2" t="inlineStr"><is><t>APAC</t></is></c><c r="B2"><f>5+5</f><v>10</v></c><c r="C2"><v>0.32</v></c><c r="D2"><v>0.69</v></c></row></sheetData></worksheet>',
    'xl/worksheets/sheet2.xml':'<worksheet><sheetData><row><c r="A1" t="inlineStr"><is><t>Region</t></is></c><c r="B1" t="inlineStr"><is><t>Revenue</t></is></c></row><row><c r="A2" t="inlineStr"><is><t>APAC</t></is></c><c r="B2"><v>10.5</v></c></row></sheetData></worksheet>',
  },{deflate:true})
  const plan=await planXlsxImport(cloneSeedWorkspace(),bytes,'model.xlsx')
  assert.equal(plan.commands.some((command)=>command.type==='region.update'&&command.field==='growth'&&command.value===32),true)
  assert.equal(plan.commands.some((command)=>command.type==='plan.update'&&command.value===10.5),true)
  assert.equal(plan.warnings.some((warning)=>/cached values/.test(warning)),true)
})

test('unrecognized Excel or Google Sheets tabs are retained as generic Frame Data tables',async()=>{
  const bytes=zip({
    'xl/workbook.xml':'<workbook><sheets><sheet name="Pipeline" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels':'<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml':'<worksheet><sheetData><row><c r="A1" t="inlineStr"><is><t>Account</t></is></c><c r="B1" t="inlineStr"><is><t>ARR</t></is></c><c r="C1" t="inlineStr"><is><t>Stage</t></is></c></row><row><c r="A2" t="inlineStr"><is><t>Acme</t></is></c><c r="B2"><v>2.4</v></c><c r="C2" t="inlineStr"><is><t>Qualified</t></is></c></row></sheetData></worksheet>',
  },{deflate:true})
  const plan=await planXlsxImport(cloneSeedWorkspace(),bytes,'pipeline.xlsx')
  const command=plan.commands.find((item)=>item.type==='data.imported.replace')
  assert.ok(command);assert.equal(command.tables.at(-1).label,'Pipeline')
  assert.equal(command.tables.at(-1).rows[0].values.arr,2.4)
  assert.equal(plan.warnings.some((warning)=>/generic Frame Data tables/.test(warning)),true)
})

test('Google pointer files are rejected with an export instruction instead of being treated as content',async()=>{
  const { planOfficeImport }=await import('../src/officeImportPlanner.ts')
  await assert.rejects(()=>planOfficeImport(cloneSeedWorkspace(),new Uint8Array(),'strategy.gdoc'),/File → Download/)
})
