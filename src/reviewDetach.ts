import type { WorkspaceState } from './model.ts'
import type { VersionedWorkspaceCommand } from './semanticCommands.ts'
import { getWorkspaceReviews, type WorkspaceReviewRecord } from './workspaceReviews.ts'

export type ReviewDetachPlan={
  reviewId:string
  review:WorkspaceReviewRecord
  previousSource:NonNullable<WorkspaceReviewRecord['sourceReview']>
  command:Extract<VersionedWorkspaceCommand,{type:'review.workspace.replace'}>
}

/**
 * Deliberately remove imported-source ownership from native Frame work.
 * The prior source pointer remains recoverable in semantic history/revert.
 */
export function planDetachWorkspaceReviewSource(workspace:WorkspaceState,reviewId:string):ReviewDetachPlan{
  const reviews=getWorkspaceReviews(workspace),existing=reviews.find((review)=>review.id===reviewId)
  if(!existing)throw new Error(`Unknown native workspace review: ${reviewId}`)
  if(!existing.sourceReview)throw new Error(`Native review ${reviewId} is already detached from imported source provenance`)
  const previousSource=structuredClone(existing.sourceReview)
  const review:WorkspaceReviewRecord={...existing,objectId:`review:${existing.id}`,sourceReview:undefined}
  return{
    reviewId,
    review,
    previousSource,
    command:{type:'review.workspace.replace',reviews:reviews.map((item)=>item.id===reviewId?review:item)},
  }
}
