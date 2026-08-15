import { getImportedDataReviewItems } from './importedDataReview.ts'
import { getImportedTables } from './importedTables.ts'
import { getImportedThreadedReviewItems } from './importedThreadedReview.ts'
import type { WorkspaceState } from './model.ts'
import type { VersionedWorkspaceCommand } from './semanticCommands.ts'
import { getWorkspaceReviews, type WorkspaceReviewKind, type WorkspaceReviewRecord, type WorkspaceReviewStatus } from './workspaceReviews.ts'

export type BatchReviewPromotionPlan={
  sourceItemIds:string[]
  reviews:WorkspaceReviewRecord[]
  command:Extract<VersionedWorkspaceCommand,{type:'review.workspace.replace'}>
}

type SourceReviewDescriptor={
  sourceItemId:string
  kind:'excel-note'|'excel-thread'
  source:string
  tableId:string
  rowId:string
  columnId:string
  sourceReviewId:string
  label:string
  body:string
}

function descriptors(workspace:WorkspaceState){
  const notes=getImportedDataReviewItems(workspace).map((item):SourceReviewDescriptor=>({sourceItemId:item.id,kind:'excel-note',source:item.source,tableId:item.tableId,rowId:item.rowId,columnId:item.columnId,sourceReviewId:item.sourceReviewId,label:`${item.tableLabel} · ${item.columnLabel}`,body:item.text}))
  const threads=getImportedThreadedReviewItems(workspace).map((item):SourceReviewDescriptor=>({sourceItemId:item.id,kind:'excel-thread',source:item.source,tableId:item.tableId,rowId:item.rowId,columnId:item.columnId,sourceReviewId:item.sourceReviewId,label:`${item.tableLabel} · ${item.columnLabel}`,body:item.root.text}))
  return new Map([...notes,...threads].map((item)=>[item.sourceItemId,item] as const))
}
function nativeId(sourceReviewId:string){return`frame-review:${sourceReviewId}`}

/**
 * Promote many source review items in one canonical review replacement.
 * This intentionally avoids planning several full-array replacement commands
 * against the same workspace snapshot, which could overwrite sibling changes.
 */
export function planBatchPromoteSourceReviews(
  workspace:WorkspaceState,
  sourceItemIds:string[],
  options:{kind?:WorkspaceReviewKind;owner?:string;createdAt?:string}={},
):BatchReviewPromotionPlan{
  const unique=[...new Set(sourceItemIds)]
  if(!unique.length)throw new Error('Select at least one source review to promote')
  if(unique.length!==sourceItemIds.length)throw new Error('Batch promotion contains duplicate source review selections')
  const sourceById=descriptors(workspace),tables=getImportedTables(workspace),existing=getWorkspaceReviews(workspace)
  const existingSourceKeys=new Set(existing.flatMap((review)=>review.sourceReview?[[review.sourceReview.source,review.sourceReview.sourceReviewId].join('|')]:[]))
  const kind=options.kind??'task',owner=options.owner?.trim()||'Unassigned'
  if(kind==='approval'&&owner==='Unassigned')throw new Error('Batch approvals require an explicit owner')
  const status:WorkspaceReviewStatus=kind==='approval'?'pending':'open'
  const createdAt=options.createdAt??'just now',planned:WorkspaceReviewRecord[]=[]
  for(const sourceItemId of unique){
    const source=sourceById.get(sourceItemId)
    if(!source)throw new Error(`Unknown imported source review: ${sourceItemId}`)
    if(!tables.some((table)=>table.id===source.tableId&&table.source===source.source))throw new Error(`Imported review source table no longer exists: ${source.tableId}`)
    const sourceKey=`${source.source}|${source.sourceReviewId}`
    if(existingSourceKeys.has(sourceKey))throw new Error(`Source review is already promoted: ${sourceItemId}`)
    if(planned.some((review)=>review.sourceReview?.source===source.source&&review.sourceReview.sourceReviewId===source.sourceReviewId))throw new Error(`Batch promotion resolves multiple selections to the same source review: ${sourceItemId}`)
    planned.push({
      id:nativeId(source.sourceReviewId),
      objectId:`table:${source.tableId}:${source.rowId}`,
      label:source.label,
      kind,
      body:source.body,
      owner,
      status,
      createdAt,
      sourceReview:{kind:source.kind,source:source.source,tableId:source.tableId,rowId:source.rowId,columnId:source.columnId,sourceReviewId:source.sourceReviewId},
    })
  }
  return{sourceItemIds:unique,reviews:planned,command:{type:'review.workspace.replace',reviews:[...existing,...planned]}}
}
