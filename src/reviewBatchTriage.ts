import type { WorkspaceState } from './model.ts'
import type { VersionedWorkspaceCommand } from './semanticCommands.ts'
import { getWorkspaceReviews, type WorkspaceReviewRecord } from './workspaceReviews.ts'

export type BatchReviewTriagePlan={
  reviewIds:string[]
  reviews:WorkspaceReviewRecord[]
  changedReviewIds:string[]
  command:Extract<VersionedWorkspaceCommand,{type:'review.workspace.replace'}>
}

/**
 * Update many native Data review records in one semantic replacement.
 * This preserves source pointers and avoids sequential full-array commands
 * planned against stale snapshots.
 */
export function planBatchTriageWorkspaceReviews(
  workspace:WorkspaceState,
  reviewIds:string[],
  options:{owner?:string;complete?:boolean}={},
):BatchReviewTriagePlan{
  const unique=[...new Set(reviewIds)]
  if(!unique.length)throw new Error('Select at least one native Data review to triage')
  if(unique.length!==reviewIds.length)throw new Error('Batch triage contains duplicate native review selections')
  const reviews=getWorkspaceReviews(workspace),byId=new Map(reviews.map((review)=>[review.id,review] as const))
  for(const id of unique)if(!byId.has(id))throw new Error(`Unknown native Data review: ${id}`)
  const owner=options.owner===undefined?undefined:options.owner.trim()
  if(options.owner!==undefined&&!owner)throw new Error('Batch review owner must not be blank')
  if(owner===undefined&&!options.complete)throw new Error('Choose a new owner, complete the selected review, or both')
  const selected=new Set(unique),changedReviewIds:string[]=[]
  const next=reviews.map((review)=>{
    if(!selected.has(review.id))return review
    const status=options.complete?(review.kind==='approval'?'approved':'resolved'):review.status
    const updated={...review,...(owner!==undefined?{owner}:{}),status}
    if(JSON.stringify(updated)!==JSON.stringify(review))changedReviewIds.push(review.id)
    return updated
  })
  if(!changedReviewIds.length)throw new Error('Selected native review already matches the requested triage changes')
  return{reviewIds:unique,reviews:next,changedReviewIds,command:{type:'review.workspace.replace',reviews:next}}
}
