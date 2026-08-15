import type { WorkspaceTransaction } from './model.ts'
import { compareWorkspaceStatesWithReview } from './workspaceReviewCompare.ts'

export type ReviewHistoryEntry={
  transactionId:string
  summary:string
  semanticChanges:number
  reviewChanges:number
  changedReviewFields:string[]
}

export function reviewHistoryEntry(transaction:WorkspaceTransaction):ReviewHistoryEntry{
  const diffs=compareWorkspaceStatesWithReview(transaction.before,transaction.after)
  const reviewDiffs=diffs.filter((diff)=>/ note$/.test(diff.field))
  return{transactionId:transaction.id,summary:transaction.summary,semanticChanges:diffs.length,reviewChanges:reviewDiffs.length,changedReviewFields:[...new Set(reviewDiffs.map((diff)=>diff.field))]}
}

export function buildReviewHistory(transactions:WorkspaceTransaction[],limit?:number):ReviewHistoryEntry[]{
  const source=limit===undefined?transactions:transactions.slice(-Math.max(0,limit))
  return source.map(reviewHistoryEntry).reverse()
}
