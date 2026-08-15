import assert from 'node:assert/strict'
import test from 'node:test'
import { deserializeWorkspaceCommand, serializeWorkspaceCommand } from '../src/commandCodec.ts'
import { getImportedTableThread, withImportedTables } from '../src/importedTables.ts'
import { cloneSeedWorkspace } from '../src/model.ts'
import { createStoredZip, exportWorkspaceXlsx } from '../src/officeExport.ts'
import { planSecureOfficeImport } from '../src/officeSecureImport.ts'
import { readOfficeZip } from '../src/officeArchive.ts'
import { searchWorkspace } from '../src/searchIndex.ts'
import { listWorkspaceReviewInbox } from '../src/workspaceReviewInbox.ts'
import { compareWorkspaceStatesWithReview } from '../src/workspaceReviewCompare.ts'
import { parseXlsxPersons, parseXlsxThreadedComments } from '../src/xlsxThreadedCommentImport.ts'

const ALICE='{11111111-1111-1111-1111-111111111111}'
const BOB='{22222222-2222-2222-2222-222222222222}'
const ROOT='{aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa}'
const REPLY='{bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb}'
const MENTION='{cccccccc-cccc-cccc-cccc-cccccccccccc}'

function threadedWorkbook(){
  return createStoredZip({
    '[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/threadedComments/threadedComment1.xml" ContentType="application/vnd.ms-excel.threadedcomments+xml"/><Override PartName="/xl/persons/person.xml" ContentType="application/vnd.ms-excel.person+xml"/></Types>',
    '_rels/.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml':'<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Pipeline" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels':'<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rIdPeople" Type="http://schemas.microsoft.com/office/2017/10/relationships/person" Target="persons/person.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml':'<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Account</t></is></c><c r="B1" t="inlineStr"><is><t>ARR</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>Acme</t></is></c><c r="B2"><v>2.4</v></c></row></sheetData></worksheet>',
    'xl/worksheets/_rels/sheet1.xml.rels':'<Relationships><Relationship Id="rIdThread" Type="http://schemas.microsoft.com/office/2017/10/relationships/threadedComment" Target="../threadedComments/threadedComment1.xml"/></Relationships>',
    'xl/persons/person.xml':`<personList xmlns="http://schemas.microsoft.com/office/spreadsheetml/2018/threadedcomments"><person displayName="Alice Chen" id="${ALICE}" userId="alice@example.com" providerId="PeoplePicker"/><person displayName="Bob Singh" id="${BOB}" userId="bob@example.com" providerId="PeoplePicker"/></personList>`,
    'xl/threadedComments/threadedComment1.xml':`<ThreadedComments xmlns="http://schemas.microsoft.com/office/spreadsheetml/2018/threadedcomments"><threadedComment ref="B2" dT="2026-08-14T23:00:00Z" personId="${ALICE}" id="${ROOT}" done="0"><text>@Bob please validate renewal assumption</text><mentions><mention mentionpersonId="${BOB}" mentionId="${MENTION}" startIndex="0" length="4"/></mentions></threadedComment><threadedComment dT="2026-08-14T23:12:00Z" personId="${BOB}" id="${REPLY}" parentId="${ROOT}"><text>Validated against the renewal schedule.</text></threadedComment></ThreadedComments>`,
  })
}

function importedThreadTable(reply='Validated against the renewal schedule.'){
  return{id:'table:pipeline',label:'Pipeline',source:'threaded.xlsx',importedAt:'now',columns:[{id:'account',label:'Account',type:'text'},{id:'arr',label:'ARR',type:'number'}],rows:[{id:'row:1',values:{account:'Acme',arr:2.4}}],threadByCell:{'row:1\u0000arr':{comments:[{id:ROOT,personId:ALICE,author:'Alice Chen',text:'@Bob please validate renewal assumption',createdAt:'2026-08-14T23:00:00Z',done:false,mentions:[{personId:BOB,mentionId:MENTION,startIndex:0,length:4,displayName:'Bob Singh'}]},{id:REPLY,personId:BOB,author:'Bob Singh',text:reply,parentId:ROOT,createdAt:'2026-08-14T23:12:00Z'}]}}}
}

