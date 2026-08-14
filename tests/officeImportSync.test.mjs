import assert from 'node:assert/strict'
import test from 'node:test'
import { withImportedTables } from '../src/importedTables.ts'
import { cloneSeedWorkspace } from '../src/model.ts'
import { synchronizeOfficeImportPlan } from '../src/officeImportSync.ts'
import { getPresentationState, withPresentationState } from '../src/presentationState.ts'
import { getSemanticDocument, withSemanticDocument } from '../src/semanticDocument.ts'

test('DOCX re-import removes prior blocks from the same source and inserts replacement content at the prior location',()=>{
  let workspace=cloneSeedWorkspace()
  const semantic=getSemanticDocument(workspace)
  semantic.blocks.splice(1,0,{id:'block:old-docx-1',type:'paragraph',text:'Old A',source:'strategy.docx'},{id:'block:old-docx-2',type:'paragraph',text:'Old B',source:'strategy.docx'})
  workspace=withSemanticDocument(workspace,semantic)
  const plan={kind:'docx',label:'strategy.docx',warnings:[],importedItems:1,commands:[{type:'document.block.insert',index:semantic.blocks.length,block:{id:'block:new-docx',type:'paragraph',text:'New strategy',source:'strategy.docx'}}]}
  const synced=synchronizeOfficeImportPlan(workspace,plan,'strategy.docx')
  assert.deepEqual(synced.commands.slice(0,2).map((command)=>command.type),['document.block.remove','document.block.remove'])
  assert.deepEqual(synced.commands.slice(0,2).map((command)=>command.blockId),['block:old-docx-1','block:old-docx-2'])
  assert.equal(synced.commands[2].type,'document.block.insert')
  assert.equal(synced.commands[2].index,1)
})

test('DOCX/XLSX re-import replaces prior imported tables from the same source while retaining unrelated tables',()=>{
  let workspace=cloneSeedWorkspace()
  const prior={id:'table:prior',label:'Old table',source:'model.xlsx',importedAt:'before',columns:[{id:'value',label:'Value',type:'number'}],rows:[{id:'row:old',values:{value:1}}]}
  const unrelated={id:'table:other',label:'Other',source:'other.xlsx',importedAt:'before',columns:[{id:'value',label:'Value',type:'number'}],rows:[{id:'row:other',values:{value:3}}]}
  workspace=withImportedTables(workspace,[prior,unrelated])
  const replacement={id:'table:new',label:'New table',source:'model.xlsx',importedAt:'now',columns:[{id:'value',label:'Value',type:'number'}],rows:[{id:'row:new',values:{value:2}}]}
  const plan={kind:'xlsx',label:'model.xlsx',warnings:[],importedItems:1,commands:[{type:'data.imported.replace',tables:[prior,unrelated,replacement]}]}
  const synced=synchronizeOfficeImportPlan(workspace,plan,'model.xlsx')
  const tables=synced.commands[0].tables
  assert.deepEqual(tables.map((table)=>table.id),['table:other','table:new'])
})

test('re-import removes stale source tables even when the new version no longer needs a generic table',()=>{
  let workspace=cloneSeedWorkspace()
  workspace=withImportedTables(workspace,[{id:'table:prior',label:'Old formula sheet',source:'model.xlsx',importedAt:'before',columns:[{id:'value',label:'Value',type:'number'}],rows:[{id:'row:old',values:{value:1}}]}])
  const plan={kind:'xlsx',label:'model.xlsx',warnings:[],importedItems:1,commands:[{type:'region.update',regionId:'apac',field:'revenue',value:10}]}
  const synced=synchronizeOfficeImportPlan(workspace,plan,'model.xlsx')
  assert.equal(synced.commands.at(-1).type,'data.imported.replace')
  assert.deepEqual(synced.commands.at(-1).tables,[])
})

test('PPTX re-import replaces only scenes from the same source and retains unrelated authored/imported state',()=>{
  let workspace=cloneSeedWorkspace()
  const state=getPresentationState(workspace)
  const old={id:'imported:old',title:'Old deck slide',body:['old'],source:'board.pptx · imported from PowerPoint / Google Slides export',note:'old note'}
  const other={id:'imported:other',title:'Other deck',body:['other'],source:'other.pptx · imported from PowerPoint / Google Slides export'}
  workspace=withPresentationState(workspace,{...state,importedScenes:[old,other],order:[...state.order,old.id,other.id],hiddenSceneIds:[old.id],notes:{...state.notes,[old.id]:'override'}})
  const current=getPresentationState(workspace)
  const fresh={id:'imported:fresh',title:'Fresh deck slide',body:['fresh'],source:'board.pptx · imported from PowerPoint / Google Slides export',note:'fresh note'}
  const plan={kind:'pptx',label:'board.pptx',warnings:[],importedItems:1,commands:[{type:'presentation.replace',value:{...current,importedScenes:[...current.importedScenes,fresh],order:[...current.order,fresh.id]}}]}
  const synced=synchronizeOfficeImportPlan(workspace,plan,'board.pptx')
  const next=synced.commands[0].value
  assert.deepEqual(next.importedScenes.map((scene)=>scene.id),['imported:other','imported:fresh'])
  assert.equal(next.order.includes('imported:old'),false)
  assert.equal(next.order.includes('imported:other'),true)
  assert.equal(next.order.at(-1),'imported:fresh')
  assert.equal(next.hiddenSceneIds.includes('imported:old'),false)
  assert.equal(next.notes['imported:old'],undefined)
})
