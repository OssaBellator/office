import { getImportedTables, importedTableCellKey, importedTableFromSheet, type ImportedDataTable, type ImportedDateSystem, type ImportedNumberFormat } from './importedTables.ts'
import type { WorkspaceState } from './model.ts'
import { readOfficeXml, readOfficeZip } from './officeArchive.ts'
import type { OfficeImportPlan } from './officeImportPlanner.ts'
import { parsePackageRelationships, parseXlsxSharedStrings, parseXlsxSheetXml, parseXlsxWorkbook, resolvePackagePath, type ImportedSheetCell } from './officeParsers.ts'
import type { VersionedWorkspaceCommand } from './semanticCommands.ts'

function attribute(fragment:string,name:string){return fragment.match(new RegExp(`(?:^|\\s)(?:[\\w.-]+:)?${name}="([^"]*)"`,'i'))?.[1]}
function decodeXml(value:string){return value.replace(/&#x([0-9a-f]+);/gi,(_,hex)=>String.fromCodePoint(Number.parseInt(hex,16))).replace(/&#(\d+);/g,(_,decimal)=>String.fromCodePoint(Number(decimal))).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&')}
function columnIndex(reference:string){const letters=reference.match(/^[A-Z]+/i)?.[0]?.toUpperCase()??'A';let result=0;for(const char of letters)result=result*26+char.charCodeAt(0)-64;return result-1}
function nonEmpty(row:Array<ImportedSheetCell>){return row.some((cell)=>cell!==null&&String(cell).trim()!=='')}
function rowNumbers(sheetXml:string){return[...sheetXml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/gi)].map((match,index)=>Number(attribute(match[1],'r')??index+1))}
function workbookDateSystem(workbookXml:string):ImportedDateSystem{return /<workbookPr\b[^>]*date1904="(?:1|true)"/i.test(workbookXml)?'1904':'1900'}

export function parseXlsxNumberFormatStyles(stylesXml:string|null){
  const custom=new Map<number,string>()
  if(!stylesXml)return{custom,cellXfs:[] as number[]}
  for(const match of stylesXml.matchAll(/<numFmt\b([^>]*)\/?\s*>/gi)){
    const id=Number(attribute(match[1],'numFmtId')),code=attribute(match[1],'formatCode')
    if(Number.isInteger(id)&&id>=0&&code!==undefined)custom.set(id,decodeXml(code))
  }
  const cellXfsBody=stylesXml.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/i)?.[1]??''
  const cellXfs=[...cellXfsBody.matchAll(/<xf\b([^>]*)\/?\s*>/gi)].map((match)=>{const value=Number(attribute(match[1],'numFmtId')??0);return Number.isInteger(value)&&value>=0?value:0})
  return{custom,cellXfs}
}

function sheetStyleByReference(sheetXml:string){
  const result=new Map<string,number>()
  for(const match of sheetXml.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/gi)){
    const reference=attribute(match[1],'r')?.toUpperCase(),style=Number(attribute(match[1],'s')??0)
    if(reference&&Number.isInteger(style)&&style>0)result.set(reference,style)
  }
  return result
}

function workbookSheetPaths(workbookXml:string,relationshipsXml:string){
  const relationships=parsePackageRelationships(relationshipsXml),result:Array<{name:string;path:string}>=[]
  for(const match of workbookXml.matchAll(/<sheet\b([^>]*)\/?\s*>/gi)){
    const name=decodeXml(attribute(match[1],'name')??'Sheet')
    const relId=match[1].match(/(?:^|\s)r:id="([^"]+)"/i)?.[1]??attribute(match[1],'id')
    const target=relId?relationships.get(relId)?.target:undefined
    if(target)result.push({name,path:resolvePackagePath('xl/workbook.xml',target)})
  }
  return result
}

function attachNumberFormats(table:ImportedDataTable,sheetXml:string,cellXfs:number[],custom:Map<number,string>,dateSystem:ImportedDateSystem){
  const parsedRows=parseXlsxSheetXml(sheetXml),numbers=rowNumbers(sheetXml),styleByReference=sheetStyleByReference(sheetXml)
  const headerIndex=parsedRows.findIndex(nonEmpty)
  if(headerIndex<0)return{table:{...table,sourceDateSystem:dateSystem},added:0}
  const dataIndexes=parsedRows.map((row,index)=>({row,index})).slice(headerIndex+1).filter(({row})=>nonEmpty(row)).map(({index})=>index)
  const numberFormatByCell={...(table.numberFormatByCell??{})}
  let added=0
  for(const [tableRowIndex,sourceIndex] of dataIndexes.entries()){
    const tableRow=table.rows[tableRowIndex];if(!tableRow)continue
    const actualRow=numbers[sourceIndex]
    table.columns.forEach((column,columnIndex)=>{
      let columnNumber=columnIndex+1,letters='';while(columnNumber){const remainder=(columnNumber-1)%26;letters=String.fromCharCode(65+remainder)+letters;columnNumber=Math.floor((columnNumber-1)/26)}
      const styleIndex=styleByReference.get(`${letters}${actualRow}`);if(styleIndex===undefined)return
      const numFmtId=cellXfs[styleIndex]??0;if(numFmtId===0)return
      const key=importedTableCellKey(tableRow.id,column.id)
      const next:ImportedNumberFormat={numFmtId,...(custom.has(numFmtId)?{formatCode:custom.get(numFmtId)!}:{})}
      if(!numberFormatByCell[key])added+=1
      numberFormatByCell[key]=next
    })
  }
  return{table:{...table,sourceDateSystem:dateSystem,...(Object.keys(numberFormatByCell).length?{numberFormatByCell}:{})},added}
}

