import { getImportedTables, importedTableCellKey, importedTableFromSheet, type ImportedCellReviewThread, type ImportedDataTable, type ImportedReviewPerson, type ImportedThreadedComment, type ImportedThreadedMention } from './importedTables.ts'
import type { WorkspaceState } from './model.ts'
import { readOfficeXml, readOfficeZip } from './officeArchive.ts'
import type { OfficeImportPlan } from './officeImportPlanner.ts'
import { parsePackageRelationships, parseXlsxSharedStrings, parseXlsxSheetXml, parseXlsxWorkbook, resolvePackagePath, type ImportedSheetCell } from './officeParsers.ts'
import type { VersionedWorkspaceCommand } from './semanticCommands.ts'

function attribute(fragment:string,name:string){return fragment.match(new RegExp(`(?:^|\\s)(?:[\\w.-]+:)?${name}="([^"]*)"`,'i'))?.[1]}
function decodeXml(value:string){return value.replace(/&#x([0-9a-f]+);/gi,(_,hex)=>String.fromCodePoint(Number.parseInt(hex,16))).replace(/&#(\d+);/g,(_,decimal)=>String.fromCodePoint(Number(decimal))).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&')}
function elementText(fragment:string,name:string){const match=fragment.match(new RegExp(`<(?:\\w+:)?${name}\\b[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?${name}>`,'i'));return match?decodeXml(match[1].replace(/<[^>]+>/g,'')).trim():''}
function nonEmpty(row:Array<ImportedSheetCell>){return row.some((cell)=>cell!==null&&String(cell).trim()!=='')}
function rowNumbers(sheetXml:string){return[...sheetXml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/gi)].map((match,index)=>Number(attribute(match[1],'r')??index+1))}
function columnLetters(index:number){let value=index+1,result='';while(value>0){const remainder=(value-1)%26;result=String.fromCharCode(65+remainder)+result;value=Math.floor((value-1)/26)}return result}
function relsPath(partPath:string){const parts=partPath.split('/'),name=parts.pop()!;return[...parts,'_rels',`${name}.rels`].join('/')}
function bool(value:string|undefined){if(value===undefined)return undefined;return value==='1'||value.toLowerCase()==='true'}
function uint(value:string|undefined){if(value===undefined)return null;const parsed=Number(value);return Number.isInteger(parsed)&&parsed>=0?parsed:null}

export function parseXlsxPersons(personsXml:string):Map<string,ImportedReviewPerson>{
  const people=new Map<string,ImportedReviewPerson>()
  for(const match of personsXml.matchAll(/<(?:\w+:)?person\b([^>]*)\/?\s*>/gi)){
    const id=decodeXml(attribute(match[1],'id')??'').trim(),displayName=decodeXml(attribute(match[1],'displayName')??'').trim()
    if(!id||!displayName)continue
    const userId=attribute(match[1],'userId'),providerId=attribute(match[1],'providerId')
    people.set(id,{id,displayName,...(userId?{userId:decodeXml(userId)}:{}),...(providerId?{providerId:decodeXml(providerId)}:{})})
  }
  return people
}

function parseMentions(fragment:string,people:Map<string,ImportedReviewPerson>):ImportedThreadedMention[]|undefined{
  const result:ImportedThreadedMention[]=[]
  for(const match of fragment.matchAll(/<(?:\w+:)?mention\b([^>]*)\/?\s*>/gi)){
    const personId=decodeXml(attribute(match[1],'mentionpersonId')??'').trim(),mentionId=decodeXml(attribute(match[1],'mentionId')??'').trim(),startIndex=uint(attribute(match[1],'startIndex')),length=uint(attribute(match[1],'length'))
    if(!personId||!mentionId||startIndex===null||length===null)continue
    const displayName=people.get(personId)?.displayName
    result.push({personId,mentionId,startIndex,length,...(displayName?{displayName}:{})})
  }
  return result.length?result:undefined
}

type ParsedThreadedComment=ImportedThreadedComment&{ref?:string}
export function parseXlsxThreadedComments(threadedXml:string,people:Map<string,ImportedReviewPerson>):Map<string,ImportedCellReviewThread>{
  const comments:ParsedThreadedComment[]=[]
  for(const match of threadedXml.matchAll(/<(?:\w+:)?threadedComment\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?threadedComment>/gi)){
    const id=decodeXml(attribute(match[1],'id')??'').trim(),personId=decodeXml(attribute(match[1],'personId')??'').trim()
    if(!id||!personId)continue
    const text=elementText(match[2],'text'),refRaw=attribute(match[1],'ref'),parentRaw=attribute(match[1],'parentId'),createdRaw=attribute(match[1],'dT'),done=bool(attribute(match[1],'done')),mentions=parseMentions(match[2],people)
    comments.push({id,personId,author:people.get(personId)?.displayName??personId,text,...(refRaw?{ref:decodeXml(refRaw).toUpperCase()}:{}),...(parentRaw?{parentId:decodeXml(parentRaw)}:{}),...(createdRaw?{createdAt:decodeXml(createdRaw)}:{}),...(done!==undefined?{done}:{}),...(mentions?{mentions}:{})})
  }
  const byId=new Map(comments.map((comment)=>[comment.id,comment])),memo=new Map<string,string|null>()
  const resolveRef=(comment:ParsedThreadedComment,seen=new Set<string>()):string|null=>{
    if(memo.has(comment.id))return memo.get(comment.id)??null
    if(comment.ref&&/^[A-Z]+\d+$/.test(comment.ref)){memo.set(comment.id,comment.ref);return comment.ref}
    if(!comment.parentId||seen.has(comment.id)){memo.set(comment.id,null);return null}
    seen.add(comment.id);const parent=byId.get(comment.parentId),resolved=parent?resolveRef(parent,seen):null;memo.set(comment.id,resolved);return resolved
  }
  const threads=new Map<string,ImportedCellReviewThread>()
  for(const comment of comments){
    const ref=resolveRef(comment);if(!ref)continue
    const {ref:_ref,...stored}=comment,current=threads.get(ref)??{comments:[]};current.comments.push(stored);threads.set(ref,current)
  }
  return threads
}

function workbookSheetParts(workbookXml:string,relationshipsXml:string){
  const relationships=parsePackageRelationships(relationshipsXml),result:Array<{name:string;path:string}>=[]
  for(const match of workbookXml.matchAll(/<sheet\b([^>]*)\/?\s*>/gi)){
    const name=decodeXml(attribute(match[1],'name')??'Sheet'),relId=match[1].match(/(?:^|\s)r:id="([^"]+)"/i)?.[1]??attribute(match[1],'id'),target=relId?relationships.get(relId)?.target:undefined
    if(target)result.push({name,path:resolvePackagePath('xl/workbook.xml',target)})
  }
  return result
}
function personsPartPath(relationshipsXml:string){
  for(const relationship of parsePackageRelationships(relationshipsXml).values())if(relationship.type.endsWith('/person'))return resolvePackagePath('xl/workbook.xml',relationship.target)
  return null
}
function threadedPartPath(sheetPath:string,relationshipsXml:string|null){
  for(const relationship of parsePackageRelationships(relationshipsXml).values())if(relationship.type.endsWith('/threadedComment'))return resolvePackagePath(sheetPath,relationship.target)
  return null
}
function attachThreads(table:ImportedDataTable,sheetXml:string,threads:Map<string,ImportedCellReviewThread>){
  if(!threads.size)return{table,attachedThreads:0,attachedComments:0}
  const parsedRows=parseXlsxSheetXml(sheetXml),numbers=rowNumbers(sheetXml),headerIndex=parsedRows.findIndex(nonEmpty)
  if(headerIndex<0)return{table,attachedThreads:0,attachedComments:0}
  const dataIndexes=parsedRows.map((row,index)=>({row,index})).slice(headerIndex+1).filter(({row})=>nonEmpty(row)).map(({index})=>index)
  const threadByCell={...(table.threadByCell??{})};let attachedThreads=0,attachedComments=0
  for(const [tableRowIndex,sourceIndex] of dataIndexes.entries()){
    const tableRow=table.rows[tableRowIndex];if(!tableRow)continue
    const actualRow=numbers[sourceIndex]
    table.columns.forEach((column,columnIndex)=>{
      const thread=threads.get(`${columnLetters(columnIndex)}${actualRow}`);if(!thread)return
      const key=importedTableCellKey(tableRow.id,column.id);if(!threadByCell[key])attachedThreads+=1
      threadByCell[key]=structuredClone(thread);attachedComments+=thread.comments.length
    })
  }
  return{table:Object.keys(threadByCell).length?{...table,threadByCell}:table,attachedThreads,attachedComments}
}

