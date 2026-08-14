import { readOfficeXml, readOfficeZip } from './officeArchive.ts'
import { importedTableCellKey, type ImportedDataTable } from './importedTables.ts'
import type { OfficeImportPlan } from './officeImportPlanner.ts'
import { parsePackageRelationships, parseXlsxSheetXml, resolvePackagePath } from './officeParsers.ts'
import type { VersionedWorkspaceCommand } from './semanticCommands.ts'

function attribute(fragment:string,name:string){return fragment.match(new RegExp(`(?:^|\\s)(?:[\\w.-]+:)?${name}="([^"]*)"`,'i'))?.[1]}
function decodeXml(value:string){return value.replace(/&#x([0-9a-f]+);/gi,(_,hex)=>String.fromCodePoint(Number.parseInt(hex,16))).replace(/&#(\d+);/g,(_,decimal)=>String.fromCodePoint(Number(decimal))).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&')}
function cellCoordinates(reference:string){const match=reference.toUpperCase().match(/^([A-Z]+)(\d+)$/);if(!match)return null;let column=0;for(const char of match[1])column=column*26+char.charCodeAt(0)-64;return{column:column-1,row:Number(match[2])}}
function columnLetters(index:number){let value=index+1,result='';while(value>0){const remainder=(value-1)%26;result=String.fromCharCode(65+remainder)+result;value=Math.floor((value-1)/26)}return result}

function translateA1OutsideStrings(formula:string,deltaRow:number,deltaColumn:number){
  const parts=formula.split(/("(?:[^"]|"")*")/g)
  return parts.map((part,index)=>{
    if(index%2===1)return part
    return part.replace(/(^|[^A-Z0-9_.])((?:'[^']+'|[A-Za-z_][A-Za-z0-9_.]*)!)?(\$?)([A-Z]{1,3})(\$?)(\d+)/g,(whole,prefix,sheet,columnAbsolute,columnLettersRaw,rowAbsolute,rowDigits)=>{
      let column=0;for(const char of columnLettersRaw)column=column*26+char.charCodeAt(0)-64;column-=1
      const row=Number(rowDigits)
      const translatedColumn=columnAbsolute?column:column+deltaColumn
      const translatedRow=rowAbsolute?row:row+deltaRow
      if(translatedColumn<0||translatedRow<1)return whole
      return `${prefix}${sheet??''}${columnAbsolute?'$':''}${columnLetters(translatedColumn)}${rowAbsolute?'$':''}${translatedRow}`
    })
  }).join('')
}

export function expandXlsxSharedFormulas(sheetXml:string):Map<string,string>{
  const cells:Array<{reference:string;formulaType:string;sharedIndex?:string;formula?:string}>=[]
  for(const cellMatch of sheetXml.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/gi)){
    const reference=attribute(cellMatch[1],'r')?.toUpperCase();if(!reference)continue
    const formulaMatch=cellMatch[2].match(/<f\b([^>]*?)(?:\/\s*>|>([\s\S]*?)<\/f>)/i)
    if(!formulaMatch)continue
    cells.push({reference,formulaType:attribute(formulaMatch[1],'t')??'',sharedIndex:attribute(formulaMatch[1],'si'),formula:formulaMatch[2]===undefined?undefined:decodeXml(formulaMatch[2]).trim()})
  }
  const anchors=new Map<string,{reference:string;formula:string}>()
  for(const cell of cells)if(cell.formulaType==='shared'&&cell.sharedIndex&&cell.formula)anchors.set(cell.sharedIndex,{reference:cell.reference,formula:cell.formula})
  const result=new Map<string,string>()
  for(const cell of cells){
    if(cell.formula){result.set(cell.reference,cell.formula);continue}
    if(cell.formulaType!=='shared'||!cell.sharedIndex)continue
    const anchor=anchors.get(cell.sharedIndex);if(!anchor)continue
    const source=cellCoordinates(anchor.reference),target=cellCoordinates(cell.reference);if(!source||!target)continue
    result.set(cell.reference,translateA1OutsideStrings(anchor.formula,target.row-source.row,target.column-source.column))
  }
  return result
}

function rowNumbers(sheetXml:string){return[...sheetXml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/gi)].map((match,index)=>Number(attribute(match[1],'r')??index+1))}
function nonEmpty(row:Array<string|number|null>){return row.some((cell)=>cell!==null&&String(cell).trim()!=='')}
function attachFormulas(table:ImportedDataTable,sheetXml:string){
  const formulas=expandXlsxSharedFormulas(sheetXml);if(!formulas.size)return table
  const parsedRows=parseXlsxSheetXml(sheetXml),numbers=rowNumbers(sheetXml)
  const headerIndex=parsedRows.findIndex(nonEmpty);if(headerIndex<0)return table
  const dataIndexes=parsedRows.map((row,index)=>({row,index})).slice(headerIndex+1).filter(({row})=>nonEmpty(row)).map(({index})=>index)
  const formulaByCell={...(table.formulaByCell??{})}
  for(const [tableRowIndex,sourceIndex] of dataIndexes.entries()){
    const tableRow=table.rows[tableRowIndex];if(!tableRow)continue
    const actualRow=numbers[sourceIndex]
    table.columns.forEach((column,columnIndex)=>{
      const formula=formulas.get(`${columnLetters(columnIndex)}${actualRow}`)
      if(formula)formulaByCell[importedTableCellKey(tableRow.id,column.id)]=formula
    })
  }
  return Object.keys(formulaByCell).length?{...table,formulaByCell}:table
}