/** Preserve Excel display-format provenance without converting raw serial values into dates. */
export async function preserveXlsxNumberFormatMetadata(
  workspace:WorkspaceState,
  input:ArrayBuffer|Uint8Array,
  fileName:string,
  plan:OfficeImportPlan,
):Promise<OfficeImportPlan>{
  if(plan.kind!=='xlsx')return plan
  const entries=await readOfficeZip(input)
  const workbook=readOfficeXml(entries,'xl/workbook.xml'),relationships=readOfficeXml(entries,'xl/_rels/workbook.xml.rels')
  if(!workbook||!relationships)return plan
  const styles=readOfficeXml(entries,'xl/styles.xml'),{custom,cellXfs}=parseXlsxNumberFormatStyles(styles),dateSystem=workbookDateSystem(workbook)
  const shared=parseXlsxSharedStrings(readOfficeXml(entries,'xl/sharedStrings.xml'))
  const sheetPaths=workbookSheetPaths(workbook,relationships),xmlByPath=new Map<string,string>()
  for(const {path} of sheetPaths){const value=readOfficeXml(entries,path);if(value)xmlByPath.set(path,value)}
  const sheets=parseXlsxWorkbook(workbook,relationships,xmlByPath,shared)
  const sheetXmlByName=new Map(sheetPaths.flatMap(({name,path})=>{const value=xmlByPath.get(path);return value?[[name,value] as const]:[]}))

  const commands=[...plan.commands]
  const replaceIndex=commands.findIndex((command)=>command.type==='data.imported.replace')
  const replacement=replaceIndex>=0?commands[replaceIndex] as Extract<VersionedWorkspaceCommand,{type:'data.imported.replace'}>:null
  const tables=(replacement?.tables??getImportedTables(workspace)).map((table)=>structuredClone(table))
  let preservedCells=0,addedTables=0
  for(let index=0;index<tables.length;index++){
    const table=tables[index];if(table.source!==fileName)continue
    const xml=sheetXmlByName.get(table.label);if(!xml){table.sourceDateSystem=dateSystem;continue}
    const enriched=attachNumberFormats(table,xml,cellXfs,custom,dateSystem);tables[index]=enriched.table;preservedCells+=enriched.added
  }
  for(const [sheetIndex,sheet] of sheets.entries()){
    if(tables.some((table)=>table.source===fileName&&table.label===sheet.name))continue
    const xml=sheetXmlByName.get(sheet.name);if(!xml)continue
    const candidate=importedTableFromSheet(sheet,fileName,`format-${sheetIndex+1}`);if(!candidate)continue
    const enriched=attachNumberFormats(candidate,xml,cellXfs,custom,dateSystem)
    if(!Object.keys(enriched.table.numberFormatByCell??{}).length)continue
    tables.push(enriched.table);preservedCells+=enriched.added;addedTables+=1
  }
  if(replaceIndex>=0)commands[replaceIndex]={type:'data.imported.replace',tables,...(replacement?.changedAt?{changedAt:replacement.changedAt}:{})}
  else if(tables.length>getImportedTables(workspace).length)commands.push({type:'data.imported.replace',tables})

  const warnings=plan.warnings.filter((warning)=>!/^Excel cell formatting and date\/number display formats are not translated yet/i.test(warning))
  if(styles)warnings.push('Excel number-format codes are preserved as per-cell provenance. Fonts, fills, borders, alignment and conditional formatting are not translated yet.')
  if(preservedCells)warnings.push(`${preservedCells} imported cell${preservedCells===1?' retains':'s retain'} Excel number-format provenance without changing the stored value.`)
  if(addedTables)warnings.push(`${addedTables} formatted worksheet${addedTables===1?' was':'s were'} retained as generic Frame Data so number/date display semantics are not discarded.`)
  if(dateSystem==='1904')warnings.push('Workbook uses Excel\'s 1904 date system. Frame preserves that provenance and leaves stored serial values unchanged rather than guessing date conversion.')
  return{...plan,commands,warnings,importedItems:plan.importedItems+addedTables}
}
