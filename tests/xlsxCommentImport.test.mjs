import assert from 'node:assert/strict'
import test from 'node:test'
import { deserializeWorkspaceCommand, serializeWorkspaceCommand } from '../src/commandCodec.ts'
import { getImportedTableComment, withImportedTables } from '../src/importedTables.ts'
import { cloneSeedWorkspace } from '../src/model.ts'
import { exportWorkspaceXlsx, createStoredZip } from '../src/officeExport.ts'
import { planSecureOfficeImport } from '../src/officeSecureImport.ts'
import { readOfficeZip } from '../src/officeArchive.ts'
import { searchWorkspace } from '../src/searchIndex.ts'
import { compareWorkspaceStates } from '../src/workspaceCompare.ts'

function commentsWorkbook({threaded=false}={}){
  const files={
    '[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/comments1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.comments+xml"/></Types>',
    '_rels/.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml':'<workbook><sheets><sheet name="Pipeline" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels':'<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml':'<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Account</t></is></c><c r="B1" t="inlineStr"><is><t>ARR</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>Acme</t></is></c><c r="B2"><v>2.4</v></c></row></sheetData></worksheet>',
    'xl/worksheets/_rels/sheet1.xml.rels':'<Relationships><Relationship Id="rIdComments" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="../comments1.xml"/></Relationships>',
    'xl/comments1.xml':'<comments><authors><author>Alice</author></authors><commentList><comment ref="B2" authorId="0"><text><r><t>Validate renewal </t></r><r><t>assumption</t></r></text></comment></commentList></comments>',
  }
  if(threaded)files['xl/threadedComments/threadedComment1.xml']='<ThreadedComments/>'
  return createStoredZip(files)
}

function noteTable(text='Validate renewal assumption'){
  return{id:'table:pipeline',label:'Pipeline',source:'pipeline.xlsx',importedAt:'now',columns:[{id:'account',label:'Account',type:'text'},{id:'arr',label:'ARR',type:'number'}],rows:[{id:'row:1',values:{account:'Acme',arr:2.4}}],commentByCell:{'row:1\u0000arr':{text,author:'Alice'}}}

test('secure XLSX import preserves classic cell notes with author as review provenance',async()=>{
  const plan=await planSecureOfficeImport(cloneSeedWorkspace(),commentsWorkbook(),'pipeline.xlsx')
  const replacement=plan.commands.find((command)=>command.type==='data.imported.replace')
  assert.ok(replacement)
  const table=replacement.tables.find((item)=>item.label==='Pipeline')
  assert.ok(table)
  assert.deepEqual(getImportedTableComment(table,table.rows[0].id,'arr'),{text:'Validate renewal assumption',author:'Alice'})
  assert.equal(plan.warnings.some((warning)=>/classic Excel cell note/.test(warning)),true)
  assert.equal(plan.warnings.some((warning)=>/comments and notes are not imported yet/.test(warning)),false)
})

test('classic note provenance survives command decoding and semantic search',()=>{
  const command={type:'data.imported.replace',tables:[noteTable()]}
  assert.deepEqual(deserializeWorkspaceCommand(serializeWorkspaceCommand(command)),command)
  const workspace=withImportedTables(cloneSeedWorkspace(),[noteTable()])
  assert.equal(searchWorkspace(workspace,'Alice renewal assumption',{kinds:['table']})[0].id,'table:table:pipeline')
})

test('semantic comparison treats cell-note changes separately from cell values',()=>{
  const before=withImportedTables(cloneSeedWorkspace(),[noteTable('Validate renewal assumption')])
  const after=withImportedTables(cloneSeedWorkspace(),[noteTable('Validated with Finance')])
  const diffs=compareWorkspaceStates(before,after)
  assert.equal(diffs.some((diff)=>diff.objectId==='table:table:pipeline:row:1'&&diff.field==='ARR'),false)
  const noteDiff=diffs.find((diff)=>diff.objectId==='table:table:pipeline:row:1'&&diff.field==='ARR note')
  assert.ok(noteDiff)
  assert.match(String(noteDiff.before),/Validate renewal assumption/)
  assert.match(String(noteDiff.after),/Validated with Finance/)
})

test('normal XLSX compatibility export deliberately keeps classic notes Frame-only for now',async()=>{
  const workspace=withImportedTables(cloneSeedWorkspace(),[noteTable()])
  const entries=await readOfficeZip(exportWorkspaceXlsx(workspace).bytes)
  assert.equal([...entries.keys()].some((path)=>/^xl\/comments\d*\.xml$/i.test(path)),false)
  assert.equal([...entries.keys()].some((path)=>/vmlDrawing/i.test(path)),false)
})

test('threaded Excel comments remain explicit warning-only fidelity',async()=>{
  const plan=await planSecureOfficeImport(cloneSeedWorkspace(),commentsWorkbook({threaded:true}),'pipeline.xlsx')
  assert.equal(plan.warnings.some((warning)=>/threaded comments are not imported yet/.test(warning)),true)
})
