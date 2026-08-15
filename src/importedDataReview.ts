import { getImportedTables, type ImportedCellComment, type ImportedDataTable } from './importedTables.ts'
import type { WorkspaceState } from './model.ts'

export type ImportedDataReviewItem={
  id:string
  sourceReviewId:string
  tableId:string
  tableLabel:string
  source:string
  rowId:string
  columnId:string
  columnLabel:string
  value:string|number|boolean|null
  author?:string
  text:string
}

function stableNoteId(table:ImportedDataTable,rowIndex:number,columnId:string,comment:ImportedCellComment){
  return comment.sourceRef?`excel-note:${table.source}:${table.label}:${comment.sourceRef}`:`excel-note:${table.source}:${table.label}:${rowIndex+1}:${columnId}`
}

export function getImportedDataReviewItems(workspace:WorkspaceState):ImportedDataReviewItem[]{
  return getImportedTables(workspace).flatMap((table)=>tableReviewItems(table))
}

export function tableReviewItems(table:ImportedDataTable):ImportedDataReviewItem[]{
  const result:ImportedDataReviewItem[]=[]
  for(const [rowIndex,row] of table.rows.entries()){
    for(const column of table.columns){
      const key=`${row.id}\u0000${column.id}`
      const comment:ImportedCellComment|undefined=table.commentByCell?.[key]
      if(!comment)continue
      result.push({id:`review:${table.id}:${row.id}:${column.id}`,sourceReviewId:stableNoteId(table,rowIndex,column.id,comment),tableId:table.id,tableLabel:table.label,source:table.source,rowId:row.id,columnId:column.id,columnLabel:column.label,value:row.values[column.id]??null,...(comment.author?{author:comment.author}:{}),text:comment.text})
    }
  }
  return result
}

export function summarizeImportedDataReview(workspace:WorkspaceState){
  const items=getImportedDataReviewItems(workspace)
  return{
    total:items.length,
    sources:[...new Set(items.map((item)=>item.source))].sort(),
    authors:[...new Set(items.flatMap((item)=>item.author?[item.author]:[]))].sort(),
    tables:[...new Set(items.map((item)=>item.tableLabel))].sort(),
  }
}
