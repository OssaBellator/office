import assert from 'node:assert/strict'
import test from 'node:test'
import { withImportedTables } from '../src/importedTables.ts'
import { cloneSeedWorkspace } from '../src/model.ts'
import { createStoredZip } from '../src/officeExport.ts'
import { exportWorkspaceXlsxWithClassicNotes } from '../src/officeXlsxNotesExport.ts'
import { validateXlsxClassicNotes } from '../src/xlsxClassicNoteValidator.ts'

function workspace(){return withImportedTables(cloneSeedWorkspace(),[{id:'table:pipeline',label:'Pipeline',source:'pipeline.xlsx',importedAt:'now',columns:[{id:'arr',label:'ARR',type:'number'}],rows:[{id:'row:1',values:{arr:2.4}},{id:'row:2',values:{arr:1.1}}],commentByCell:{'row:1\u0000arr':{text:'Validate',author:'Alice'},'row:2\u0000arr':{text:'Confirm',author:'Bob'}}}])}

test('experimental Frame note export passes note-specific coherence validation',async()=>{
  const file=await exportWorkspaceXlsxWithClassicNotes(workspace())
  const validation=await validateXlsxClassicNotes(file.bytes)
  assert.equal(validation.valid,true,validation.issues.map((issue)=>issue.detail).join('; '))
  assert.equal(validation.noteSheets,1)
  assert.equal(validation.comments,2)
  assert.equal(validation.shapes,2)
})

test('note validator detects missing VML and shape mismatches',async()=>{
  const broken=createStoredZip({
    '[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/comments1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.comments+xml"/></Types>',
    'xl/worksheets/sheet1.xml':'<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetData/><legacyDrawing r:id="rId2"/></worksheet>',
    'xl/worksheets/_rels/sheet1.xml.rels':'<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="../comments1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/vmlDrawing" Target="../drawings/missing.vml"/></Relationships>',
    'xl/comments1.xml':'<comments><authors><author>Alice</author></authors><commentList><comment ref="A1" authorId="0"><text><t>Review</t></text></comment></commentList></comments>',
  })
  const validation=await validateXlsxClassicNotes(broken)
  assert.equal(validation.valid,false)
  assert.equal(validation.issues.some((issue)=>issue.kind==='missing-vml-part'),true)
})
