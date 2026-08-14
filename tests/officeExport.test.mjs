import assert from 'node:assert/strict'
import test from 'node:test'
import { cloneSeedWorkspace } from '../src/model.ts'
import { withImportedTables } from '../src/importedTables.ts'
import { getSemanticDocument, withSemanticDocument } from '../src/semanticDocument.ts'
import { exportWorkspaceDocx, exportWorkspacePptx, exportWorkspaceXlsx } from '../src/officeExport.ts'
import { readOfficeXml, readOfficeZip } from '../src/officeArchive.ts'
import { parseDocxDocumentXml, parsePptxSlideOrder, parsePptxSlideXml, parseXlsxWorkbook } from '../src/officeParsers.ts'

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

test('XLSX export contains Regions, Plan, and retained foreign Frame Data tables',async()=>{
  let workspace=cloneSeedWorkspace()
  workspace=withImportedTables(workspace,[{id:'imported:pipeline',label:'Pipeline',source:'pipeline.xlsx',importedAt:'today',columns:[{id:'account',label:'Account',type:'text'},{id:'arr',label:'ARR',type:'number'}],rows:[{id:'row:1',values:{account:'Acme',arr:2.4}}]}])
  const file=exportWorkspaceXlsx(workspace)
  assert.match(file.filename,/\.xlsx$/)
  const entries=await readOfficeZip(file.bytes)
  const workbook=readOfficeXml(entries,'xl/workbook.xml'),rels=readOfficeXml(entries,'xl/_rels/workbook.xml.rels')
  assert.ok(workbook);assert.ok(rels)
  const sheets=new Map([...entries.entries()].flatMap(([path])=>/^xl\/worksheets\/sheet\d+\.xml$/.test(path)?[[path,readOfficeXml(entries,path)]]:[]).filter((entry)=>entry[1]))
  const parsed=parseXlsxWorkbook(workbook,rels,sheets)
  assert.deepEqual(parsed.map((sheet)=>sheet.name),['Regions','Plan','Pipeline'])
  assert.equal(parsed[0].rows[1][0],'North America')
  assert.equal(parsed[2].rows[1][0],'Acme')
  assert.equal(parsed[2].rows[1][1],2.4)
})

test('PPTX export follows relationship order and exposes Frame scenes as readable slides',async()=>{
  const workspace=cloneSeedWorkspace()
  const file=exportWorkspacePptx(workspace)
  assert.match(file.filename,/\.pptx$/)
  const entries=await readOfficeZip(file.bytes)
  const order=parsePptxSlideOrder(readOfficeXml(entries,'ppt/presentation.xml'),readOfficeXml(entries,'ppt/_rels/presentation.xml.rels'))
  assert.equal(order.length>0,true)
  assert.equal(order.every((path)=>entries.has(path)),true)
  const first=parsePptxSlideXml(readOfficeXml(entries,order[0]))
  assert.equal(first.title.length>0,true)
  assert.equal(first.body.join(' ').includes('Source:'),true)
})

test('stored ZIP writer output passes bounded Office archive validation for all native exports',async()=>{
  const workspace=cloneSeedWorkspace()
  for(const file of [exportWorkspaceDocx(workspace),exportWorkspaceXlsx(workspace),exportWorkspacePptx(workspace)]){
    const entries=await readOfficeZip(file.bytes)
    assert.equal(entries.size>3,true)
    assert.equal(entries.has('[Content_Types].xml'),true)
  }
})
