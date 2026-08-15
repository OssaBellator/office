import { getImportedTables, importedTableFromSheet } from './importedTables.ts'
import type { WorkspaceState } from './model.ts'
import { readOfficeXml, readOfficeZip } from './officeArchive.ts'
import type { OfficeImportPlan } from './officeImportPlanner.ts'
import { parseXlsxSharedStrings, parseXlsxWorkbook } from './officeParsers.ts'
import type { VersionedWorkspaceCommand } from './semanticCommands.ts'

function isXlsx(fileName:string,plan:OfficeImportPlan){return plan.kind==='xlsx'||fileName.trim().toLowerCase().endsWith('.xlsx')}
function slug(value:string){return value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'sheet'}

/**
 * Retain workbook visibility as provenance. Hidden/very-hidden sheets remain
 * imported Data even when their cached values also update a known live model.
 */
export async function preserveXlsxSheetVisibility(
  workspace:WorkspaceState,
  input:ArrayBuffer|Uint8Array,
  fileName:string,
  plan:OfficeImportPlan,
):Promise<OfficeImportPlan>{
  if(!isXlsx(fileName,plan))return plan
  const entries=await readOfficeZip(input)
  const workbook=readOfficeXml(entries,'xl/workbook.xml'),relationships=readOfficeXml(entries,'xl/_rels/workbook.xml.rels')
  if(!workbook||!relationships)return plan
  const shared=parseXlsxSharedStrings(readOfficeXml(entries,'xl/sharedStrings.xml'))
  const xmlByPath=new Map<string,string>()
  for(const path of entries.keys())if(/^xl\/worksheets\/[^/]+\.xml$/i.test(path)){const xml=readOfficeXml(entries,path);if(xml)xmlByPath.set(path,xml)}
  const sheets=parseXlsxWorkbook(workbook,relationships,xmlByPath,shared)
  const hidden=sheets.filter((sheet)=>sheet.visibility&&sheet.visibility!=='visible')
  if(!hidden.length)return plan

  const commands=[...plan.commands]
  const replaceIndex=commands.findIndex((command)=>command.type==='data.imported.replace')
  const replace=replaceIndex>=0?commands[replaceIndex] as Extract<VersionedWorkspaceCommand,{type:'data.imported.replace'}>:null
  const existingPlanned=replace?.tables??getImportedTables(workspace)
  const nextTables=[...existingPlanned]
  let added=0
  hidden.forEach((sheet,index)=>{
    const sameSource=nextTables.find((table)=>table.source===fileName&&table.label===sheet.name)
    if(sameSource){sameSource.sourceVisibility=sheet.visibility;return}
    const table=importedTableFromSheet(sheet,fileName,`hidden-${slug(sheet.name)}-${index+1}`)
    if(table){nextTables.push(table);added+=1}
  })
  if(replaceIndex>=0)commands[replaceIndex]={type:'data.imported.replace',tables:nextTables,...(replace?.changedAt?{changedAt:replace.changedAt}:{})}
  else commands.push({type:'data.imported.replace',tables:nextTables})

  const warnings=[...plan.warnings]
  for(const sheet of hidden)warnings.push(`${sheet.name}: source worksheet is ${sheet.visibility==='veryHidden'?'very hidden':'hidden'}; Frame retained that visibility as provenance on the imported Data table.`)
  if(added)warnings.push(`${added} hidden worksheet${added===1?' was':'s were'} retained as generic Frame Data so workbook visibility is not lost.`)
  return{...plan,commands,warnings,importedItems:plan.importedItems+added}
}
