import { useEffect, useState } from 'react'
import { Database, ExternalLink, Link2, Trash2 } from 'lucide-react'
import { getImportedTableFormula, getImportedTableLink, getImportedTableNumberFormat, getImportedTables, importedTableCellKey, importedTableSummary, isSafeNavigableImportedLink, type ImportedDataTable, type ImportedTableCell } from '../importedTables'
import type { WorkspaceState } from '../model'
import type { VersionedWorkspaceCommand } from '../semanticCommands'

export function ImportedTablesPanel({ workspace, focusedObjectId, onSemanticCommand }: { workspace:WorkspaceState; focusedObjectId?:string|null; onSemanticCommand:(command:VersionedWorkspaceCommand)=>void }) {
  const tables=getImportedTables(workspace)
  if(!tables.length)return null
  const remove=(id:string)=>onSemanticCommand({type:'data.imported.replace',tables:tables.filter((table)=>table.id!==id)})
  const updateCell=(tableId:string,rowId:string,columnId:string,value:ImportedTableCell)=>{
    const next=tables.map((table)=>{
      if(table.id!==tableId)return table
      const formulaByCell={...(table.formulaByCell??{})}
      delete formulaByCell[importedTableCellKey(rowId,columnId)]
      const formulas=Object.keys(formulaByCell).length?formulaByCell:undefined
      return{...table,rows:table.rows.map((row)=>row.id!==rowId?row:{...row,values:{...row.values,[columnId]:value}}),...(formulas?{formulaByCell:formulas}:{formulaByCell:undefined})}
    })
    onSemanticCommand({type:'data.imported.replace',tables:next})
  }
  return <section className="imported-tables-panel">
    <div className="imported-tables-heading"><div><span>IMPORTED WORKBOOK TABLES</span><h2>Foreign schemas kept intact</h2><p>Sheets that do not match the live finance model remain structured and editable instead of being discarded. Boolean cells, source sheet visibility, Excel number-format provenance, hyperlinks, and original formulas are retained. Editing a value replaces its imported formula but keeps display-format and link provenance.</p></div><small>{tables.length} table{tables.length===1?'':'s'}</small></div>
    <div className="imported-table-stack">{tables.map((table)=><article className={focusedObjectId===`table:${table.id}`?'imported-table-card frame-object-focused':'imported-table-card'} data-frame-object={`table:${table.id}`} key={table.id}>
      <header><div><Database size={14}/><div><strong>{table.label}</strong><span>{importedTableSummary(table)} · {table.source}</span></div></div><button onClick={()=>remove(table.id)} title={`Remove ${table.label}`}><Trash2 size={13}/></button></header>
      <div className="imported-table-scroll"><table><thead><tr>{table.columns.map((column)=><th key={column.id}>{column.label}<small>{column.type}</small></th>)}</tr></thead><tbody>{table.rows.slice(0,100).map((row)=><tr key={row.id}>{table.columns.map((column)=><td key={column.id}><ImportedCell table={table} rowId={row.id} columnId={column.id} value={row.values[column.id]??null} onCommit={updateCell}/></td>)}</tr>)}</tbody></table></div>
      {table.rows.length>100&&<footer>Showing first 100 of {table.rows.length} imported rows.</footer>}
    </article>)}</div>
  </section>
}

function cellDraft(value:ImportedTableCell){return value===null?'':typeof value==='boolean'?(value?'TRUE':'FALSE'):String(value)}
function ImportedCell({table,rowId,columnId,value,onCommit}:{table:ImportedDataTable;rowId:string;columnId:string;value:ImportedTableCell;onCommit:(tableId:string,rowId:string,columnId:string,value:ImportedTableCell)=>void}){
  const column=table.columns.find((item)=>item.id===columnId)!
  const formula=getImportedTableFormula(table,rowId,columnId)
  const numberFormat=getImportedTableNumberFormat(table,rowId,columnId)
  const link=getImportedTableLink(table,rowId,columnId)
  const webLink=link?.kind==='external'&&isSafeNavigableImportedLink(link)?link:null
  const [draft,setDraft]=useState(cellDraft(value))
  const [invalid,setInvalid]=useState(false)
  useEffect(()=>{setDraft(cellDraft(value));setInvalid(false)},[value])
  const commit=()=>{
    const trimmed=draft.trim()
    let next:ImportedTableCell=trimmed||null
    if(column.type==='number'&&trimmed){const parsed=Number(trimmed.replace(/,/g,''));if(!Number.isFinite(parsed)){setInvalid(true);return}next=parsed}
    if(column.type==='boolean'&&trimmed){const normalized=trimmed.toLowerCase();if(normalized==='true'||normalized==='1')next=true;else if(normalized==='false'||normalized==='0')next=false;else{setInvalid(true);return}}
    setInvalid(false)
    if(Object.is(next,value))return
    onCommit(table.id,rowId,columnId,next)
  }
  const validationHint=column.type==='boolean'?'Enter TRUE or FALSE':'Enter a finite number'
  const formatLabel=numberFormat?.formatCode??(numberFormat?`built-in format ${numberFormat.numFmtId}`:'')
  const linkLabel=link?`${link.kind==='internal'?'Workbook location':'Imported target'}: ${link.target}${webLink?'':' · inert in Frame'}`:''
  const metadata=[formula?`Imported formula: =${formula}`:'',numberFormat?`Excel number format: ${formatLabel}`:'',table.sourceDateSystem?`Workbook date system: ${table.sourceDateSystem}`:'',linkLabel].filter(Boolean).join('\n')
  const title=invalid?validationHint:metadata||undefined
  const metadataCount=Number(Boolean(formula))+Number(Boolean(numberFormat))+Number(Boolean(link))
  return <div className={`imported-cell-wrap imported-cell-meta-${metadataCount}`}><input className={invalid?'imported-cell-input invalid':'imported-cell-input'} value={draft} inputMode={column.type==='number'?'decimal':'text'} onChange={(event)=>setDraft(event.target.value)} onBlur={commit} onKeyDown={(event)=>{if(event.key==='Enter'){event.currentTarget.blur()}if(event.key==='Escape'){setDraft(cellDraft(value));setInvalid(false);event.currentTarget.blur()}}} aria-label={`${table.label} ${column.label} cell`} title={title}/><span className="imported-cell-badges">{formula&&<span className="imported-formula-badge" title={`Imported formula: =${formula}`}>ƒ</span>}{numberFormat&&<span className="imported-format-badge" title={`Excel number format: ${formatLabel}`}>#</span>}{webLink?<a className="imported-link-badge live" href={webLink.target} target={webLink.target.toLowerCase().startsWith('mailto:')?undefined:'_blank'} rel="noreferrer noopener" title={`Open imported link: ${webLink.target}`} onClick={(event)=>event.stopPropagation()}><ExternalLink size={9}/></a>:link?<span className="imported-link-badge" title={linkLabel}><Link2 size={9}/></span>:null}</span></div>
}
