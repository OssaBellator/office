import { getImportedTables, importedTableCellKey, importedTableFromSheet, type ImportedCellComment, type ImportedDataTable } from './importedTables.ts'
import type { WorkspaceState } from './model.ts'
import { readOfficeXml, readOfficeZip } from './officeArchive.ts'
import type { OfficeImportPlan } from './officeImportPlanner.ts'
import { parsePackageRelationships, parseXlsxSharedStrings, parseXlsxSheetXml, parseXlsxWorkbook, resolvePackagePath, type ImportedSheetCell } from './officeParsers.ts'
import type { VersionedWorkspaceCommand } from './semanticCommands.ts'

function attribute(fragment:string,name:string){return fragment.match(new RegExp(`(?:^|\\s)(?:[\\w.-]+:)?${name}="([^"]*)"`,'i'))?.[1]}
function decodeXml(value:string){return value.replace(/&#x([0-9a-f]+);/gi,(_,hex)=>String.fromCodePoint(Number.parseInt(hex,16))).replace(/&#(\d+);/g,(_,decimal)=>String.fromCodePoint(Number(decimal))).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&')}
function textRuns(fragment:string){return[...fragment.matchAll(/<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/gi)].map((match)=>decodeXml(match[1].replace(/<[^>]+>/g,''))).join('')}
function nonEmpty(row:Array<ImportedSheetCell>){return row.some((cell)=>cell!==null&&String(cell).trim()!=='')}
function rowNumbers(sheetXml:string){return[...sheetXml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/gi)].map((match,index)=>Number(attribute(match[1],'r')??index+1))}
function columnLetters(index:number){let value=index+1,result='';while(value>0){const remainder=(value-1)%26;result=String.fromCharCode(65+remainder)+result;value=Math.floor((value-1)/26)}return result}
function relsPath(partPath:string){const parts=partPath.split('/'),name=parts.pop()!;return[...parts,'_rels',`${name}.rels`].join('/')}

export function parseXlsxComments(commentsXml:string):Map<string,ImportedCellComment>{
  const authors=[...commentsXml.matchAll(/<author\b[^>]*>([\s\S]*?)<\/author>/gi)].map((match)=>decodeXml(match[1].replace(/<[^>]+>/g,'')).trim())
  const comments=new Map<string,ImportedCellComment>()
  for(const match of commentsXml.matchAll(/<comment\b([^>]*)>([\s\S]*?)<\/comment>/gi)){
    const ref=(attribute(match[1],'ref')??'').toUpperCase();if(!/^[A-Z]+\d+$/.test(ref))continue
    const text=textRuns(match[2]).trim();if(!text)continue
    const authorId=Number(attribute(match[1],'authorId')),author=Number.isInteger(authorId)&&authorId>=0?authors[authorId]:undefined
    comments.set(ref,{text,...(author?{author}:{})})
  }
  return comments
}

function commentsPartPath(sheetPath:string,relationshipsXml:string|null){
  const relationships=parsePackageRelationships(relationshipsXml)
  for(const relationship of relationships.values())if(relationship.type.endsWith('/comments'))return resolvePackagePath(sheetPath,relationship.target)
  return null
}
function attachComments(table:ImportedDataTable,sheetXml:string,comments:Map<string,ImportedCellComment>){
  if(!comments.size)return{table,added:0}
  const parsedRows=parseXlsxSheetXml(sheetXml),numbers=rowNumbers(sheetXml),headerIndex=parsedRows.findIndex(nonEmpty)
  if(headerIndex<0)return{table,added:0}
  const dataIndexes=parsedRows.map((row,index)=>({row,index})).slice(headerIndex+1).filter(({row})=>nonEmpty(row)).map(({index})=>index)
  const commentByCell={...(table.commentByCell??{})};let added=0
  for(const [tableRowIndex,sourceIndex] of dataIndexes.entries()){
    const tableRow=table.rows[tableRowIndex];if(!tableRow)continue
    const actualRow=numbers[sourceIndex]
    table.columns.forEach((column,columnIndex)=>{const comment=comments.get(`${columnLetters(columnIndex)}${actualRow}`);if(!comment)return;const key=importedTableCellKey(tableRow.id,column.id);if(!commentByCell[key])added+=1;commentByCell[key]=comment})
  }
  return{table:Object.keys(commentByCell).length?{...table,commentByCell}:table,added}
}
function workbookSheetParts(workbookXml:string,relationshipsXml:string){
  const relationships=parsePackageRelationships(relationshipsXml),result:Array<{name:string;path:string}>=[]
  for(const match of workbookXml.matchAll(/<sheet\b([^>]*)\/?\s*>/gi)){
    const name=decodeXml(attribute(match[1],'name')??'Sheet'),relId=match[1].match(/(?:^|\s)r:id="([^"]+)"/i)?.[1]??attribute(match[1],'id'),target=relId?relationships.get(relId)?.target:undefined
    if(target)result.push({name,path:resolvePackagePath('xl/workbook.xml',target)})
  }
  return result
}

