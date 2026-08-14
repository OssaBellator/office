import assert from 'node:assert/strict'
import test from 'node:test'
import { cloneSeedWorkspace } from '../src/model.ts'
import { importedTableCellKey, withImportedTables } from '../src/importedTables.ts'
import { getSemanticDocument, withSemanticDocument } from '../src/semanticDocument.ts'
import { exportWorkspaceDocx, exportWorkspacePptx, exportWorkspaceXlsx } from '../src/officeExport.ts'
import { readOfficeXml, readOfficeZip } from '../src/officeArchive.ts'
import { parseDocxDocumentXml, parsePptxSlideOrder, parsePptxSlideXml, parseRelatedPartPath, parseXlsxWorkbook } from '../src/officeParsers.ts'

test('DOCX export is a readable OOXML package with semantic document structure',async()=>{
  let workspace=cloneSeedWorkspace()
  const semantic=getSemanticDocument(workspace)
  semantic.blocks.push({id:'block:office-source',type:'paragraph',text:'Imported recommendation',style:'heading-2',source:'legacy-strategy.docx'})
  workspace=withSemanticDocument(workspace,semantic)
  const file=exportWorkspaceDocx(workspace)
  assert.match(file.filename,/\.docx$/)
  assert.equal(file.mimeType,'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  const entries=await readOfficeZip(file.bytes)
  assert.equal(entries.has('[Content_Types].xml'),true)
  const document=readOfficeXml(entries,'word/document.xml')
  assert.ok(document)
  const blocks=parseDocxDocumentXml(document)
  assert.equal(blocks.some((block)=>block.text===workspace.document.title&&block.kind==='heading-1'),true)
  assert.equal(blocks.some((block)=>block.text==='Imported recommendation'&&block.kind==='heading-2'),true)
  assert.equal(blocks.some((block)=>block.text==='Imported from legacy-strategy.docx'),true)
})

test('XLSX export contains Regions, Plan, retained foreign tables, and case-insensitively safe sheet names',async()=>{
  let workspace=cloneSeedWorkspace()
  const rowId='row:1',formulaKey=importedTableCellKey(rowId,'arr')
  workspace=withImportedTables(workspace,[
    {id:'imported:pipeline',label:'Pipeline',source:'pipeline.xlsx',importedAt:'today',columns:[{id:'account',label:'Account',type:'text'},{id:'arr',label:'ARR',type:'number'}],rows:[{id:rowId,values:{account:'Acme',arr:2.4}}],formulaByCell:{[formulaKey]:'1.2+1.2'}},
    {id:'imported:plan-copy',label:'plan',source:'legacy.xlsx',importedAt:'today',columns:[{id:'note',label:'Note',type:'text'}],rows:[{id:'row:2',values:{note:'Foreign plan notes'}}]},
  ])
  const file=exportWorkspaceXlsx(workspace)
  assert.match(file.filename,/\.xlsx$/)
  const entries=await readOfficeZip(file.bytes)
  const workbook=readOfficeXml(entries,'xl/workbook.xml'),rels=readOfficeXml(entries,'xl/_rels/workbook.xml.rels')
  assert.ok(workbook);assert.ok(rels)
  const sheets=new Map([...entries.entries()].flatMap(([path])=>/^xl\/worksheets\/sheet\d+\.xml$/.test(path)?[[path,readOfficeXml(entries,path)]]:[]).filter((entry)=>entry[1]))
  const parsed=parseXlsxWorkbook(workbook,rels,sheets)
  assert.deepEqual(parsed.map((sheet)=>sheet.name),['Regions','Plan','Pipeline','plan 2'])
  assert.equal(parsed[0].rows[1][0],'North America')
  assert.equal(parsed[2].rows[1][0],'Acme')
  assert.equal(parsed[2].rows[1][1],2.4)
  assert.equal(parsed[2].formulas.flat().some(Boolean),false)
  assert.equal(readOfficeXml(entries,'xl/worksheets/sheet3.xml').includes('<f'),false)
})

test('PPTX export follows relationship order and stores speaker cues in real notesSlide parts',async()=>{
  const workspace=cloneSeedWorkspace()
  const file=exportWorkspacePptx(workspace)
  assert.match(file.filename,/\.pptx$/)
  const entries=await readOfficeZip(file.bytes)
  const order=parsePptxSlideOrder(readOfficeXml(entries,'ppt/presentation.xml'),readOfficeXml(entries,'ppt/_rels/presentation.xml.rels'))
  assert.equal(order.length>0,true)
  assert.equal(order.every((path)=>entries.has(path)),true)
  const firstPath=order[0]
  const slideXml=readOfficeXml(entries,firstPath)
  const notesPath=parseRelatedPartPath(firstPath,readOfficeXml(entries,'ppt/slides/_rels/slide1.xml.rels'),'notesSlide')
  assert.equal(notesPath,'ppt/notesSlides/notesSlide1.xml')
  const first=parsePptxSlideXml(slideXml,readOfficeXml(entries,notesPath))
  assert.equal(first.title.length>0,true)
  assert.equal(first.body.join(' ').includes('Source:'),true)
  assert.equal(first.body.join(' ').includes('Speaker note:'),false)
  assert.equal(first.note.length>0,true)
  assert.equal(entries.has('ppt/notesMasters/notesMaster1.xml'),true)
})

test('stored ZIP writer output passes bounded Office archive validation for all native exports',async()=>{
  const workspace=cloneSeedWorkspace()
  for(const file of [exportWorkspaceDocx(workspace),exportWorkspaceXlsx(workspace),exportWorkspacePptx(workspace)]){
    const entries=await readOfficeZip(file.bytes)
    assert.equal(entries.size>3,true)
    assert.equal(entries.has('[Content_Types].xml'),true)
  }
})