function workbookSheetPaths(workbookXml:string,relationshipsXml:string){
  const relationships=parsePackageRelationships(relationshipsXml),paths:string[]=[]
  for(const match of workbookXml.matchAll(/<sheet\b([^>]*)\/?\s*>/gi)){
    const relId=match[1].match(/(?:^|\s)r:id="([^"]+)"/i)?.[1]??attribute(match[1],'id')
    const target=relId?relationships.get(relId)?.target:undefined
    if(target)paths.push(resolvePackagePath('xl/workbook.xml',target))
  }
  return paths
}

/** Adds formula text for compact shared-formula dependent cells to tables already planned by the normal XLSX importer. */
export async function preserveXlsxSharedFormulaMetadata(input:ArrayBuffer|Uint8Array,fileName:string,plan:OfficeImportPlan):Promise<OfficeImportPlan>{
  if(plan.kind!=='xlsx')return plan
  const entries=await readOfficeZip(input),workbook=readOfficeXml(entries,'xl/workbook.xml'),relationships=readOfficeXml(entries,'xl/_rels/workbook.xml.rels')
  if(!workbook||!relationships)return plan
  const paths=workbookSheetPaths(workbook,relationships)
  const names=[...workbook.matchAll(/<sheet\b([^>]*)\/?\s*>/gi)].map((match)=>decodeXml(attribute(match[1],'name')??'Sheet'))
  const xmlByName=new Map<string,string>()
  paths.forEach((path,index)=>{const value=readOfficeXml(entries,path);if(value)xmlByName.set(names[index]??`Sheet ${index+1}`,value)})
  let expandedDependents=0
  const commands:VersionedWorkspaceCommand[]=plan.commands.map((command)=>{
    if(command.type!=='data.imported.replace')return command
    const tables=command.tables.map((table)=>{
      if(table.source!==fileName)return table
      const sheetXml=xmlByName.get(table.label);if(!sheetXml)return table
      const before=Object.keys(table.formulaByCell??{}).length,next=attachFormulas(table,sheetXml),after=Object.keys(next.formulaByCell??{}).length
      expandedDependents+=Math.max(0,after-before)
      return next
    })
    return{...command,tables}
  })
  const warnings=[...plan.warnings]
  if(expandedDependents>0)warnings.push(`${expandedDependents} shared-formula dependent cell${expandedDependents===1?' was':'s were'} expanded from Excel's compact shared-formula representation and preserved as formula provenance.`)
  return{...plan,commands,warnings}
}