/** Preserve classic Excel cell notes/comments as inert review provenance on imported Data. */
export async function preserveXlsxCommentMetadata(
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
  const sheets=parseXlsxWorkbook(workbook,relationships,xmlByPath,shared),partByName=new Map(parts.map((part)=>[part.name,part]))

  const commentsBySheet=new Map<string,Map<string,ImportedCellComment>>()
  let totalComments=0
  for(const part of parts){
    const commentsPath=commentsPartPath(part.path,readOfficeXml(entries,relsPath(part.path)));if(!commentsPath)continue
    const commentsXml=readOfficeXml(entries,commentsPath);if(!commentsXml)continue
    const comments=parseXlsxComments(commentsXml);if(comments.size){commentsBySheet.set(part.name,comments);totalComments+=comments.size}
  }
  if(!totalComments&&!entries.has('xl/persons/person.xml')&&![...entries.keys()].some((path)=>/^xl\/threadedComments\//i.test(path)))return plan

  const commands=[...plan.commands],replaceIndex=commands.findIndex((command)=>command.type==='data.imported.replace')
  const replacement=replaceIndex>=0?commands[replaceIndex] as Extract<VersionedWorkspaceCommand,{type:'data.imported.replace'}>:null
  const tables=(replacement?.tables??getImportedTables(workspace)).map((table)=>structuredClone(table))
  let preserved=0,addedTables=0
  for(let index=0;index<tables.length;index++){
    const table=tables[index];if(table.source!==fileName)continue
    const part=partByName.get(table.label),sheetXml=part?xmlByPath.get(part.path):undefined,comments=commentsBySheet.get(table.label);if(!part||!sheetXml||!comments)continue
    const attached=attachComments(table,sheetXml,comments);tables[index]=attached.table;preserved+=attached.added
  }
  for(const [sheetIndex,sheet] of sheets.entries()){
    if(tables.some((table)=>table.source===fileName&&table.label===sheet.name))continue
    const part=partByName.get(sheet.name),sheetXml=part?xmlByPath.get(part.path):undefined,comments=commentsBySheet.get(sheet.name);if(!part||!sheetXml||!comments?.size)continue
    const candidate=importedTableFromSheet(sheet,fileName,`notes-${sheetIndex+1}`);if(!candidate)continue
    const attached=attachComments(candidate,sheetXml,comments);if(!attached.added)continue
    tables.push(attached.table);preserved+=attached.added;addedTables+=1
  }
  if(replaceIndex>=0)commands[replaceIndex]={type:'data.imported.replace',tables,...(replacement?.changedAt?{changedAt:replacement.changedAt}:{})}
  else if(tables.length>getImportedTables(workspace).length)commands.push({type:'data.imported.replace',tables})

  const warnings=plan.warnings.filter((warning)=>!/^Excel cell comments and notes are not imported yet\./i.test(warning))
  if(preserved)warnings.push(`${preserved} classic Excel cell note${preserved===1?' was':'s were'} preserved as review provenance on imported Data.`)
  const skipped=Math.max(0,totalComments-preserved);if(skipped)warnings.push(`${skipped} Excel note${skipped===1?' could':'s could'} not be attached because the referenced cell is outside the retained Data rows/columns.`)
  if([...entries.keys()].some((path)=>/^xl\/threadedComments\//i.test(path)))warnings.push('Modern Excel threaded comments are not imported yet; classic cell notes are preserved.')
  if(addedTables)warnings.push(`${addedTables} noted worksheet${addedTables===1?' was':'s were'} retained as generic Frame Data so review provenance is not discarded.`)
  return{...plan,commands,warnings,importedItems:plan.importedItems+addedTables}
}
