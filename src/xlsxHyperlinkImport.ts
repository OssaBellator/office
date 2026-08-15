import { getImportedTables, importedTableCellKey, importedTableFromSheet, isSafeNavigableImportedLink, type ImportedCellLink, type ImportedDataTable } from './importedTables.ts'
import type { WorkspaceState } from './model.ts'
import { readOfficeXml, readOfficeZip } from './officeArchive.ts'
import type { OfficeImportPlan } from './officeImportPlanner.ts'
import { parsePackageRelationships, parseXlsxSharedStrings, parseXlsxSheetXml, parseXlsxWorkbook, resolvePackagePath, type ImportedSheetCell } from './officeParsers.ts'
import type { VersionedWorkspaceCommand } from './semanticCommands.ts'

function attribute(fragment:string,name:string){return fragment.match(new RegExp(`(?:^|\\s)(?:[\\w.-]+:)?${name}="([^"]*)"`,'i'))?.[1]}
function decodeXml(value:string){return value.replace(/&#x([0-9a-f]+);/gi,(_,hex)=>String.fromCodePoint(Number.parseInt(hex,16))).replace(/&#(\d+);/g,(_,decimal)=>String.fromCodePoint(Number(decimal))).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&')}
function nonEmpty(row:Array<ImportedSheetCell>){return row.some((cell)=>cell!==null&&String(cell).trim()!=='')}
function rowNumbers(sheetXml:string){return[...sheetXml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/gi)].map((match,index)=>Number(attribute(match[1],'r')??index+1))}
function columnLetters(index:number){let value=index+1,result='';while(value>0){const remainder=(value-1)%26;result=String.fromCharCode(65+remainder)+result;value=Math.floor((value-1)/26)}return result}
function relsPath(partPath:string){const parts=partPath.split('/'),name=parts.pop()!;return[...parts,'_rels',`${name}.rels`].join('/')}

function hyperlinkRelationships(xml:string|null){
  const result=new Map<string,string>()
  if(!xml)return result
  for(const match of xml.matchAll(/<(?:\w+:)?Relationship\b([^>]*)\/?\s*>/gi)){
    const id=attribute(match[1],'Id'),type=attribute(match[1],'Type')??'',target=attribute(match[1],'Target')
    if(id&&target&&type.endsWith('/hyperlink'))result.set(id,decodeXml(target))
  }
  return result
}

export function parseXlsxHyperlinks(sheetXml:string,relationshipsXml:string|null):Map<string,ImportedCellLink>{
  const relationships=hyperlinkRelationships(relationshipsXml),result=new Map<string,ImportedCellLink>()
  for(const match of sheetXml.matchAll(/<hyperlink\b([^>]*)\/?\s*>/gi)){
    const ref=(attribute(match[1],'ref')??'').toUpperCase(),location=attribute(match[1],'location'),relId=match[1].match(/(?:^|\s)r:id="([^"]+)"/i)?.[1],display=attribute(match[1],'display'),tooltip=attribute(match[1],'tooltip')
    if(!/^[A-Z]+\d+$/.test(ref))continue
    const target=relId?relationships.get(relId):location?decodeXml(location):undefined
    if(!target)continue
    const link:ImportedCellLink={kind:relId?'external':'internal',target,...(display?{display:decodeXml(display)}:{}),...(tooltip?{tooltip:decodeXml(tooltip)}:{})}
    result.set(ref,link)
  }
  return result
}

function attachLinks(table:ImportedDataTable,sheetXml:string,relationshipsXml:string|null){
  const links=parseXlsxHyperlinks(sheetXml,relationshipsXml);if(!links.size)return{table,added:0,unsafe:0}
  const parsedRows=parseXlsxSheetXml(sheetXml),numbers=rowNumbers(sheetXml),headerIndex=parsedRows.findIndex(nonEmpty)
  if(headerIndex<0)return{table,added:0,unsafe:0}
  const dataIndexes=parsedRows.map((row,index)=>({row,index})).slice(headerIndex+1).filter(({row})=>nonEmpty(row)).map(({index})=>index)
  const linkByCell={...(table.linkByCell??{})};let added=0,unsafe=0
  for(const [tableRowIndex,sourceIndex] of dataIndexes.entries()){
    const tableRow=table.rows[tableRowIndex];if(!tableRow)continue
    const actualRow=numbers[sourceIndex]
    table.columns.forEach((column,columnIndex)=>{
      const link=links.get(`${columnLetters(columnIndex)}${actualRow}`);if(!link)return
      const key=importedTableCellKey(tableRow.id,column.id);if(!linkByCell[key])added+=1
      linkByCell[key]=link;if(link.kind==='external'&&!isSafeNavigableImportedLink(link))unsafe+=1
    })
  }
  return{table:Object.keys(linkByCell).length?{...table,linkByCell}:table,added,unsafe}
}

