import assert from 'node:assert/strict'
import test from 'node:test'
import { deserializeWorkspaceCommand, serializeWorkspaceCommand } from '../src/commandCodec.ts'
import { getImportedTableNumberFormat, withImportedTables } from '../src/importedTables.ts'
import { cloneSeedWorkspace } from '../src/model.ts'
import { createStoredZip, exportWorkspaceXlsx } from '../src/officeExport.ts'
import { planSecureOfficeImport } from '../src/officeSecureImport.ts'
import { readOfficeXml, readOfficeZip } from '../src/officeArchive.ts'
import { parseXlsxNumberFormatStyles } from '../src/xlsxNumberFormatImport.ts'

function formattedWorkbook({date1904=true}={}){
  return createStoredZip({
    '[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    '_rels/.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml':`<workbook><workbookPr${date1904?' date1904="1"':''}/><sheets><sheet name="Dates" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels':'<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="styles.xml"/></Relationships>',
    'xl/styles.xml':'<styleSheet><numFmts count="1"><numFmt numFmtId="165" formatCode="yyyy-mm-dd"/></numFmts><cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="165" applyNumberFormat="1"/></cellXfs></styleSheet>',
    'xl/worksheets/sheet1.xml':'<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Date serial</t></is></c><c r="B1" t="inlineStr"><is><t>Label</t></is></c></row><row r="2"><c r="A2" s="1"><v>45000</v></c><c r="B2" t="inlineStr"><is><t>Milestone</t></is></c></row></sheetData></worksheet>',
  })
}

test('secure XLSX import preserves custom number format and workbook date system without converting serials',async()=>{
  const plan=await planSecureOfficeImport(cloneSeedWorkspace(),formattedWorkbook(),'dates.xlsx')
  const replacement=plan.commands.find((command)=>command.type==='data.imported.replace')
  assert.ok(replacement)
  const table=replacement.tables.find((item)=>item.label==='Dates')
  assert.ok(table)
  assert.equal(table.rows[0].values['date-serial'],45000)
  assert.equal(table.sourceDateSystem,'1904')
  assert.deepEqual(getImportedTableNumberFormat(table,table.rows[0].id,'date-serial'),{numFmtId:165,formatCode:'yyyy-mm-dd'})
  assert.equal(plan.warnings.some((warning)=>/1904 date system/.test(warning)),true)
  assert.equal(plan.warnings.some((warning)=>/number-format provenance/.test(warning)),true)
})

test('number-format and date-system metadata survives runtime semantic command decoding',()=>{
  const table={id:'table:dates',label:'Dates',source:'dates.xlsx',importedAt:'now',sourceDateSystem:'1904',columns:[{id:'date',label:'Date',type:'number'}],rows:[{id:'row:1',values:{date:45000}}],numberFormatByCell:{'row:1\u0000date':{numFmtId:165,formatCode:'yyyy-mm-dd'}}}
  const command={type:'data.imported.replace',tables:[table]}
  assert.deepEqual(deserializeWorkspaceCommand(serializeWorkspaceCommand(command)),command)
})

test('Frame XLSX export re-emits custom number formats and a consistent 1904 date system',async()=>{
  let workspace=cloneSeedWorkspace()
  workspace=withImportedTables(workspace,[{id:'table:dates',label:'Dates',source:'dates.xlsx',importedAt:'now',sourceDateSystem:'1904',columns:[{id:'date',label:'Date',type:'number'}],rows:[{id:'row:1',values:{date:45000}}],numberFormatByCell:{'row:1\u0000date':{numFmtId:165,formatCode:'yyyy-mm-dd'}}}])
  const entries=await readOfficeZip(exportWorkspaceXlsx(workspace).bytes)
  assert.match(readOfficeXml(entries,'xl/workbook.xml'),/<workbookPr date1904="1"\/>/)
  const styles=readOfficeXml(entries,'xl/styles.xml')
  assert.ok(styles)
  const parsed=parseXlsxNumberFormatStyles(styles)
  assert.equal([...parsed.custom.values()].includes('yyyy-mm-dd'),true)
  const sheet=readOfficeXml(entries,'xl/worksheets/sheet3.xml')
  assert.match(sheet,/<c r="A2" s="1"><v>45000<\/v><\/c>/)
})

test('mixed source date systems suppress incompatible date-like styles instead of shifting serial dates',async()=>{
  let workspace=cloneSeedWorkspace()
  workspace=withImportedTables(workspace,[
    {id:'table:mac',label:'Mac dates',source:'mac.xlsx',importedAt:'now',sourceDateSystem:'1904',columns:[{id:'date',label:'Date',type:'number'}],rows:[{id:'mac:1',values:{date:45000}}],numberFormatByCell:{'mac:1\u0000date':{numFmtId:165,formatCode:'yyyy-mm-dd'}}},
    {id:'table:win',label:'Windows dates',source:'win.xlsx',importedAt:'now',sourceDateSystem:'1900',columns:[{id:'date',label:'Date',type:'number'}],rows:[{id:'win:1',values:{date:45000}}],numberFormatByCell:{'win:1\u0000date':{numFmtId:14}}},
  ])
  const entries=await readOfficeZip(exportWorkspaceXlsx(workspace).bytes)
  assert.doesNotMatch(readOfficeXml(entries,'xl/workbook.xml'),/date1904="1"/)
  assert.doesNotMatch(readOfficeXml(entries,'xl/worksheets/sheet3.xml'),/<c r="A2" s=/)
  assert.match(readOfficeXml(entries,'xl/worksheets/sheet4.xml'),/<c r="A2" s="1">/)
})
