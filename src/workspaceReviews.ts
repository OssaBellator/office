import { getImportedTables, withImportedTables } from './importedTables.ts'
import type { WorkspaceState } from './model.ts'
import { parseWorkspaceReviewRecord } from './workspaceReviewCodec.ts'

export type WorkspaceReviewKind='comment'|'task'|'approval'
export type WorkspaceReviewStatus='open'|'resolved'|'pending'|'approved'
export type ExcelWorkspaceReviewSource={
  kind:'excel-note'|'excel-thread'
  source:string
  tableId:string
  rowId:string
  columnId:string
  sourceReviewId:string
}
export type WordWorkspaceReviewSource={
  kind:'word-comment'
  source:string
  blockId:string
  sourceReviewId:string
}
export type WorkspaceReviewSource=ExcelWorkspaceReviewSource|WordWorkspaceReviewSource
export type WorkspaceReviewRecord={
  id:string
  objectId:string
  label:string
  kind:WorkspaceReviewKind
  body:string
  owner:string
  status:WorkspaceReviewStatus
  createdAt:string
  sourceReview?:WorkspaceReviewSource
  sourceOnly?:boolean
  sourceDetached?:boolean
}

type ExtendedWorkspaceState=WorkspaceState&{workspaceReviews?:unknown}

function parsedReviews(value:unknown,field:string):WorkspaceReviewRecord[]{
  if(value===undefined)return[]
  if(!Array.isArray(value))throw new Error(`${field} must be an array`)
  const reviews=value.map(parseWorkspaceReviewRecord),ids=new Set<string>()
  for(const review of reviews){if(ids.has(review.id))throw new Error(`${field} contains duplicate review id ${review.id}`);ids.add(review.id)}
  return reviews
}
function legacyTableReviews(workspace:WorkspaceState){
  return getImportedTables(workspace).flatMap((table)=>table.promotedReviews??[]).map(parseWorkspaceReviewRecord)
}
function mergeReviews(primary:WorkspaceReviewRecord[],legacy:WorkspaceReviewRecord[]){
  const byId=new Map(primary.map((review)=>[review.id,review] as const))
  for(const review of legacy)if(!byId.has(review.id))byId.set(review.id,review)
  return[...byId.values()]
}

export function getWorkspaceReviews(workspace:WorkspaceState):WorkspaceReviewRecord[]{
  const direct=parsedReviews((workspace as ExtendedWorkspaceState).workspaceReviews,'workspace.workspaceReviews')
  return structuredClone(mergeReviews(direct,legacyTableReviews(workspace)))
}

export function withWorkspaceReviews(workspace:WorkspaceState,reviews:WorkspaceReviewRecord[]):WorkspaceState{
  const parsed=parsedReviews(reviews,'workspace.workspaceReviews')
  const tables=getImportedTables(workspace).map(({promotedReviews:_legacy,...table})=>table)
  const withTables=withImportedTables(workspace,tables)
  return{...withTables,workspaceReviews:structuredClone(parsed)} as WorkspaceState
}

/** Lift legacy table-owned promotedReviews into the canonical workspace collection. */
export function materializeWorkspaceReviews(workspace:WorkspaceState):WorkspaceState{
  return withWorkspaceReviews(workspace,getWorkspaceReviews(workspace))
}

export function workspaceReviewIsOpen(review:WorkspaceReviewRecord){
  if(review.sourceOnly)return false
  return review.kind==='approval'?review.status!=='approved':review.status!=='resolved'
}

export function workspaceReviewSummary(workspace:WorkspaceState){
  const all=getWorkspaceReviews(workspace),reviews=all.filter((review)=>!review.sourceOnly),sourceOnly=all.filter((review)=>review.sourceOnly)
  return{
    total:reviews.length,
    open:reviews.filter(workspaceReviewIsOpen).length,
    openTasks:reviews.filter((review)=>review.kind==='task'&&review.status!=='resolved').length,
    pendingApprovals:reviews.filter((review)=>review.kind==='approval'&&review.status!=='approved').length,
    unresolvedComments:reviews.filter((review)=>review.kind==='comment'&&review.status!=='resolved').length,
    promotedFromSource:reviews.filter((review)=>Boolean(review.sourceReview)).length,
    detachedFromSource:reviews.filter((review)=>review.sourceDetached).length,
    sourceOnly:sourceOnly.length,
  }
}
