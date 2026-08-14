import type { WorkspaceState } from './model.ts'
import type { ImportedSheet } from './officeParsers.ts'

export type ImportedTableCell = string | number | null
export type ImportedTableColumn = { id:string; label:string; type:'text'|'number' }
export type ImportedTableRow = { id:string; values:Record<string,ImportedTableCell> }
export type ImportedDataTable = {
  id:string
  label:string
  source:string
  columns:ImportedTableColumn[]
  rows:ImportedTableRow[]
  importedAt:string
}

type ExtendedWorkspaceState = WorkspaceState & { importedTables?: ImportedDataTable[] }

export function getImportedTables(workspace: WorkspaceState): ImportedDataTable[] {
  return structuredClone((workspace as ExtendedWorkspaceState).importedTables ?? [])
}

export function withImportedTables(workspace: WorkspaceState, tables: ImportedDataTable[]): WorkspaceState {
  return { ...workspace, importedTables:structuredClone(tables) } as WorkspaceState
}

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
  return present.length>0&&present.every((value)=>typeof value==='number')?'number':'text'
}

export function importedTableFromSheet(sheet: ImportedSheet, fileName: string, idSuffix: string): ImportedDataTable | null {
  const headerIndex=sheet.rows.findIndex((row)=>row.some((cell)=>cell!==null&&String(cell).trim()!==''))
  if(headerIndex<0)return null
  const header=sheet.rows[headerIndex]
  const width=Math.max(header.length,...sheet.rows.slice(headerIndex+1).map((row)=>row.length),0)
  const paddedHeader=Array.from({length:width},(_,index)=>header[index]??null)
  const baseColumns=uniqueHeaders(paddedHeader)
  const data=sheet.rows.slice(headerIndex+1).filter((row)=>row.some((cell)=>cell!==null&&String(cell).trim()!==''))
  const columns=baseColumns.map((column,index)=>({...column,type:inferType(data.map((row)=>row[index]??null))}))
  const rows=data.map((row,rowIndex)=>({id:`row:${idSuffix}:${rowIndex+1}`,values:Object.fromEntries(columns.map((column,index)=>[column.id,row[index]??null]))}))
  return {id:`imported:${slug(fileName)}:${slug(sheet.name)}:${idSuffix}`,label:sheet.name,source:fileName,columns,rows,importedAt:'just now'}
}

export function importedTableSummary(table: ImportedDataTable) {
  return `${table.label} · ${table.rows.length} rows × ${table.columns.length} columns`
}