/** Preserve modern Excel threaded comments as structured, read-only review conversations. */
export async function preserveXlsxThreadedCommentMetadata(
  workspace:WorkspaceState,
  input:ArrayBuffer|Uint8Array,
  fileName:string,
  plan:OfficeImportPlan,
):Promise<OfficeImportPlan>{
  if(plan.kind!=='xlsx')return plan
  const entries=await readOfficeZip(input),workbook=readOfficeXml(entries,'xl/workbook.xml'),workbookRels=readOfficeXml(entries,'xl/_rels/workbook.xml.rels')
  if(!workbook||!workbookRels)return plan
  const threadedPaths=[...entries.keys()].filter((path)=>/^xl\/threadedComments\/[^/]+\.xml$/i.test(path));if(!threadedPaths.length)return plan
  const personPath=personsPartPath(workbookRels)??([...entries.keys()].find((path)=>/^xl\/persons\/[^/]+\.xml$/i.test(path))??null)
  const people=personPath?parseXlsxPersons(readOfficeXml(entries,personPath)??''):new Map<string,ImportedReviewPerson>()
  const shared=parseXlsxSharedStrings(readOfficeXml(entries,'xl/sharedStrings.xml')),parts=workbookSheetParts(workbook,workbookRels),xmlByPath=new Map<string,string>()
  for(const {path} of parts){const xml=readOfficeXml(entries,path);if(xml)xmlByPath.set(path,xml)}
  const sheets=parseXlsxWorkbook(workbook,workbookRels,xmlByPath,shared),partByName=new Map(parts.map((part)=>[part.name,part]))
  const threadsBySheet=new Map<string,Map<string,ImportedCellReviewThread>>();let sourceThreads=0,sourceComments=0
  for(const part of parts){
    const threadedPath=threadedPartPath(part.path,readOfficeXml(entries,relsPath(part.path)));if(!threadedPath)continue
    const xml=readOfficeXml(entries,threadedPath);if(!xml)continue
    const threads=parseXlsxThreadedComments(xml,people);if(!threads.size)continue
    threadsBySheet.set(part.name,threads);sourceThreads+=threads.size;for(const thread of threads.values())sourceComments+=thread.comments.length
  }
  if(!sourceThreads)return{...plan,warnings:[...plan.warnings.filter((warning)=>!/^Modern Excel threaded comments are not imported yet/i.test(warning)),'Excel threaded-comment parts were detected but no cell-attached review threads could be parsed.']}

  const commands=[...plan.commands],replaceIndex=commands.findIndex((command)=>command.type==='data.imported.replace')
  const replacement=replaceIndex>=0?commands[replaceIndex] as Extract<VersionedWorkspaceCommand,{type:'data.imported.replace'}>:null
  const tables=(replacement?.tables??getImportedTables(workspace)).map((table)=>structuredClone(table))
  let preservedThreads=0,preservedComments=0,addedTables=0
  for(let index=0;index<tables.length;index++){
    const table=tables[index];if(table.source!==fileName)continue
    const part=partByName.get(table.label),sheetXml=part?xmlByPath.get(part.path):undefined,threads=threadsBySheet.get(table.label);if(!part||!sheetXml||!threads)continue
    const attached=attachThreads(table,sheetXml,threads);tables[index]=attached.table;preservedThreads+=attached.attachedThreads;preservedComments+=attached.attachedComments
  }
  for(const [sheetIndex,sheet] of sheets.entries()){
    if(tables.some((table)=>table.source===fileName&&table.label===sheet.name))continue
    const part=partByName.get(sheet.name),sheetXml=part?xmlByPath.get(part.path):undefined,threads=threadsBySheet.get(sheet.name);if(!part||!sheetXml||!threads?.size)continue
    const candidate=importedTableFromSheet(sheet,fileName,`threads-${sheetIndex+1}`);if(!candidate)continue
    const attached=attachThreads(candidate,sheetXml,threads);if(!attached.attachedThreads)continue
    tables.push(attached.table);preservedThreads+=attached.attachedThreads;preservedComments+=attached.attachedComments;addedTables+=1
  }
  if(replaceIndex>=0)commands[replaceIndex]={type:'data.imported.replace',tables,...(replacement?.changedAt?{changedAt:replacement.changedAt}:{})}
  else if(tables.length>getImportedTables(workspace).length)commands.push({type:'data.imported.replace',tables})

  const warnings=plan.warnings.filter((warning)=>!/^Modern Excel threaded comments are not imported yet/i.test(warning))
  if(preservedThreads)warnings.push(`${preservedThreads} Excel review thread${preservedThreads===1?' was':'s were'} preserved with ${preservedComments} comment${preservedComments===1?'':'s'}, authors, replies, timestamps, resolution state, and mention metadata.`)
  const skippedThreads=Math.max(0,sourceThreads-preservedThreads),skippedComments=Math.max(0,sourceComments-preservedComments)
  if(skippedThreads)warnings.push(`${skippedThreads} Excel review thread${skippedThreads===1?' could':'s could'} not be attached to retained Data cells (${skippedComments} comment${skippedComments===1?'':'s'}).`)
  if(!people.size)warnings.push('Excel threaded review authors could not be resolved because the workbook Persons metadata was unavailable; person IDs were retained as author identifiers.')
  if(addedTables)warnings.push(`${addedTables} threaded-review worksheet${addedTables===1?' was':'s were'} retained as generic Frame Data so collaborative provenance is not discarded.`)
  return{...plan,commands,warnings,importedItems:plan.importedItems+addedTables}
}
