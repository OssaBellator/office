import { getImportedDataReviewItems } from './importedDataReview.ts'
import { getImportedTables } from './importedTables.ts'
import { getImportedThreadedReviewItems } from './importedThreadedReview.ts'
import type { WorkspaceState } from './model.ts'
import type { VersionedWorkspaceCommand } from './semanticCommands.ts'
import { getWorkspaceReviews, type WorkspaceReviewKind, type WorkspaceReviewRecord, type WorkspaceReviewStatus } from './workspaceReviews.ts'

export type SourceReviewPromotion={
  sourceItemId:string
  review:WorkspaceReviewRecord
  command:Extract<VersionedWorkspaceCommand,{type:'review.workspace.replace'}>
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
  return getWorkspaceReviews(workspace).find((review)=>!review.sourceOnly&&review.sourceReview?.source===source.source&&review.sourceReview.sourceReviewId===source.sourceReviewId)
}

export function planPromoteSourceReview(
  workspace:WorkspaceState,
  sourceItemId:string,
  options:{kind?:WorkspaceReviewKind;owner?:string;body?:string;createdAt?:string}={},
):SourceReviewPromotion{
  const source=sourcePromotion(workspace,sourceItemId)
  if(!getImportedTables(workspace).some((table)=>table.id===source.tableId&&table.source===source.source))throw new Error(`Imported review source table no longer exists: ${source.tableId}`)
  const existing=findPromotedSourceReview(workspace,sourceItemId)
  if(existing)throw new Error(`Source review is already promoted as ${existing.id}`)
  const kind=options.kind??'task',status:WorkspaceReviewStatus=kind==='approval'?'pending':'open'
  const body=options.body===undefined?source.body:options.body.trim()
  if(!body)throw new Error('Promoted Frame review body must not be blank')
  const owner=options.owner?.trim()||'Unassigned'
  if(kind==='approval'&&owner==='Unassigned')throw new Error('Promoted approvals require an explicit owner')
  const review:WorkspaceReviewRecord={
    id:promotedReviewId(source.sourceReviewId),
    objectId:`table:${source.tableId}:${source.rowId}`,
    label:source.label,
    kind,
    body,
    owner,
    status,
    createdAt:options.createdAt??'just now',
    sourceReview:{kind:source.kind,source:source.source,tableId:source.tableId,rowId:source.rowId,columnId:source.columnId,sourceReviewId:source.sourceReviewId},
  }
  return{sourceItemId,review,command:{type:'review.workspace.replace',reviews:[...getWorkspaceReviews(workspace),review]}}
}

export function planWorkspaceReviewStatusUpdate(workspace:WorkspaceState,reviewId:string,status:WorkspaceReviewStatus):Extract<VersionedWorkspaceCommand,{type:'review.workspace.replace'}>{
  const reviews=getWorkspaceReviews(workspace),review=reviews.find((item)=>item.id===reviewId)
  if(!review)throw new Error(`Unknown promoted workspace review: ${reviewId}`)
  if(review.sourceOnly)throw new Error('Imported source review provenance is read-only until promoted to native Frame review work')
  const allowed=review.kind==='approval'?['pending','approved']:['open','resolved'];if(!allowed.includes(status))throw new Error(`${review.kind} review cannot use status ${status}`)
  return{type:'review.workspace.replace',reviews:reviews.map((item)=>item.id===reviewId?{...item,status}:item)}
}
