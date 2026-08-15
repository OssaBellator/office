import assert from 'node:assert/strict'
import test from 'node:test'
import { createStoredZip, exportWorkspaceXlsx } from '../src/officeExport.ts'
import { cloneSeedWorkspace } from '../src/model.ts'
import { planSecureOfficeImport } from '../src/officeSecureImport.ts'
import { createVersionedWorkspaceSession, executeVersionedWorkspaceCommand } from '../src/versioning.ts'
import { getImportedTableComment, getImportedTableFormula, getImportedTableLink, getImportedTableNumberFormat, getImportedTables } from '../src/importedTables.ts'
import { readOfficeXml, readOfficeZip } from '../src/officeArchive.ts'
import { parseXlsxHyperlinks, } from '../src/xlsxHyperlinkImport.ts'
import { parseXlsxNumberFormatStyles } from '../src/xlsxNumberFormatImport.ts'

function workbook(){
  return createStoredZip({
    '[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/comments1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.comments+xml"/></Types>',
    '_rels/.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml':'<workbook><workbookPr date1904="1"/><sheets><sheet name="Controls" sheetId="1" r:id="rId1" state="veryHidden"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels':'<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    'xl/styles.xml':'<styleSheet><numFmts count="1"><numFmt numFmtId="165" formatCode="yyyy-mm-dd"/></numFmts><cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="165" applyNumberFormat="1"/></cellXfs></styleSheet>',
    'xl/worksheets/sheet1.xml':'<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Name</t></is></c><c r="B1" t="inlineStr"><is><t>Enabled</t></is></c><c r="C1" t="inlineStr"><is><t>Date serial</t></is></c><c r="D1" t="inlineStr"><is><t>Calculated</t></is></c><c r="E1" t="inlineStr"><is><t>Website</t></is></c><c r="F1" t="inlineStr"><is><t>Legacy</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>Acme</t></is></c><c r="B2" t="b"><v>1</v></c><c r="C2" s="1"><v>45000</v></c><c r="D2"><f t="shared" si="0" ref="D2:D3">C2+1</f><v>45001</v></c><c r="E2" t="inlineStr"><is><t>Portal</t></is></c><c r="F2" t="inlineStr"><is><t>Archive</t></is></c></row><row r="3"><c r="A3" t="inlineStr"><is><t>Nova</t></is></c><c r="B3" t="b"><v>0</v></c><c r="C3" s="1"><v>45010</v></c><c r="D3"><f t="shared" si="0"/><v>45011</v></c><c r="E3" t="inlineStr"><is><t>Portal</t></is></c><c r="F3" t="inlineStr"><is><t>Archive</t></is></c></row></sheetData><hyperlinks><hyperlink ref="E2" r:id="rIdWeb"/><hyperlink ref="F2" r:id="rIdFile"/></hyperlinks></worksheet>',
    'xl/worksheets/_rels/sheet1.xml.rels':'<Relationships><Relationship Id="rIdWeb" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.com/acme" TargetMode="External"/><Relationship Id="rIdFile" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="file:///C:/legacy.xlsx" TargetMode="External"/><Relationship Id="rIdComments" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="../comments1.xml"/></Relationships>',
    'xl/comments1.xml':'<comments><authors><author>Finance</author></authors><commentList><comment ref="C2" authorId="0"><text><t>Confirm migration date</t></text></comment></commentList></comments>',
  })
}

test('composite Excel fidelity survives secure import enrichment ordering',async()=>{
  const plan=await planSecureOfficeImport(cloneSeedWorkspace(),workbook(),'controls.xlsx')
  const replacement=plan.commands.find((command)=>command.type==='data.imported.replace')
  assert.ok(replacement)
  const table=replacement.tables.find((item)=>item.label==='Controls')
  assert.ok(table)
  assert.equal(table.sourceVisibility,'veryHidden')
  assert.equal(table.sourceDateSystem,'1904')
  assert.equal(table.columns.find((column)=>column.label==='Enabled').type,'boolean')
  assert.equal(table.rows[0].values.enabled,true)
  assert.equal(table.rows[1].values.enabled,false)
  assert.deepEqual(getImportedTableNumberFormat(table,table.rows[0].id,'date-serial'),{numFmtId:165,formatCode:'yyyy-mm-dd'})
  assert.equal(getImportedTableFormula(table,table.rows[0].id,'calculated'),'C2+1')
  assert.equal(getImportedTableFormula(table,table.rows[1].id,'calculated'),'C3+1')
  assert.equal(getImportedTableLink(table,table.rows[0].id,'website').target,'https://example.com/acme')
  assert.equal(getImportedTableLink(table,table.rows[0].id,'legacy').target,'file:///C:/legacy.xlsx')
  assert.deepEqual(getImportedTableComment(table,table.rows[0].id,'date-serial'),{text:'Confirm migration date',author:'Finance'})
  assert.equal(plan.warnings.some((warning)=>/very hidden/.test(warning)),true)
  assert.equal(plan.warnings.some((warning)=>/shared-formula dependent cell/.test(warning)),true)
  assert.equal(plan.warnings.some((warning)=>/non-web\/non-mail scheme/.test(warning)),true)
  assert.equal(plan.warnings.some((warning)=>/classic Excel cell note/.test(warning)),true)
})

test('applied composite import re-exports safe spreadsheet semantics conservatively',async()=>{
  const plan=await planSecureOfficeImport(cloneSeedWorkspace(),workbook(),'controls.xlsx')
  let session=createVersionedWorkspaceSession(cloneSeedWorkspace())
  for(const command of plan.commands)session=executeVersionedWorkspaceCommand(session,command)
  const imported=getImportedTables(session.present).find((table)=>table.label==='Controls')
  assert.ok(imported)
  const exported=exportWorkspaceXlsx(session.present),entries=await readOfficeZip(exported.bytes)
  const workbookXml=readOfficeXml(entries,'xl/workbook.xml')
  assert.match(workbookXml,/date1904="1"/)
  assert.match(workbookXml,/name="Controls"[^>]*state="veryHidden"/)
  const styles=parseXlsxNumberFormatStyles(readOfficeXml(entries,'xl/styles.xml'))
  assert.equal([...styles.custom.values()].includes('yyyy-mm-dd'),true)
  const sheet=readOfficeXml(entries,'xl/worksheets/sheet3.xml'),rels=readOfficeXml(entries,'xl/worksheets/_rels/sheet3.xml.rels')
  assert.match(sheet,/<c r="B2" t="b"><v>1<\/v><\/c>/)
  assert.match(sheet,/<c r="B3" t="b"><v>0<\/v><\/c>/)
  assert.doesNotMatch(sheet,/<f\b/)
  const links=parseXlsxHyperlinks(sheet,rels)
  assert.equal(links.get('E2').target,'https://example.com/acme')
  assert.equal(links.has('F2'),false)
  assert.equal([...entries.keys()].some((path)=>/^xl\/comments\d*\.xml$/i.test(path)),false)
})
