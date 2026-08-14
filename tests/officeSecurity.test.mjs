import assert from 'node:assert/strict'
import test from 'node:test'
import { withImportedTables } from '../src/importedTables.ts'
import { cloneSeedWorkspace } from '../src/model.ts'
import { exportWorkspaceDocx, exportWorkspacePptx, exportWorkspaceXlsx } from '../src/officeExport.ts'
import { readOfficeXml, readOfficeZip } from '../src/officeArchive.ts'
import { getSemanticDocument, withSemanticDocument } from '../src/semanticDocument.ts'

test('DOCX export XML-escapes imported/user text instead of creating markup',async()=>{
  let workspace=cloneSeedWorkspace(),semantic=getSemanticDocument(workspace)
  semantic.blocks.push({id:'block:xml',type:'paragraph',text:'<script>alert("x")</script> & revenue',source:'evil<&>.docx'})
  workspace=withSemanticDocument(workspace,semantic)
  const entries=await readOfficeZip(exportWorkspaceDocx(workspace).bytes)
  const document=readOfficeXml(entries,'word/document.xml')
  assert.equal(document.includes('<script>'),false)
  assert.match(document,/&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt; &amp; revenue/)
  assert.match(document,/evil&lt;&amp;&gt;\.docx/)
})

test('XLSX export writes formula-looking foreign text as inline strings, never formulas',async()=>{
  let workspace=cloneSeedWorkspace()
  workspace=withImportedTables(workspace,[{id:'table:formula-injection',label:'Payloads',source:'payload.xlsx',importedAt:'now',columns:[{id:'text',label:'Text',type:'text'}],rows:[{id:'row:1',values:{text:'=HYPERLINK("https://example.invalid","click")'}},{id:'row:2',values:{text:'@SUM(1,2)'}}]}])
  const entries=await readOfficeZip(exportWorkspaceXlsx(workspace).bytes)
  const sheet=readOfficeXml(entries,'xl/worksheets/sheet3.xml')
  assert.equal(sheet.includes('<f'),false)
  assert.match(sheet,/t="inlineStr"/)
  assert.match(sheet,/=HYPERLINK\(&quot;https:\/\/example\.invalid&quot;,&quot;click&quot;\)/)
  assert.match(sheet,/@SUM\(1,2\)/)
})

test('PPTX export XML-escapes scene text and speaker notes',async()=>{
  const workspace=cloneSeedWorkspace()
  workspace.title='Frame <Board> & "Review"'
  workspace.document.title='Strategy <unsafe> & review'
  const entries=await readOfficeZip(exportWorkspacePptx(workspace).bytes)
  const presentation=readOfficeXml(entries,'ppt/presentation.xml')
  assert.ok(presentation)
  for(const path of [...entries.keys()].filter((path)=>/^ppt\/(?:slides|notesSlides)\/.+\.xml$/.test(path))){
    const value=readOfficeXml(entries,path)
    assert.equal(value.includes('<unsafe>'),false)
  }
})
