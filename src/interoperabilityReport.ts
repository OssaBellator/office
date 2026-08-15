import { getImportedTables } from './importedTables.ts'
import type { WorkspaceState } from './model.ts'
import type { OfficeImportPlan } from './officeImportPlanner.ts'
import { getPresentationState } from './presentationState.ts'
import { getSemanticDocument } from './semanticDocument.ts'

export type InteropWarningKind='media'|'layout'|'review'|'formula'|'formatting'|'external-data'|'visibility'|'structure'|'other'
export type InteropWarningSummary={kind:InteropWarningKind;count:number;warnings:string[]}
export type OfficeImportReport={
  kind:OfficeImportPlan['kind']
  importedItems:number
  commandCount:number
  commandTypes:Record<string,number>
  warningCount:number
  warningGroups:InteropWarningSummary[]
  preserved:{documentBlocks:number;tables:number;formulaCells:number;formattedCells:number;booleanCells:number;hiddenTables:number;veryHiddenTables:number;date1904Tables:number;scenes:number}
}

function warningKind(warning:string):InteropWarningKind{
  const text=warning.toLowerCase()
  if(/image|media|chart|smartart|embedded/.test(text))return'media'
  if(/theme|position|font|geometry|animation|transition/.test(text))return'layout'
  if(/comment|tracked|revision|review|footnote|endnote/.test(text))return'review'
  if(/formula/.test(text))return'formula'
  if(/format|style|merged|date system|date\/number/.test(text))return'formatting'
  if(/external|connection|link/.test(text))return'external-data'
  if(/very hidden|source worksheet is hidden|sheet visibility|worksheet is hidden/.test(text))return'visibility'
  if(/table|schema|column|header|footer/.test(text))return'structure'
  return'other'
}

export function groupInteropWarnings(warnings:string[]):InteropWarningSummary[]{
  const groups=new Map<InteropWarningKind,string[]>()
  for(const warning of warnings){const kind=warningKind(warning),current=groups.get(kind)??[];current.push(warning);groups.set(kind,current)}
  return [...groups.entries()].map(([kind,items])=>({kind,count:items.length,warnings:items}))
}

function tableFidelity(tables:ReturnType<typeof getImportedTables>){
  let formulaCells=0,formattedCells=0,booleanCells=0,hiddenTables=0,veryHiddenTables=0,date1904Tables=0
  for(const table of tables){
    formulaCells+=Object.keys(table.formulaByCell??{}).length
    formattedCells+=Object.keys(table.numberFormatByCell??{}).length
    if(table.sourceVisibility==='hidden')hiddenTables+=1
    if(table.sourceVisibility==='veryHidden')veryHiddenTables+=1
    if(table.sourceDateSystem==='1904')date1904Tables+=1
    for(const row of table.rows)for(const value of Object.values(row.values))if(typeof value==='boolean')booleanCells+=1
  }
  return{formulaCells,formattedCells,booleanCells,hiddenTables,veryHiddenTables,date1904Tables}
}

export function summarizeOfficeImportPlan(plan:OfficeImportPlan):OfficeImportReport{
  const commandTypes:Record<string,number>={}
  let documentBlocks=0,tables=0,formulaCells=0,formattedCells=0,booleanCells=0,hiddenTables=0,veryHiddenTables=0,date1904Tables=0,scenes=0
  for(const command of plan.commands){
    commandTypes[command.type]=(commandTypes[command.type]??0)+1
    if(command.type==='document.block.insert')documentBlocks+=1
    if(command.type==='data.imported.replace'){
      tables+=command.tables.length
      const fidelity=tableFidelity(command.tables)
      formulaCells+=fidelity.formulaCells;formattedCells+=fidelity.formattedCells;booleanCells+=fidelity.booleanCells;hiddenTables+=fidelity.hiddenTables;veryHiddenTables+=fidelity.veryHiddenTables;date1904Tables+=fidelity.date1904Tables
    }
    if(command.type==='presentation.replace')scenes+=command.value.importedScenes?.length??0
  }
  return{kind:plan.kind,importedItems:plan.importedItems,commandCount:plan.commands.length,commandTypes,warningCount:plan.warnings.length,warningGroups:groupInteropWarnings(plan.warnings),preserved:{documentBlocks,tables,formulaCells,formattedCells,booleanCells,hiddenTables,veryHiddenTables,date1904Tables,scenes}}
}

export function describeWorkspaceInteropState(workspace:WorkspaceState){
  const semantic=getSemanticDocument(workspace)
  const tables=getImportedTables(workspace)
  const presentation=getPresentationState(workspace)
  const importedBlocks=semantic.blocks.filter((block)=>block.type==='paragraph'&&Boolean(block.source))
  const fidelity=tableFidelity(tables)
  return{
    importedDocumentBlocks:importedBlocks.length,
    importedDocumentSources:[...new Set(importedBlocks.flatMap((block)=>block.type==='paragraph'&&block.source?[block.source]:[]))].sort(),
    importedTables:tables.length,
    importedTableSources:[...new Set(tables.map((table)=>table.source))].sort(),
    preservedFormulaCells:fidelity.formulaCells,
    preservedNumberFormatCells:fidelity.formattedCells,
    preservedBooleanCells:fidelity.booleanCells,
    hiddenImportedTables:fidelity.hiddenTables,
    veryHiddenImportedTables:fidelity.veryHiddenTables,
    imported1904DateSystemTables:fidelity.date1904Tables,
    importedScenes:(presentation.importedScenes??[]).length,
    importedSceneSources:[...new Set((presentation.importedScenes??[]).map((scene)=>scene.source))].sort(),
  }
}
