import assert from 'node:assert/strict'
import test from 'node:test'
import { describeWorkspaceInteropState, groupInteropWarnings, summarizeOfficeImportPlan } from '../src/interoperabilityReport.ts'
import { withImportedTables } from '../src/importedTables.ts'
import { cloneSeedWorkspace } from '../src/model.ts'
import { getPresentationState, withPresentationState } from '../src/presentationState.ts'
import { getSemanticDocument, withSemanticDocument } from '../src/semanticDocument.ts'

const thread={comments:[{id:'thread:1',personId:'person:alice',author:'Alice',text:'Validate assumption',done:false},{id:'thread:2',personId:'person:bob',author:'Bob',text:'Validated',parentId:'thread:1'}]}

test('interop warnings are grouped by fidelity concern',()=>{
  const groups=groupInteropWarnings(['Embedded images are not imported','PowerPoint theme geometry changes','Excel formula text is preserved','Tracked revisions are flattened','Classic Excel note preserved','Excel review thread preserved','Actuals: source worksheet is hidden','Workbook uses Excel\'s 1904 date system','1 hyperlink uses a non-web scheme'])
  assert.deepEqual(Object.fromEntries(groups.map((group)=>[group.kind,group.count])),{media:1,layout:1,formula:1,review:3,visibility:1,formatting:1,'external-data':1})
})

test('Office import report summarizes command mix and preserved semantic content',()=>{
  const plan={kind:'xlsx',label:'model.xlsx',importedItems:2,warnings:['Excel formula text is preserved','Classic Excel cell note was preserved','Excel review thread was preserved','Sheet: source worksheet is hidden','Workbook uses Excel\'s 1904 date system','1 hyperlink uses a non-web scheme'],commands:[
    {type:'region.update',regionId:'apac',field:'revenue',value:10},
    {type:'data.imported.replace',tables:[{id:'table:x',label:'Sheet',source:'model.xlsx',importedAt:'now',sourceVisibility:'hidden',sourceDateSystem:'1904',columns:[{id:'value',label:'Value',type:'number'},{id:'enabled',label:'Enabled',type:'boolean'}],rows:[{id:'row:1',values:{value:10,enabled:true}},{id:'row:2',values:{value:9,enabled:false}}],formulaByCell:{'row:1\u0000value':'5+5'},numberFormatByCell:{'row:1\u0000value':{numFmtId:165,formatCode:'0.00'}},linkByCell:{'row:1\u0000value':{kind:'external',target:'https://example.com'},'row:2\u0000value':{kind:'external',target:'file:///legacy.xlsx'}},commentByCell:{'row:1\u0000value':{text:'Validate assumption',author:'Alice'}},threadByCell:{'row:2\u0000value':thread}}]},
  ]}
  const report=summarizeOfficeImportPlan(plan)
  assert.equal(report.commandCount,2)
  assert.equal(report.commandTypes['region.update'],1)
  assert.equal(report.preserved.tables,1)
  assert.equal(report.preserved.formulaCells,1)
  assert.equal(report.preserved.formattedCells,1)
  assert.equal(report.preserved.hyperlinkCells,2)
  assert.equal(report.preserved.inertHyperlinkCells,1)
  assert.equal(report.preserved.reviewNoteCells,1)
  assert.equal(report.preserved.reviewThreadCells,1)
  assert.equal(report.preserved.threadedComments,2)
  assert.equal(report.preserved.openReviewThreads,1)
  assert.equal(report.preserved.booleanCells,2)
  assert.equal(report.preserved.hiddenTables,1)
  assert.equal(report.preserved.veryHiddenTables,0)
  assert.equal(report.preserved.date1904Tables,1)
  assert.equal(report.warningGroups.some((group)=>group.kind==='formula'),true)
  assert.equal(report.warningGroups.some((group)=>group.kind==='review'),true)
  assert.equal(report.warningGroups.some((group)=>group.kind==='visibility'),true)
  assert.equal(report.warningGroups.some((group)=>group.kind==='formatting'),true)
  assert.equal(report.warningGroups.some((group)=>group.kind==='external-data'),true)
})

test('workspace interop state reports imported provenance across Docs Data and Present',()=>{
  let workspace=cloneSeedWorkspace()
  const semantic=getSemanticDocument(workspace)
  semantic.blocks.push({id:'block:interop',type:'paragraph',text:'Imported',source:'strategy.docx'})
  workspace=withSemanticDocument(workspace,semantic)
  workspace=withImportedTables(workspace,[
    {id:'table:interop',label:'Pipeline',source:'model.xlsx',importedAt:'now',sourceVisibility:'veryHidden',sourceDateSystem:'1904',columns:[{id:'arr',label:'ARR',type:'number'},{id:'active',label:'Active',type:'boolean'}],rows:[{id:'row:1',values:{arr:2.4,active:true}}],formulaByCell:{'row:1\u0000arr':'1.2+1.2'},numberFormatByCell:{'row:1\u0000arr':{numFmtId:4}},linkByCell:{'row:1\u0000arr':{kind:'external',target:'file:///legacy.xlsx'}},commentByCell:{'row:1\u0000arr':{text:'Validate renewal assumption',author:'Alice'}},threadByCell:{'row:1\u0000active':thread}},
  ])
  const presentation=getPresentationState(workspace)
  workspace=withPresentationState(workspace,{...presentation,importedScenes:[{id:'imported:interop',title:'Imported slide',body:[],source:'board.pptx · imported from PowerPoint / Google Slides export'}],order:[...presentation.order,'imported:interop']})
  const state=describeWorkspaceInteropState(workspace)
  assert.deepEqual(state.importedDocumentSources,['strategy.docx'])
  assert.deepEqual(state.importedTableSources,['model.xlsx'])
  assert.equal(state.preservedFormulaCells,1)
  assert.equal(state.preservedNumberFormatCells,1)
  assert.equal(state.preservedHyperlinkCells,1)
  assert.equal(state.inertHyperlinkCells,1)
  assert.equal(state.preservedCellNotes,1)
  assert.equal(state.preservedReviewThreads,1)
  assert.equal(state.preservedThreadedComments,2)
  assert.equal(state.openImportedReviewThreads,1)
  assert.equal(state.preservedBooleanCells,1)
  assert.equal(state.hiddenImportedTables,0)
  assert.equal(state.veryHiddenImportedTables,1)
  assert.equal(state.imported1904DateSystemTables,1)
  assert.equal(state.importedScenes,1)
  assert.equal(state.importedSceneSources[0].startsWith('board.pptx'),true)
})
