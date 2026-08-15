import assert from 'node:assert/strict'
import test from 'node:test'
import { withImportedTables } from '../src/importedTables.ts'
import { cloneSeedWorkspace } from '../src/model.ts'
import { assessOfficeExport } from '../src/officeExportAssessment.ts'

test('Office export assessment counts preserved spreadsheet fidelity',()=>{
  let workspace=cloneSeedWorkspace()
  workspace=withImportedTables(workspace,[{id:'table:flags',label:'Flags',source:'model.xlsx',importedAt:'now',sourceVisibility:'hidden',sourceDateSystem:'1900',columns:[{id:'enabled',label:'Enabled',type:'boolean'},{id:'ratio',label:'Ratio',type:'number'}],rows:[{id:'row:1',values:{enabled:true,ratio:.42}}],formulaByCell:{'row:1\u0000ratio':'21/50'},numberFormatByCell:{'row:1\u0000ratio':{numFmtId:10}},linkByCell:{'row:1\u0000ratio':{kind:'external',target:'https://example.com/model'}},commentByCell:{'row:1\u0000ratio':{text:'Validate margin assumption',author:'Alice'}},threadByCell:{'row:1\u0000enabled':{comments:[{id:'thread:1',personId:'person:alice',author:'Alice',text:'Review control',done:false},{id:'thread:2',personId:'person:bob',author:'Bob',text:'Reviewed',parentId:'thread:1'}]}}}])
  const assessment=assessOfficeExport(workspace)
  assert.equal(assessment.xlsx.tables,3)
  assert.equal(assessment.xlsx.formulaCells,1)
  assert.equal(assessment.xlsx.numberFormatCells,1)
  assert.equal(assessment.xlsx.hyperlinkCells,1)
  assert.equal(assessment.xlsx.exportableHyperlinkCells,1)
  assert.equal(assessment.xlsx.suppressedHyperlinkCells,0)
  assert.equal(assessment.xlsx.reviewNoteCells,1)
  assert.equal(assessment.xlsx.reviewThreadCells,1)
  assert.equal(assessment.xlsx.threadedComments,2)
  assert.equal(assessment.xlsx.openReviewThreads,1)
  assert.equal(assessment.xlsx.booleanCells,1)
  assert.equal(assessment.xlsx.hiddenTables,1)
  assert.equal(assessment.warnings.some((warning)=>/cached values only/.test(warning)),true)
  assert.equal(assessment.warnings.some((warning)=>/projected back into XLSX/.test(warning)),true)
  assert.equal(assessment.warnings.some((warning)=>/Frame review provenance/.test(warning)),true)
  assert.equal(assessment.warnings.some((warning)=>/omitted from the default XLSX projection rather than flattened into legacy notes/.test(warning)),true)
})

test('Office export assessment distinguishes inert external hyperlinks from exportable links',()=>{
  let workspace=cloneSeedWorkspace()
  workspace=withImportedTables(workspace,[{id:'table:links',label:'Links',source:'links.xlsx',importedAt:'now',columns:[{id:'safe',label:'Safe',type:'text'},{id:'internal',label:'Internal',type:'text'},{id:'unsafe',label:'Unsafe',type:'text'}],rows:[{id:'row:1',values:{safe:'Web',internal:'Jump',unsafe:'File'}}],linkByCell:{'row:1\u0000safe':{kind:'external',target:'https://example.com'},'row:1\u0000internal':{kind:'internal',target:'Sheet2!A1'},'row:1\u0000unsafe':{kind:'external',target:'file:///legacy.xlsx'}}}])
  const assessment=assessOfficeExport(workspace)
  assert.equal(assessment.xlsx.hyperlinkCells,3)
  assert.equal(assessment.xlsx.exportableHyperlinkCells,2)
  assert.equal(assessment.xlsx.suppressedHyperlinkCells,1)
  assert.equal(assessment.warnings.some((warning)=>/file\/custom\/unsupported scheme/.test(warning)),true)
})

test('Office export assessment flags date-like formats suppressed across mixed date systems',()=>{
  let workspace=cloneSeedWorkspace()
  workspace=withImportedTables(workspace,[
    {id:'table:mac',label:'Mac',source:'mac.xlsx',importedAt:'now',sourceDateSystem:'1904',columns:[{id:'date',label:'Date',type:'number'}],rows:[{id:'mac:1',values:{date:45000}}],numberFormatByCell:{'mac:1\u0000date':{numFmtId:165,formatCode:'yyyy-mm-dd'}}},
    {id:'table:win',label:'Win',source:'win.xlsx',importedAt:'now',sourceDateSystem:'1900',columns:[{id:'date',label:'Date',type:'number'}],rows:[{id:'win:1',values:{date:45000}}],numberFormatByCell:{'win:1\u0000date':{numFmtId:14}}},
  ])
  const assessment=assessOfficeExport(workspace)
  assert.deepEqual(assessment.xlsx.sourceDateSystems,['1900','1904'])
  assert.equal(assessment.xlsx.suppressedDateLikeFormatCells,1)
  assert.equal(assessment.warnings.some((warning)=>/intentionally omitted/.test(warning)),true)
})
