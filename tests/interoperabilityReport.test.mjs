import assert from 'node:assert/strict'
import test from 'node:test'
import { describeWorkspaceInteropState, groupInteropWarnings, summarizeOfficeImportPlan } from '../src/interoperabilityReport.ts'
import { withImportedTables } from '../src/importedTables.ts'
import { cloneSeedWorkspace } from '../src/model.ts'
import { getPresentationState, withPresentationState } from '../src/presentationState.ts'
import { getSemanticDocument, withSemanticDocument } from '../src/semanticDocument.ts'

test('interop warnings are grouped by fidelity concern',()=>{
  const groups=groupInteropWarnings(['Embedded images are not imported','PowerPoint theme geometry changes','Excel formula text is preserved','Tracked revisions are flattened'])
  assert.deepEqual(Object.fromEntries(groups.map((group)=>[group.kind,group.count])),{media:1,layout:1,formula:1,review:1})
})

test('Office import report summarizes command mix and preserved semantic content',()=>{
  const plan={kind:'xlsx',label:'model.xlsx',importedItems:2,warnings:['Excel formula text is preserved'],commands:[
    {type:'region.update',regionId:'apac',field:'revenue',value:10},
    {type:'data.imported.replace',tables:[{id:'table:x',label:'Sheet',source:'model.xlsx',importedAt:'now',columns:[{id:'value',label:'Value',type:'number'}],rows:[{id:'row:1',values:{value:10}}],formulaByCell:{'row:1\u0000value':'5+5'}}]},
  ]}
  const report=summarizeOfficeImportPlan(plan)
  assert.equal(report.commandCount,2)
  assert.equal(report.commandTypes['region.update'],1)
  assert.equal(report.preserved.tables,1)
  assert.equal(report.preserved.formulaCells,1)
  assert.equal(report.warningGroups[0].kind,'formula')
})

test('workspace interop state reports imported provenance across Docs Data and Present',()=>{
  let workspace=cloneSeedWorkspace()
  const semantic=getSemanticDocument(workspace)
  semantic.blocks.push({id:'block:interop',type:'paragraph',text:'Imported',source:'strategy.docx'})
  workspace=withSemanticDocument(workspace,semantic)
  workspace=withImportedTables(workspace,[{id:'table:interop',label:'Pipeline',source:'model.xlsx',importedAt:'now',columns:[{id:'arr',label:'ARR',type:'number'}],rows:[{id:'row:1',values:{arr:2.4}}],formulaByCell:{'row:1\u0000arr':'1.2+1.2'}}])
  const presentation=getPresentationState(workspace)
  workspace=withPresentationState(workspace,{...presentation,importedScenes:[{id:'imported:interop',title:'Imported slide',body:[],source:'board.pptx · imported from PowerPoint / Google Slides export'}],order:[...presentation.order,'imported:interop']})
  const state=describeWorkspaceInteropState(workspace)
  assert.deepEqual(state.importedDocumentSources,['strategy.docx'])
  assert.deepEqual(state.importedTableSources,['model.xlsx'])
  assert.equal(state.preservedFormulaCells,1)
  assert.equal(state.importedScenes,1)
  assert.equal(state.importedSceneSources[0].startsWith('board.pptx'),true)
})
