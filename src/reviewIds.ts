import type { WorkspaceReviewRecord } from './workspaceReviews.ts'

/**
 * Preserve the readable source-derived ID when available, but never reuse a
 * native review ID after that review has been detached or otherwise retained.
 */
export function nextWorkspaceReviewId(reviews:WorkspaceReviewRecord[],sourceReviewId:string){
  const base=`frame-review:${sourceReviewId}`,ids=new Set(reviews.map((review)=>review.id))
  if(!ids.has(base))return base
  let suffix=2
  while(ids.has(`${base}:${suffix}`))suffix+=1
  return`${base}:${suffix}`
}
