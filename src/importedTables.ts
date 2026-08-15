import type { WorkspaceState } from './model.ts'
import type { ImportedSheet, ImportedSheetVisibility } from './officeParsers.ts'

export type ImportedTableCell = string | number | boolean | null
export type ImportedTableColumn = { id:string; label:string; type:'text'|'number'|'boolean' }
export type ImportedTableRow = { id:string; values:Record<string,ImportedTableCell> }
export type ImportedDataTable = {
  id:string
  label:string
  source:string
  columns:ImportedTableColumn[]
  rows:ImportedTableRow[]
  importedAt:string
  formulaByCell?:Record<string,string>
  sourceVisibility?:ImportedSheetVisibility
}

type ExtendedWorkspaceState = WorkspaceState & { importedTables?: ImportedDataTable[] }

export function getImportedTables(workspace: WorkspaceState): ImportedDataTable[] {
  return structuredClone((workspace as ExtendedWorkspaceState).importedTables ?? [])
}

export function withImportedTables(workspace: WorkspaceState, tables: ImportedDataTable[]): WorkspaceState {
  return { ...workspace, importedTables:structuredClone(tables) } as WorkspaceState
}

export function importedTableCellKey(rowId:string,columnId:string){return`${rowId}\u0000${columnId}`}
export function getImportedTableFormula(table:ImportedDataTable,rowId:string,columnId:string){return table.formulaByCell?.[importedTableCellKey(rowId,columnId)]}

function slug(value:string){return value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'sheet'}
function uniqueHeaders(row: ImportedTableCell[]) {
  const used=new Map<string,number>()
  return row.map((cell,index)=>{
    const label=String(cell??'').trim()||`Column ${index+1}`
    const stem=slug(label),count=(used.get(stem)??0)+1;used.set(stem,count)
    return {id:count===1?stem:`${stem}-${count}`,label}
  })
}
function inferType(values:ImportedTableCell[]):ImportedTableColumn['type']{
  const present=values.filter((value)=>value!==null&&String(value).trim()!=='')
  if(present.length>0&&present.every((value)=>typeof value==='number'))return'number'
  if(present.length>0&&present.every((value)=>typeof value==='boolean'))return'boolean'
  return'text'
}

export function importedTableFromSheet(sheet: ImportedSheet, fileName: string, idSuffix: string): ImportedDataTable | null {
  const headerIndex=sheet.rows.findIndex((row)=>row.some((cell)=>cell!==null&&String(cell).trim()!==''))
  if(headerIndex<0)return null
  const header=sheet.rows[headerIndex]
  const width=Math.max(header.length,...sheet.rows.slice(headerIndex+1).map((row)=>row.length),0)
  const paddedHeader=Array.from({length:width},(_,index)=>header[index]??null)
  const baseColumns=uniqueHeaders(paddedHeader)
  const data=sheet.rows.slice(headerIndex+1).map((row,offset)=>({row,sourceIndex:headerIndex+1+offset})).filter(({row})=>row.some((cell)=>cell!==null&&String(cell).trim()!==''))
  const columns=baseColumns.map((column,index)=>({...column,type:inferType(data.map(({row})=>row[index]??null))}))
  const rows=data.map(({row},rowIndex)=>({id:`row:${idSuffix}:${rowIndex+1}`,values:Object.fromEntries(columns.map((column,index)=>[column.id,row[index]??null]))}))
  const formulaEntries:Array<[string,string]>=[]
  data.forEach(({sourceIndex},rowIndex)=>columns.forEach((column,columnIndex)=>{const formula=sheet.formulas?.[sourceIndex]?.[columnIndex]?.trim();if(formula)formulaEntries.push([importedTableCellKey(rows[rowIndex].id,column.id),formula])}))
  const formulaByCell=formulaEntries.length?Object.fromEntries(formulaEntries):undefined
  return {id:`imported:${slug(fileName)}:${slug(sheet.name)}:${idSuffix}`,label:sheet.name,source:fileName,columns,rows,importedAt:'just now',...(formulaByCell?{formulaByCell}:{}),...(sheet.visibility?{sourceVisibility:sheet.visibility}:{})}
}

export function importedTableSummary(table: ImportedDataTable) {
  const formulas=Object.keys(table.formulaByCell??{}).length
  const visibility=table.sourceVisibility&&table.sourceVisibility!=='visible'?` · source ${table.sourceVisibility==='veryHidden'?'very hidden':'hidden'}`:''
  return `${table.label} · ${table.rows.length} rows × ${table.columns.length} columns${formulas?` · ${formulas} preserved formula${formulas===1?'':'s'}`:''}${visibility}`
}
