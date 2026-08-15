import { getImportedDataReviewItems } from './importedDataReview.ts'
import { getImportedTables } from './importedTables.ts'
import { getImportedThreadedReviewItems } from './importedThreadedReview.ts'
import type { WorkspaceState } from './model.ts'
import type { VersionedWorkspaceCommand } from './semanticCommands.ts'
import type { WorkspaceReviewKind, WorkspaceReviewRecord, WorkspaceReviewStatus } from './workspaceReviews.ts'

export type SourceReviewPromotion={
  sourceItemId:string
  review:WorkspaceReviewRecord
  command:Extract<VersionedWorkspaceCommand,{type:'data.imported.replace'}>
}

function sourcePromotion(workspace:WorkspaceState,sourceItemId:string){
  const thread=getImportedThreadedReviewItems(workspace).find((item)=>item.id===sourceItemId)
  if(thread)return{kind:'excel-thread' as const,tableId:thread.tableId,rowId:thread.rowId,columnId:thread.columnId,source:thread.source,sourceReviewId:thread.sourceReviewId,label:`${thread.tableLabel} · ${thread.columnLabel}`,body:thread.root.text}
  const note=getImportedDataReviewItems(workspace).find((item)=>item.id===sourceItemId)
  if(note)return{kind:'excel-note' as const,tableId:note.tableId,rowId:note.rowId,columnId:note.columnId,source:note.source,sourceReviewId:note.sourceReviewId,label:`${note.tableLabel} · ${note.columnLabel}`,body:note.text}
  throw new Error(`Unknown imported source review: ${sourceItemId}`)
}

function promotedReviewId(sourceReviewId:string){return`frame-review:${sourceReviewId}`}

export function findPromotedSourceReview(workspace:WorkspaceState,sourceItemId:string){
  const source=sourcePromotion(workspace,sourceItemId)
  return getImportedTables(workspace).flatMap((table)=>table.promotedReviews??[]).find((review)=>review.sourceReview?.source===source.source&&review.sourceReview.sourceReviewId===source.sourceReviewId)
}

export function planPromoteSourceReview(
  workspace:WorkspaceState,
  sourceItemId:string,
  options:{kind?:WorkspaceReviewKind;owner?:string;createdAt?:string}={},
):SourceReviewPromotion{
  const source=sourcePromotion(workspace,sourceItemId)
  const tables=getImportedTables(workspace),tableIndex=tables.findIndex((table)=>table.id===source.tableId&&table.source===source.source)
  if(tableIndex<0)throw new Error(`Imported review source table no longer exists: ${source.tableId}`)
  const existing=findPromotedSourceReview(workspace,sourceItemId)
  if(existing)throw new Error(`Source review is already promoted as ${existing.id}`)
  const kind=options.kind??'task',status:WorkspaceReviewStatus=kind==='approval'?'pending':'open'
  const review:WorkspaceReviewRecord={
    id:promotedReviewId(source.sourceReviewId),
    objectId:`table:${source.tableId}:${source.rowId}`,
    label:source.label,
    kind,
    body:source.body,
    owner:options.owner?.trim()||'Unassigned',
    status,
    createdAt:options.createdAt??'just now',
    sourceReview:{kind:source.kind,source:source.source,tableId:source.tableId,rowId:source.rowId,columnId:source.columnId,sourceReviewId:source.sourceReviewId},
  }
  const table=tables[tableIndex],promotedReviews=[...(table.promotedReviews??[]),review]
  tables[tableIndex]={...table,promotedReviews}
  return{sourceItemId,review,command:{type:'data.imported.replace',tables}}
}

export function planWorkspaceReviewStatusUpdate(workspace:WorkspaceState,reviewId:string,status:WorkspaceReviewStatus):Extract<VersionedWorkspaceCommand,{type:'data.imported.replace'}>{
  const tables=getImportedTables(workspace);let found=false
  for(let index=0;index<tables.length;index++){
    const table=tables[index],review=table.promotedReviews?.find((item)=>item.id===reviewId);if(!review)continue
    const allowed=review.kind==='approval'?['pending','approved']:['open','resolved'];if(!allowed.includes(status))throw new Error(`${review.kind} review cannot use status ${status}`)
    tables[index]={...table,promotedReviews:table.promotedReviews!.map((item)=>item.id===reviewId?{...item,status}:item)};found=true;break
  }
  if(!found)throw new Error(`Unknown promoted workspace review: ${reviewId}`)
  return{type:'data.imported.replace',tables}
}
