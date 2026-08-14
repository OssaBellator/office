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
  assert.equal(plan.commands[0].block.source,'Strategy.docx')
})

test('direct Google Sheets provider output uses XLSX planner and preserves foreign schema',async()=>{
  const calls=[]
  const provider={exportFile:async(request)=>{calls.push(request);return storedZip({
    'xl/workbook.xml':'<workbook><sheets><sheet name="Pipeline" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels':'<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml':'<worksheet><sheetData><row><c r="A1" t="inlineStr"><is><t>Account</t></is></c><c r="B1" t="inlineStr"><is><t>ARR</t></is></c></row><row><c r="A2" t="inlineStr"><is><t>Acme</t></is></c><c r="B2"><f>1.2+1.2</f><v>2.4</v></c></row></sheetData></worksheet>',
  })}}
  const plan=await planGoogleWorkspaceImport(cloneSeedWorkspace(),{id:'sheet-1',name:'Sales model',kind:'spreadsheet'},provider)
  assert.match(calls[0].mimeType,/spreadsheetml/)
  assert.equal(plan.kind,'xlsx')
  const command=plan.commands.find((item)=>item.type==='data.imported.replace')
  assert.ok(command)
  const table=command.tables.at(-1)
  assert.equal(table.label,'Pipeline')
  assert.equal(table.source,'Sales model.xlsx')
  assert.equal(Object.values(table.formulaByCell)[0],'1.2+1.2')
})

test('direct Google Slides provider output uses PPTX planner and retains speaker notes',async()=>{
  const calls=[]
  const provider={exportFile:async(request)=>{calls.push(request);return storedZip({
    'ppt/presentation.xml':'<p:presentation><p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst></p:presentation>',
    'ppt/_rels/presentation.xml.rels':'<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/></Relationships>',
    'ppt/slides/slide1.xml':'<p:sld><p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><a:p><a:r><a:t>Google slide</a:t></a:r></a:p></p:sp></p:sld>',
    'ppt/slides/_rels/slide1.xml.rels':'<Relationships><Relationship Id="rIdN" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide1.xml"/></Relationships>',
    'ppt/notesSlides/notesSlide1.xml':'<p:notes><p:sp><p:nvSpPr><p:nvPr><p:ph type="body"/></p:nvPr></p:nvSpPr><a:p><a:r><a:t>Google speaker cue</a:t></a:r></a:p></p:sp></p:notes>',
  })}}
  const plan=await planGoogleWorkspaceImport(cloneSeedWorkspace(),{id:'slides-1',name:'Board deck',kind:'presentation'},provider)
  assert.match(calls[0].mimeType,/presentationml/)
  assert.equal(plan.kind,'pptx')
  const state=plan.commands[0].value
  assert.equal(state.importedScenes.at(-1).title,'Google slide')
  assert.equal(state.importedScenes.at(-1).note,'Google speaker cue')
  assert.match(state.importedScenes.at(-1).source,/Board deck\.pptx/)
})