test('threaded comment parser resolves persons, mentions and reply cell inheritance',()=>{
  const people=parseXlsxPersons(`<personList><person displayName="Alice Chen" id="${ALICE}"/><person displayName="Bob Singh" id="${BOB}"/></personList>`)
  const threads=parseXlsxThreadedComments(`<ThreadedComments><threadedComment ref="B2" personId="${ALICE}" id="${ROOT}" done="false"><text>@Bob review</text><mentions><mention mentionpersonId="${BOB}" mentionId="${MENTION}" startIndex="0" length="4"/></mentions></threadedComment><threadedComment personId="${BOB}" id="${REPLY}" parentId="${ROOT}"><text>Done</text></threadedComment></ThreadedComments>`,people)
  assert.equal(threads.size,1)
  assert.equal(threads.get('B2').comments.length,2)
  assert.equal(threads.get('B2').comments[0].author,'Alice Chen')
  assert.equal(threads.get('B2').comments[0].mentions[0].displayName,'Bob Singh')
  assert.equal(threads.get('B2').comments[1].parentId,ROOT)
})

test('secure XLSX import preserves threaded review conversations with participants and replies',async()=>{
  const plan=await planSecureOfficeImport(cloneSeedWorkspace(),threadedWorkbook(),'threaded.xlsx')
  const replacement=plan.commands.find((command)=>command.type==='data.imported.replace')
  assert.ok(replacement)
  const table=replacement.tables.find((item)=>item.label==='Pipeline')
  assert.ok(table)
  const thread=getImportedTableThread(table,table.rows[0].id,'arr')
  assert.ok(thread)
  assert.equal(thread.comments.length,2)
  assert.deepEqual(thread.comments.map((comment)=>comment.author),['Alice Chen','Bob Singh'])
  assert.equal(thread.comments[1].parentId,ROOT)
  assert.equal(thread.comments[0].mentions[0].displayName,'Bob Singh')
  assert.equal(thread.comments[0].done,false)
  assert.equal(plan.warnings.some((warning)=>/1 Excel review thread was preserved with 2 comments/.test(warning)),true)
  assert.equal(plan.warnings.some((warning)=>/threaded comments are not imported yet/i.test(warning)),false)
})

test('threaded review provenance survives command decoding and appears in search and unified review inbox',()=>{
  const command={type:'data.imported.replace',tables:[importedThreadTable()]}
  assert.deepEqual(deserializeWorkspaceCommand(serializeWorkspaceCommand(command)),command)
  const workspace=withImportedTables(cloneSeedWorkspace(),[importedThreadTable()])
  assert.equal(searchWorkspace(workspace,'Alice Bob renewal validated',{kinds:['table']})[0].id,'table:table:pipeline')
  const item=listWorkspaceReviewInbox(workspace).find((entry)=>entry.origin==='imported-excel-thread')
  assert.ok(item)
  assert.equal(item.kind,'source-thread')
  assert.equal(item.replyCount,1)
  assert.equal(item.sourceStatus,'open')
  assert.deepEqual(item.participants,['Alice Chen','Bob Singh'])
})

test('runtime codec rejects threaded replies whose parent does not exist in the same cell thread',()=>{
  const command={type:'data.imported.replace',tables:[importedThreadTable()]}
  command.tables[0].threadByCell['row:1\u0000arr'].comments[1].parentId='{missing-parent}'
  assert.throws(()=>deserializeWorkspaceCommand(serializeWorkspaceCommand(command)),/unknown parent/)
})

test('semantic comparison versions threaded conversation changes separately from cell values',()=>{
  const before=withImportedTables(cloneSeedWorkspace(),[importedThreadTable('Validated against the renewal schedule.')])
  const after=withImportedTables(cloneSeedWorkspace(),[importedThreadTable('Validated with Finance and RevOps.')])
  const diffs=compareWorkspaceStatesWithReview(before,after)
  assert.equal(diffs.some((diff)=>diff.objectId==='table:table:pipeline:row:1'&&diff.field==='ARR'),false)
  const reviewDiff=diffs.find((diff)=>diff.objectId==='table:table:pipeline:row:1'&&diff.field==='ARR review thread')
  assert.ok(reviewDiff)
  assert.match(String(reviewDiff.before),/renewal schedule/)
  assert.match(String(reviewDiff.after),/Finance and RevOps/)
})

test('default XLSX projection keeps threaded review conversations Frame-only',async()=>{
  const workspace=withImportedTables(cloneSeedWorkspace(),[importedThreadTable()])
  const entries=await readOfficeZip(exportWorkspaceXlsx(workspace).bytes)
  assert.equal([...entries.keys()].some((path)=>/^xl\/threadedComments\//i.test(path)),false)
  assert.equal([...entries.keys()].some((path)=>/^xl\/persons\//i.test(path)),false)
})
