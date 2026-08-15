import { getImportedTables, importedTableCellKey } from './importedTables.ts'
import type { WorkspaceState } from './model.ts'
import { compareWorkspaceStates, type WorkspaceVersionDiff } from './workspaceCompare.ts'

function noteLabel(workspace:WorkspaceState,tableId:string,rowId:string,columnId:string){
  const table=getImportedTables(workspace).find((item)=>item.id===tableId)
  const column=table?.columns.find((item)=>item.id===columnId)
  return{objectId:`table:${tableId}:${rowId}`,label:`${column?.label??columnId} note`}
}

/** Adds imported Data review/note provenance to the core semantic workspace diff. */
export function compareWorkspaceStatesWithReview(before:WorkspaceState,after:WorkspaceState):WorkspaceVersionDiff[]{
  const diffs=[...compareWorkspaceStates(before,after)]
  const beforeTables=getImportedTables(before),afterTables=getImportedTables(after)
  const tableIds=new Set([...beforeTables.map((table)=>table.id),...afterTables.map((table)=>table.id)])
  for(const tableId of tableIds){
    const left=beforeTables.find((table)=>table.id===tableId),right=afterTables.find((table)=>table.id===tableId)
    if(!left||!right)continue
    const rowIds=new Set([...left.rows.map((row)=>row.id),...right.rows.map((row)=>row.id)])
    const columnIds=new Set([...left.columns.map((column)=>column.id),...right.columns.map((column)=>column.id)])
    for(const rowId of rowIds)for(const columnId of columnIds){
      const key=importedTableCellKey(rowId,columnId),beforeNote=left.commentByCell?.[key],afterNote=right.commentByCell?.[key]
      const beforeValue=beforeNote?JSON.stringify(beforeNote):null,afterValue=afterNote?JSON.stringify(afterNote):null
      if(beforeValue===afterValue)continue
      const meta=noteLabel(after,tableId,rowId,columnId)
      diffs.push({objectId:meta.objectId,label:meta.objectId,field:meta.label,before:beforeValue,after:afterValue,change:beforeValue===null?'added':afterValue===null?'removed':'changed'})
    }
  }
  return diffs
}
