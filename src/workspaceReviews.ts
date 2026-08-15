import type { WorkspaceState } from './model.ts'

export type WorkspaceReviewKind='comment'|'task'|'approval'
export type WorkspaceReviewStatus='open'|'resolved'|'pending'|'approved'
export type WorkspaceReviewSource={
  kind:'excel-note'|'excel-thread'
  source:string
  tableId:string
  rowId:string
  columnId:string
  sourceReviewId:string
}
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
}

type ExtendedWorkspaceState=WorkspaceState&{workspaceReviews?:WorkspaceReviewRecord[]}

export function getWorkspaceReviews(workspace:WorkspaceState):WorkspaceReviewRecord[]{
  return structuredClone((workspace as ExtendedWorkspaceState).workspaceReviews??[])
}

export function withWorkspaceReviews(workspace:WorkspaceState,reviews:WorkspaceReviewRecord[]):WorkspaceState{
  return{...workspace,workspaceReviews:structuredClone(reviews)} as WorkspaceState
}

export function workspaceReviewIsOpen(review:WorkspaceReviewRecord){
  return review.kind==='approval'?review.status!=='approved':review.status!=='resolved'
}

export function workspaceReviewSummary(workspace:WorkspaceState){
  const reviews=getWorkspaceReviews(workspace)
  return{
    total:reviews.length,
    open:reviews.filter(workspaceReviewIsOpen).length,
    openTasks:reviews.filter((review)=>review.kind==='task'&&review.status!=='resolved').length,
    pendingApprovals:reviews.filter((review)=>review.kind==='approval'&&review.status!=='approved').length,
    unresolvedComments:reviews.filter((review)=>review.kind==='comment'&&review.status!=='resolved').length,
    promotedFromSource:reviews.filter((review)=>Boolean(review.sourceReview)).length,
  }
}
