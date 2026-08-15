import assert from 'node:assert/strict'
import test from 'node:test'
import { withImportedTables } from '../src/importedTables.ts'
import { cloneSeedWorkspace } from '../src/model.ts'
import { assessOfficeExport } from '../src/officeExportAssessment.ts'
import { getWorkspaceReviews, withWorkspaceReviews } from '../src/workspaceReviews.ts'

test('Office export assessment counts preserved spreadsheet fidelity and native Excel review',()=>{
  let workspace=cloneSeedWorkspace()
  workspace=withImportedTables(workspace,[{id:'table:flags',label:'Flags',source:'model.xlsx',importedAt:'now',sourceVisibility:'hidden',sourceDateSystem:'1900',columns:[{id:'enabled',label:'Enabled',type:'boolean'},{id:'ratio',label:'Ratio',type:'number'}],rows:[{id:'row:1',values:{enabled:true,ratio:.42}}],formulaByCell:{'row:1\u0000ratio':'21/50'},numberFormatByCell:{'row:1\u0000ratio':{numFmtId:10}},linkByCell:{'row:1\u0000ratio':{kind:'external',target:'https://example.com/model'}},commentByCell:{'row:1\u0000ratio':{text:'Validate margin assumption',author:'Alice',sourceRef:'B2'}},threadByCell:{'row:1\u0000enabled':{comments:[{id:'thread:1',personId:'person:alice',author:'Alice',text:'Review control',done:false},{id:'thread:2',personId:'person:bob',author:'Bob',text:'Reviewed',parentId:'thread:1'}]}},promotedReviews:[{id:'frame-review:margin',objectId:'table:table:flags:row:1',label:'Flags · Ratio',kind:'task',body:'Validate margin assumption',owner:'Finance',status:'open',createdAt:'now',sourceReview:{kind:'excel-note',source:'model.xlsx',tableId:'table:flags',rowId:'row:1',columnId:'ratio',sourceReviewId:'excel-note:model.xlsx:Flags:B2'}}]}])
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
  assert.equal(assessment.xlsx.promotedReviewItems,1)
  assert.equal(assessment.xlsx.openPromotedReviews,1)
  assert.equal(assessment.docx.sourceReviewComments,0)
  assert.equal(assessment.docx.promotedReviewItems,0)
  assert.equal(assessment.xlsx.booleanCells,1)
  assert.equal(assessment.xlsx.hiddenTables,1)
  assert.equal(assessment.warnings.some((warning)=>/cached values only/.test(warning)),true)
  assert.equal(assessment.warnings.some((warning)=>/projected back into XLSX/.test(warning)),true)
  assert.equal(assessment.warnings.some((warning)=>/Frame review provenance/.test(warning)),true)
  assert.equal(assessment.warnings.some((warning)=>/omitted from the default XLSX projection rather than flattened into legacy notes/.test(warning)),true)
  assert.equal(assessment.warnings.some((warning)=>/linked to Excel source review/.test(warning)),true)
})

test('Word source and promoted review stay in DOCX assessment rather than Excel counts',()=>{
  let workspace=cloneSeedWorkspace()
  const sourceReview={id:'source-review:word-comment:strategy.docx:7',objectId:'block:business-snapshot',label:'Word comment · Snapshot',kind:'comment',body:'Confirm wording',owner:'Editor',status:'open',createdAt:'source',sourceOnly:true,sourceReview:{kind:'word-comment',source:'strategy.docx',blockId:'block:business-snapshot',sourceReviewId:'word-comment:strategy.docx:7'}}
  const promoted={id:'frame-review:word-comment:strategy.docx:7',objectId:'document:strategy',label:'Strategy document · detached source review',kind:'task',body:'Confirm wording before board send',owner:'Legal',status:'open',createdAt:'now',sourceDetached:true,sourceReview:{kind:'word-comment',source:'strategy.docx',blockId:'block:business-snapshot',sourceReviewId:'word-comment:strategy.docx:7'}}
  workspace=withWorkspaceReviews(workspace,[...getWorkspaceReviews(workspace),sourceReview,promoted])
  const assessment=assessOfficeExport(workspace)
  assert.equal(assessment.docx.sourceReviewComments,1)
  assert.equal(assessment.docx.promotedReviewItems,1)
  assert.equal(assessment.docx.openPromotedReviews,1)
  assert.equal(assessment.docx.detachedPromotedReviews,1)
  assert.equal(assessment.xlsx.promotedReviewItems,0)
  assert.equal(assessment.xlsx.openPromotedReviews,0)
  assert.equal(assessment.warnings.some((warning)=>/imported Word source comment/.test(warning)),true)
  assert.equal(assessment.warnings.some((warning)=>/linked to Word source comment/.test(warning)),true)
  assert.equal(assessment.warnings.some((warning)=>/detached from current source anchor/.test(warning)),true)
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
