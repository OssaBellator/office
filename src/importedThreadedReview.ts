import { getImportedTables, type ImportedDataTable, type ImportedThreadedComment } from './importedTables.ts'
import type { WorkspaceState } from './model.ts'

export type ImportedThreadedReviewItem={
  id:string
  sourceReviewId:string
  tableId:string
  tableLabel:string
  source:string
  rowId:string
  columnId:string
  columnLabel:string
  value:string|number|boolean|null
  root:ImportedThreadedComment
  comments:ImportedThreadedComment[]
  replyCount:number
  participants:string[]
  resolved:boolean
}

function rootComment(comments:ImportedThreadedComment[]){return comments.find((comment)=>!comment.parentId)??comments[0]}

export function tableThreadedReviewItems(table:ImportedDataTable):ImportedThreadedReviewItem[]{
  const items:ImportedThreadedReviewItem[]=[]
  for(const row of table.rows)for(const column of table.columns){
    const key=`${row.id}\u0000${column.id}`,thread=table.threadByCell?.[key]
    if(!thread?.comments.length)continue
    const root=rootComment(thread.comments),participants=[...new Set(thread.comments.map((comment)=>comment.author))]
    items.push({id:`review-thread:${table.id}:${row.id}:${column.id}`,sourceReviewId:root.id,tableId:table.id,tableLabel:table.label,source:table.source,rowId:row.id,columnId:column.id,columnLabel:column.label,value:row.values[column.id]??null,root,comments:structuredClone(thread.comments),replyCount:Math.max(0,thread.comments.length-1),participants,resolved:root.done===true})
  }
  return items
}

export function getImportedThreadedReviewItems(workspace:WorkspaceState):ImportedThreadedReviewItem[]{
  return getImportedTables(workspace).flatMap((table)=>tableThreadedReviewItems(table))
}

export function summarizeImportedThreadedReview(workspace:WorkspaceState){
  const items=getImportedThreadedReviewItems(workspace)
  return{
    threads:items.length,
    comments:items.reduce((sum,item)=>sum+item.comments.length,0),
    open:items.filter((item)=>!item.resolved).length,
    resolved:items.filter((item)=>item.resolved).length,
    sources:[...new Set(items.map((item)=>item.source))].sort(),
    participants:[...new Set(items.flatMap((item)=>item.participants))].sort(),
  }
}
