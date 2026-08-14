import { getImportedTables } from './importedTables.ts'
import type { WorkspaceState } from './model.ts'
import type { OfficeImportPlan } from './officeImportPlanner.ts'
import { getPresentationState } from './presentationState.ts'
import { getSemanticDocument } from './semanticDocument.ts'

export type InteropWarningKind='media'|'layout'|'review'|'formula'|'formatting'|'external-data'|'structure'|'other'
export type InteropWarningSummary={kind:InteropWarningKind;count:number;warnings:string[]}
export type OfficeImportReport={
  kind:OfficeImportPlan['kind']
  importedItems:number
  commandCount:number
  commandTypes:Record<string,number>
  warningCount:number
  warningGroups:InteropWarningSummary[]
  preserved:{documentBlocks:number;tables:number;formulaCells:number;scenes:number}
}

function warningKind(warning:string):InteropWarningKind{
  const text=warning.toLowerCase()
  if(/image|media|chart|smartart|embedded/.test(text))return'media'
  if(/theme|position|font|geometry|animation|transition/.test(text))return'layout'
  if(/comment|tracked|revision|review|footnote|endnote/.test(text))return'review'
  if(/formula/.test(text))return'formula'
  if(/format|style|merged|date\/number/.test(text))return'formatting'
  if(/external|connection|link/.test(text))return'external-data'
  if(/table|schema|column|header|footer/.test(text))return'structure'
  return'other'
}

export function groupInteropWarnings(warnings:string[]):InteropWarningSummary[]{
  const groups=new Map<InteropWarningKind,string[]>()
  for(const warning of warnings){const kind=warningKind(warning),current=groups.get(kind)??[];current.push(warning);groups.set(kind,current)}
  return [...groups.entries()].map(([kind,items])=>({kind,count:items.length,warnings:items}))
}

export function summarizeOfficeImportPlan(plan:OfficeImportPlan):OfficeImportReport{
  const commandTypes:Record<string,number>={}
  let documentBlocks=0,tables=0,formulaCells=0,scenes=0
  for(const command of plan.commands){
    commandTypes[command.type]=(commandTypes[command.type]??0)+1
    if(command.type==='document.block.insert')documentBlocks+=1
    if(command.type==='data.imported.replace'){
      tables+=command.tables.length
      formulaCells+=command.tables.reduce((count,table)=>count+Object.keys(table.formulaByCell??{}).length,0)
    }
    if(command.type==='presentation.replace')scenes+=command.value.importedScenes?.length??0
  }
  return{kind:plan.kind,importedItems:plan.importedItems,commandCount:plan.commands.length,commandTypes,warningCount:plan.warnings.length,warningGroups:groupInteropWarnings(plan.warnings),preserved:{documentBlocks,tables,formulaCells,scenes}}
}

export function describeWorkspaceInteropState(workspace:WorkspaceState){
  const semantic=getSemanticDocument(workspace)
  const tables=getImportedTables(workspace)
  const presentation=getPresentationState(workspace)
  const importedBlocks=semantic.blocks.filter((block)=>block.type==='paragraph'&&Boolean(block.source))
  return{
    importedDocumentBlocks:importedBlocks.length,
    importedDocumentSources:[...new Set(importedBlocks.flatMap((block)=>block.type==='paragraph'&&block.source?[block.source]:[]))].sort(),
    importedTables:tables.length,
    importedTableSources:[...new Set(tables.map((table)=>table.source))].sort(),
    preservedFormulaCells:tables.reduce((count,table)=>count+Object.keys(table.formulaByCell??{}).length,0),
    importedScenes:(presentation.importedScenes??[]).length,
    importedSceneSources:[...new Set((presentation.importedScenes??[]).map((scene)=>scene.source))].sort(),
  }
}
