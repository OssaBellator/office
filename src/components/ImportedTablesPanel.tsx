import { Database, Trash2 } from 'lucide-react'
import { getImportedTables, importedTableSummary } from '../importedTables'
import type { WorkspaceState } from '../model'
import type { VersionedWorkspaceCommand } from '../semanticCommands'

export function ImportedTablesPanel({ workspace, focusedObjectId, onSemanticCommand }: { workspace:WorkspaceState; focusedObjectId?:string|null; onSemanticCommand:(command:VersionedWorkspaceCommand)=>void }) {
  const tables=getImportedTables(workspace)
  if(!tables.length)return null
  const remove=(id:string)=>onSemanticCommand({type:'data.imported.replace',tables:tables.filter((table)=>table.id!==id)})
  return <section className="imported-tables-panel">
    <div className="imported-tables-heading"><div><span>IMPORTED WORKBOOK TABLES</span><h2>Foreign schemas kept intact</h2><p>Sheets that do not match the live finance model remain available as structured Frame Data instead of being discarded.</p></div><small>{tables.length} table{tables.length===1?'':'s'}</small></div>
    <div className="imported-table-stack">{tables.map((table)=><article className={focusedObjectId===`table:${table.id}`?'imported-table-card frame-object-focused':'imported-table-card'} data-frame-object={`table:${table.id}`} key={table.id}>
      <header><div><Database size={14}/><div><strong>{table.label}</strong><span>{importedTableSummary(table)} · {table.source}</span></div></div><button onClick={()=>remove(table.id)} title={`Remove ${table.label}`}><Trash2 size={13}/></button></header>
      <div className="imported-table-scroll"><table><thead><tr>{table.columns.map((column)=><th key={column.id}>{column.label}<small>{column.type}</small></th>)}</tr></thead><tbody>{table.rows.slice(0,100).map((row)=><tr key={row.id}>{table.columns.map((column)=><td key={column.id}>{row.values[column.id]===null?'':String(row.values[column.id])}</td>)}</tr>)}</tbody></table></div>
      {table.rows.length>100&&<footer>Showing first 100 of {table.rows.length} imported rows.</footer>}
    </article>)}</div>
  </section>
}
