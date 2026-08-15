import assert from 'node:assert/strict'
import test from 'node:test'
import { withImportedTables } from '../src/importedTables.ts'
import { cloneSeedWorkspace } from '../src/model.ts'
import { exportWorkspaceXlsxWithClassicNotes } from '../src/officeXlsxNotesExport.ts'
import { validateOfficePackage } from '../src/officePackageValidator.ts'
import { readOfficeXml, readOfficeZip } from '../src/officeArchive.ts'
import { planSecureOfficeImport } from '../src/officeSecureImport.ts'

function workspace(){return withImportedTables(cloneSeedWorkspace(),[{id:'table:pipeline',label:'Pipeline',source:'pipeline.xlsx',importedAt:'now',columns:[{id:'account',label:'Account',type:'text'},{id:'arr',label:'ARR',type:'number'}],rows:[{id:'row:1',values:{account:'Acme',arr:2.4}}],commentByCell:{'row:1\u0000arr':{text:'Validate renewal assumption',author:'Alice'}}}])}

test('experimental XLSX note projection creates comments, VML and worksheet relationships',async()=>{
  const file=await exportWorkspaceXlsxWithClassicNotes(workspace())
  assert.match(file.filename,/-with-notes\.xlsx$/)
  const entries=await readOfficeZip(file.bytes)
  assert.equal(entries.has('xl/comments1.xml'),true)
  assert.equal(entries.has('xl/drawings/vmlDrawing1.vml'),true)
  assert.match(readOfficeXml(entries,'xl/worksheets/sheet3.xml'),/<legacyDrawing r:id="rId\d+"\/>/)
  const rels=readOfficeXml(entries,'xl/worksheets/_rels/sheet3.xml.rels')
  assert.match(rels,/relationships\/comments/)
  assert.match(rels,/relationships\/vmlDrawing/)
  assert.match(readOfficeXml(entries,'xl/comments1.xml'),/Validate renewal assumption/)
  assert.match(readOfficeXml(entries,'xl/comments1.xml'),/<author>Alice<\/author>/)
})

test('experimental note XLSX passes Frame OPC validation',async()=>{
  const file=await exportWorkspaceXlsxWithClassicNotes(workspace())
  const validation=await validateOfficePackage(file.bytes)
  assert.equal(validation.valid,true,validation.issues.map((issue)=>issue.detail).join('; '))
})

test('experimental note XLSX round-trips classic note provenance through secure import',async()=>{
  const file=await exportWorkspaceXlsxWithClassicNotes(workspace())
  const plan=await planSecureOfficeImport(cloneSeedWorkspace(),file.bytes,'roundtrip.xlsx')
  const replacement=plan.commands.find((command)=>command.type==='data.imported.replace')
  assert.ok(replacement)
  const table=replacement.tables.find((item)=>item.label==='Pipeline')
  assert.ok(table)
  const comment=Object.values(table.commentByCell??{})[0]
  assert.deepEqual(comment,{text:'Validate renewal assumption',author:'Alice'})
})
