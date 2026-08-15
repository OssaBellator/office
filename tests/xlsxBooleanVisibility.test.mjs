import assert from 'node:assert/strict'
import test from 'node:test'
import { deserializeWorkspaceCommand, serializeWorkspaceCommand } from '../src/commandCodec.ts'
import { getImportedTables, importedTableFromSheet, withImportedTables } from '../src/importedTables.ts'
import { cloneSeedWorkspace } from '../src/model.ts'
import { createStoredZip, exportWorkspaceXlsx } from '../src/officeExport.ts'
import { planSecureOfficeImport } from '../src/officeSecureImport.ts'
import { readOfficeXml, readOfficeZip } from '../src/officeArchive.ts'
import { parseXlsxWorkbook } from '../src/officeParsers.ts'

function workbookPackage({state='visible',body}){
  return createStoredZip({
    '[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    '_rels/.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml':`<workbook><sheets><sheet name="Actuals" sheetId="1" r:id="rId1"${state==='visible'?'':` state="${state}"`}/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels':'<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml':`<worksheet><sheetData>${body}</sheetData></worksheet>`,
  })
}

test('XLSX parser returns real booleans and workbook sheet visibility',()=>{
  const workbook='<workbook><sheets><sheet name="Flags" sheetId="1" r:id="rId1" state="veryHidden"/></sheets></workbook>'
  const rels='<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>'
  const xml='<worksheet><sheetData><row><c r="A1" t="inlineStr"><is><t>Enabled</t></is></c></row><row><c r="A2" t="b"><v>1</v></c></row><row><c r="A3" t="b"><v>0</v></c></row></sheetData></worksheet>'
  const [sheet]=parseXlsxWorkbook(workbook,rels,new Map([['xl/worksheets/sheet1.xml',xml]]))
  assert.equal(sheet.visibility,'veryHidden')
  assert.equal(sheet.rows[1][0],true)
  assert.equal(sheet.rows[2][0],false)
  const table=importedTableFromSheet(sheet,'flags.xlsx','flags')
  assert.equal(table.columns[0].type,'boolean')
  assert.equal(table.sourceVisibility,'veryHidden')
  assert.equal(table.rows[0].values.enabled,true)
})

test('boolean and sheet-visibility metadata survives semantic command decoding',()=>{
  const table={id:'imported:flags',label:'Flags',source:'flags.xlsx',importedAt:'today',sourceVisibility:'hidden',columns:[{id:'enabled',label:'Enabled',type:'boolean'}],rows:[{id:'row:1',values:{enabled:true}},{id:'row:2',values:{enabled:false}}]}
  const command={type:'data.imported.replace',tables:[table]}
  assert.deepEqual(deserializeWorkspaceCommand(serializeWorkspaceCommand(command)),command)
})

test('Frame XLSX export re-emits imported booleans as boolean cells and source visibility as sheet state',async()=>{
  let workspace=cloneSeedWorkspace()
  workspace=withImportedTables(workspace,[{id:'imported:flags',label:'Flags',source:'flags.xlsx',importedAt:'today',sourceVisibility:'hidden',columns:[{id:'enabled',label:'Enabled',type:'boolean'}],rows:[{id:'row:1',values:{enabled:true}},{id:'row:2',values:{enabled:false}}]}])
  const exported=exportWorkspaceXlsx(workspace)
  const entries=await readOfficeZip(exported.bytes)
  const workbook=readOfficeXml(entries,'xl/workbook.xml'),rels=readOfficeXml(entries,'xl/_rels/workbook.xml.rels')
  const xmlByPath=new Map([...entries.keys()].filter((path)=>/^xl\/worksheets\/sheet\d+\.xml$/.test(path)).map((path)=>[path,readOfficeXml(entries,path)]))
  const sheets=parseXlsxWorkbook(workbook,rels,xmlByPath)
  const flags=sheets.find((sheet)=>sheet.name==='Flags')
  assert.ok(flags)
  assert.equal(flags.visibility,'hidden')
  assert.equal(flags.rows[1][0],true)
  assert.equal(flags.rows[2][0],false)
})

test('secure canonical import retains a hidden recognized finance sheet as provenance Data',async()=>{
  const bytes=workbookPackage({state:'hidden',body:'<row><c r="A1" t="inlineStr"><is><t>Region</t></is></c><c r="B1" t="inlineStr"><is><t>Revenue</t></is></c><c r="C1" t="inlineStr"><is><t>Growth</t></is></c><c r="D1" t="inlineStr"><is><t>Margin</t></is></c></row><row><c r="A2" t="inlineStr"><is><t>APAC</t></is></c><c r="B2"><v>10</v></c><c r="C2"><v>0.32</v></c><c r="D2"><v>0.69</v></c></row>'})
  const plan=await planSecureOfficeImport(cloneSeedWorkspace(),bytes,'finance.xlsx')
  const replacement=plan.commands.find((command)=>command.type==='data.imported.replace')
  assert.ok(replacement)
  const retained=replacement.tables.find((table)=>table.label==='Actuals'&&table.source==='finance.xlsx')
  assert.ok(retained)
  assert.equal(retained.sourceVisibility,'hidden')
  assert.equal(plan.warnings.some((warning)=>/source worksheet is hidden/.test(warning)),true)
})
