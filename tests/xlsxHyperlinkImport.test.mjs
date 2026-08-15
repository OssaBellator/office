import assert from 'node:assert/strict'
import test from 'node:test'
import { deserializeWorkspaceCommand, serializeWorkspaceCommand } from '../src/commandCodec.ts'
import { getImportedTableLink, withImportedTables } from '../src/importedTables.ts'
import { cloneSeedWorkspace } from '../src/model.ts'
import { createStoredZip, exportWorkspaceXlsx } from '../src/officeExport.ts'
import { planSecureOfficeImport } from '../src/officeSecureImport.ts'
import { readOfficeXml, readOfficeZip } from '../src/officeArchive.ts'
import { validateOfficePackage } from '../src/officePackageValidator.ts'
import { parseXlsxHyperlinks } from '../src/xlsxHyperlinkImport.ts'

function hyperlinkWorkbook(){
  return createStoredZip({
    '[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    '_rels/.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml':'<workbook><sheets><sheet name="Links" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels':'<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml':'<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Name</t></is></c><c r="B1" t="inlineStr"><is><t>Website</t></is></c><c r="C1" t="inlineStr"><is><t>Jump</t></is></c><c r="D1" t="inlineStr"><is><t>Legacy file</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>Acme</t></is></c><c r="B2" t="inlineStr"><is><t>Portal</t></is></c><c r="C2" t="inlineStr"><is><t>See assumptions</t></is></c><c r="D2" t="inlineStr"><is><t>Archive</t></is></c></row></sheetData><hyperlinks><hyperlink ref="B2" r:id="rIdWeb" display="Acme portal" tooltip="Open portal"/><hyperlink ref="C2" location="Assumptions!A1"/><hyperlink ref="D2" r:id="rIdFile"/></hyperlinks></worksheet>',
    'xl/worksheets/_rels/sheet1.xml.rels':'<Relationships><Relationship Id="rIdWeb" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.com/acme?x=1&amp;y=2" TargetMode="External"/><Relationship Id="rIdFile" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="file:///C:/legacy/report.xlsx" TargetMode="External"/></Relationships>',
  })
}

function linksTable(){return{id:'table:links',label:'Links',source:'links.xlsx',importedAt:'now',columns:[{id:'name',label:'Name',type:'text'},{id:'website',label:'Website',type:'text'},{id:'jump',label:'Jump',type:'text'},{id:'legacy-file',label:'Legacy file',type:'text'}],rows:[{id:'row:1',values:{name:'Acme',website:'Portal',jump:'See assumptions','legacy-file':'Archive'}}],linkByCell:{'row:1\u0000website':{kind:'external',target:'https://example.com/acme?x=1&y=2',display:'Acme portal',tooltip:'Open portal'},'row:1\u0000jump':{kind:'internal',target:'Assumptions!A1'},'row:1\u0000legacy-file':{kind:'external',target:'file:///C:/legacy/report.xlsx'}}}}

test('secure XLSX import preserves safe, internal and inert hyperlink provenance',async()=>{
  const plan=await planSecureOfficeImport(cloneSeedWorkspace(),hyperlinkWorkbook(),'links.xlsx')
  const replacement=plan.commands.find((command)=>command.type==='data.imported.replace')
  assert.ok(replacement)
  const table=replacement.tables.find((item)=>item.label==='Links')
  assert.ok(table)
  assert.deepEqual(getImportedTableLink(table,table.rows[0].id,'website'),{kind:'external',target:'https://example.com/acme?x=1&y=2',display:'Acme portal',tooltip:'Open portal'})
  assert.deepEqual(getImportedTableLink(table,table.rows[0].id,'jump'),{kind:'internal',target:'Assumptions!A1'})
  assert.equal(getImportedTableLink(table,table.rows[0].id,'legacy-file').target,'file:///C:/legacy/report.xlsx')
  assert.equal(plan.warnings.some((warning)=>/3 worksheet hyperlinks/.test(warning)),true)
  assert.equal(plan.warnings.some((warning)=>/non-web\/non-mail scheme/.test(warning)),true)
})

test('hyperlink provenance survives runtime semantic command decoding',()=>{
  const command={type:'data.imported.replace',tables:[linksTable()]}
  assert.deepEqual(deserializeWorkspaceCommand(serializeWorkspaceCommand(command)),command)
})

test('XLSX export recreates safe external and internal links but leaves file links inert',async()=>{
  const workspace=withImportedTables(cloneSeedWorkspace(),[linksTable()])
  const file=exportWorkspaceXlsx(workspace),entries=await readOfficeZip(file.bytes)
  const sheet=readOfficeXml(entries,'xl/worksheets/sheet3.xml'),rels=readOfficeXml(entries,'xl/worksheets/_rels/sheet3.xml.rels')
  assert.ok(sheet);assert.ok(rels)
  assert.match(sheet,/location="Assumptions!A1"/)
  assert.match(rels,/https:\/\/example\.com\/acme\?x=1&amp;y=2/)
  assert.doesNotMatch(rels,/file:\/\/\//)
  const parsed=parseXlsxHyperlinks(sheet,rels)
  assert.equal(parsed.get('B2').target,'https://example.com/acme?x=1&y=2')
  assert.equal(parsed.get('C2').target,'Assumptions!A1')
  assert.equal(parsed.has('D2'),false)
  const validation=await validateOfficePackage(file.bytes)
  assert.equal(validation.valid,true,validation.issues.map((issue)=>issue.detail).join('; '))
})
