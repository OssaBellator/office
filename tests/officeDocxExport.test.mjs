import assert from 'node:assert/strict'
import test from 'node:test'
import { exportWorkspaceDocx } from '../src/officeExport.ts'
import { readOfficeXml, readOfficeZip } from '../src/officeArchive.ts'
import { parseDocxDocumentXml } from '../src/officeParsers.ts'
import { cloneSeedWorkspace } from '../src/model.ts'
import { getSemanticDocument, withSemanticDocument } from '../src/semanticDocument.ts'

test('DOCX compatibility export uses native Word numbering for Frame list blocks',async()=>{
  let workspace=cloneSeedWorkspace()
  const semantic=getSemanticDocument(workspace)
  semantic.blocks.push(
    {id:'block:bullet-export',type:'paragraph',text:'Prioritize APAC partners',style:'bullet'},
    {id:'block:number-export',type:'paragraph',text:'Approve launch sequencing',style:'numbered'},
  )
  workspace=withSemanticDocument(workspace,semantic)
  const file=exportWorkspaceDocx(workspace)
  const entries=await readOfficeZip(file.bytes)
  const document=readOfficeXml(entries,'word/document.xml')
  const numbering=readOfficeXml(entries,'word/numbering.xml')
  assert.ok(document);assert.ok(numbering)
  assert.match(document,/<w:numId w:val="1"\/>/)
  assert.match(document,/<w:numId w:val="2"\/>/)
  const parsed=parseDocxDocumentXml(document,numbering)
  assert.equal(parsed.some((block)=>block.kind==='bullet'&&block.text==='Prioritize APAC partners'),true)
  assert.equal(parsed.some((block)=>block.kind==='numbered'&&block.text==='Approve launch sequencing'),true)
})

test('DOCX compatibility export includes Frame review context and imported-block provenance',async()=>{
  let workspace=cloneSeedWorkspace()
  const semantic=getSemanticDocument(workspace)
  semantic.blocks.push({id:'block:imported-docx-export',type:'paragraph',text:'Imported operating principle',style:'heading-2',source:'legacy-strategy.docx'})
  semantic.annotations.push({id:'annotation:export-review',blockId:'block:imported-docx-export',kind:'comment',body:'Confirm with Finance before circulation.',owner:'Strategy',status:'open'})
  workspace=withSemanticDocument(workspace,semantic)
  const file=exportWorkspaceDocx(workspace)
  const entries=await readOfficeZip(file.bytes)
  const document=readOfficeXml(entries,'word/document.xml')
  assert.match(document,/Imported from legacy-strategy\.docx/)
  assert.match(document,/COMMENT · Strategy · open: Confirm with Finance before circulation\./)
  const parsed=parseDocxDocumentXml(document,readOfficeXml(entries,'word/numbering.xml'))
  assert.equal(parsed.some((block)=>block.text==='Imported operating principle'&&block.kind==='heading-2'),true)
  assert.equal(parsed.some((block)=>block.text==='Review'&&block.kind==='heading-3'),true)
})