function workbookSheetParts(workbookXml:string,relationshipsXml:string){
  const relationships=parsePackageRelationships(relationshipsXml),result:Array<{name:string;path:string}>=[]
  for(const match of workbookXml.matchAll(/<sheet\b([^>]*)\/?\s*>/gi)){
    const name=decodeXml(attribute(match[1],'name')??'Sheet')
    const relId=match[1].match(/(?:^|\s)r:id="([^"]+)"/i)?.[1]??attribute(match[1],'id')
    const target=relId?relationships.get(relId)?.target:undefined
    if(target)result.push({name,path:resolvePackagePath('xl/workbook.xml',target)})
  }
  return result
}

/** Preserve per-cell Excel/Sheets hyperlinks as provenance without activating unsafe schemes. */
export async function preserveXlsxHyperlinkMetadata(
  workspace:WorkspaceState,
  input:ArrayBuffer|Uint8Array,
  fileName:string,
  plan:OfficeImportPlan,
):Promise<OfficeImportPlan>{
  if(plan.kind!=='xlsx')return plan
  const entries=await readOfficeZip(input),workbook=readOfficeXml(entries,'xl/workbook.xml'),relationships=readOfficeXml(entries,'xl/_rels/workbook.xml.rels')
  if(!workbook||!relationships)return plan
  const shared=parseXlsxSharedStrings(readOfficeXml(entries,'xl/sharedStrings.xml')),parts=workbookSheetParts(workbook,relationships),xmlByPath=new Map<string,string>()
  for(const {path} of parts){const xml=readOfficeXml(entries,path);if(xml)xmlByPath.set(path,xml)}
  const sheets=parseXlsxWorkbook(workbook,relationships,xmlByPath,shared)
  const partByName=new Map(parts.map((part)=>[part.name,part]))

  const commands=[...plan.commands],replaceIndex=commands.findIndex((command)=>command.type==='data.imported.replace')
  const replacement=replaceIndex>=0?commands[replaceIndex] as Extract<VersionedWorkspaceCommand,{type:'data.imported.replace'}>:null
  const tables=(replacement?.tables??getImportedTables(workspace)).map((table)=>structuredClone(table))
  let preserved=0,unsafe=0,addedTables=0
  for(let index=0;index<tables.length;index++){
    const table=tables[index];if(table.source!==fileName)continue
    const part=partByName.get(table.label),sheetXml=part?xmlByPath.get(part.path):undefined;if(!part||!sheetXml)continue
    const attached=attachLinks(table,sheetXml,readOfficeXml(entries,relsPath(part.path)));tables[index]=attached.table;preserved+=attached.added;unsafe+=attached.unsafe
  }
  for(const [sheetIndex,sheet] of sheets.entries()){
    if(tables.some((table)=>table.source===fileName&&table.label===sheet.name))continue
    const part=partByName.get(sheet.name),sheetXml=part?xmlByPath.get(part.path):undefined;if(!part||!sheetXml)continue
    if(!parseXlsxHyperlinks(sheetXml,readOfficeXml(entries,relsPath(part.path))).size)continue
    const candidate=importedTableFromSheet(sheet,fileName,`links-${sheetIndex+1}`);if(!candidate)continue
    const attached=attachLinks(candidate,sheetXml,readOfficeXml(entries,relsPath(part.path)));if(!attached.added)continue
    tables.push(attached.table);preserved+=attached.added;unsafe+=attached.unsafe;addedTables+=1
  }
  if(replaceIndex>=0)commands[replaceIndex]={type:'data.imported.replace',tables,...(replacement?.changedAt?{changedAt:replacement.changedAt}:{})}
  else if(tables.length>getImportedTables(workspace).length)commands.push({type:'data.imported.replace',tables})

  const warnings=[...plan.warnings]
  if(preserved)warnings.push(`${preserved} worksheet hyperlink${preserved===1?' was':'s were'} preserved as per-cell provenance.`)
  if(unsafe)warnings.push(`${unsafe} external hyperlink${unsafe===1?' uses':'s use'} a non-web/non-mail scheme. Frame preserves the target as inert provenance but will not make it live or re-export it automatically.`)
  if(addedTables)warnings.push(`${addedTables} linked worksheet${addedTables===1?' was':'s were'} retained as generic Frame Data so hyperlink provenance is not discarded.`)
  return{...plan,commands,warnings,importedItems:plan.importedItems+addedTables}
}
