import { getImportedTables, importedTableCellKey } from './importedTables.ts'
import type { WorkspaceState } from './model.ts'
import { compareWorkspaceStates, type WorkspaceVersionDiff } from './workspaceCompare.ts'

function reviewMeta(workspace:WorkspaceState,tableId:string,rowId:string,columnId:string,suffix:string){
  const table=getImportedTables(workspace).find((item)=>item.id===tableId)
  const column=table?.columns.find((item)=>item.id===columnId)
  return{objectId:`table:${tableId}:${rowId}`,label:table?.label??tableId,field:`${column?.label??columnId} ${suffix}`}
}
function addReviewDiff(diffs:WorkspaceVersionDiff[],workspace:WorkspaceState,tableId:string,rowId:string,columnId:string,suffix:string,beforeValue:string|null,afterValue:string|null){
  if(beforeValue===afterValue)return
  const meta=reviewMeta(workspace,tableId,rowId,columnId,suffix)
  diffs.push({objectId:meta.objectId,label:meta.label,field:meta.field,before:beforeValue,after:afterValue,change:beforeValue===null?'added':afterValue===null?'removed':'changed'})
}
function addNativeDiff(diffs:WorkspaceVersionDiff[],objectId:string,label:string,field:string,beforeValue:string|null,afterValue:string|null){
  if(beforeValue===afterValue)return
  diffs.push({objectId,label,field,before:beforeValue,after:afterValue,change:beforeValue===null?'added':afterValue===null?'removed':'changed'})
}

/** Adds imported Data review provenance and promoted native review work to the core semantic workspace diff. */
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
      const key=importedTableCellKey(rowId,columnId)
      const beforeNote=left.commentByCell?.[key],afterNote=right.commentByCell?.[key]
      addReviewDiff(diffs,after,tableId,rowId,columnId,'note',beforeNote?JSON.stringify(beforeNote):null,afterNote?JSON.stringify(afterNote):null)
      const beforeThread=left.threadByCell?.[key],afterThread=right.threadByCell?.[key]
      addReviewDiff(diffs,after,tableId,rowId,columnId,'review thread',beforeThread?JSON.stringify(beforeThread):null,afterThread?JSON.stringify(afterThread):null)
    }
    const leftPromoted=new Map((left.promotedReviews??[]).map((review)=>[review.id,review])),rightPromoted=new Map((right.promotedReviews??[]).map((review)=>[review.id,review]))
    for(const reviewId of new Set([...leftPromoted.keys(),...rightPromoted.keys()])){
      const l=leftPromoted.get(reviewId),r=rightPromoted.get(reviewId),objectId=r?.objectId??l?.objectId??`review:${reviewId}`,label=r?.label??l?.label??reviewId
      if(!l||!r){addNativeDiff(diffs,objectId,label,'Frame review',l?JSON.stringify(l):null,r?JSON.stringify(r):null);continue}
      addNativeDiff(diffs,objectId,label,'Frame review kind',l.kind,r.kind)
      addNativeDiff(diffs,objectId,label,'Frame review body',l.body,r.body)
      addNativeDiff(diffs,objectId,label,'Frame review owner',l.owner,r.owner)
      addNativeDiff(diffs,objectId,label,'Frame review status',l.status,r.status)
      addNativeDiff(diffs,objectId,label,'Frame review source',l.sourceReview?JSON.stringify(l.sourceReview):null,r.sourceReview?JSON.stringify(r.sourceReview):null)
    }
  }
  return diffs
}
