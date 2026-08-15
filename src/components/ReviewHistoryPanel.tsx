import { FileSpreadsheet, MessageSquareText } from 'lucide-react'
import type { WorkspaceTransaction } from '../model'
import { buildReviewHistory } from '../reviewHistory'

export function ReviewHistoryPanel({transactions,limit=8}:{transactions:WorkspaceTransaction[];limit?:number}){
  const entries=buildReviewHistory(transactions,limit)
  const reviewEntries=entries.filter((entry)=>entry.reviewChanges>0)
  return <section className="review-history-panel">
    <header><div><MessageSquareText size={14}/><div><span>REVIEW HISTORY</span><strong>Imported Data notes</strong></div></div><small>{reviewEntries.length} transaction{reviewEntries.length===1?'':'s'}</small></header>
    {reviewEntries.length?<div className="review-history-list">{reviewEntries.map((entry)=><article key={entry.transactionId}><span className="review-history-icon"><FileSpreadsheet size={12}/></span><div><strong>{entry.summary}</strong><small>{entry.reviewChanges} review change{entry.reviewChanges===1?'':'s'} · {entry.changedReviewFields.join(', ')}</small></div></article>)}</div>:<p>No imported Data review notes have changed in this history window.</p>}
  </section>
}
