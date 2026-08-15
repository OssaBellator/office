import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Link2, MessageSquare, ShieldCheck, X } from 'lucide-react'
import type { WorkspaceState } from '../model'
import { listReviewRelinkCandidates, planRelinkPromotedReview } from '../reviewRelink'
import type { VersionedWorkspaceCommand } from '../semanticCommands'
import type { WorkspaceReviewInboxItem } from '../workspaceReviewInbox'
import '../review-relink.css'

type ArchivedReviewItem=Extract<WorkspaceReviewInboxItem,{origin:'frame-data'}>

export function ReviewRelinkDialog({workspace,review,onApply,onClose}:{workspace:WorkspaceState;review:ArchivedReviewItem;onApply:(command:VersionedWorkspaceCommand)=>void;onClose:()=>void}){
  const candidates=useMemo(()=>listReviewRelinkCandidates(workspace,review.id),[workspace,review.id])
  const [selectedId,setSelectedId]=useState(candidates[0]?.id??'')
  const [error,setError]=useState<string|null>(null)
  useEffect(()=>{setSelectedId(candidates[0]?.id??'');setError(null)},[review.id,candidates])
  const selected=candidates.find((candidate)=>candidate.id===selectedId)
  const apply=()=>{
    if(!selected)return
    try{onApply(planRelinkPromotedReview(workspace,review.id,selected.id).command);onClose()}
    catch(reason){setError(reason instanceof Error?reason.message:'Could not relink review')}
  }
  return <div className="review-relink-backdrop" onMouseDown={onClose}>
    <section className="review-relink-dialog" onMouseDown={(event)=>event.stopPropagation()} aria-label="Relink archived review">
      <header><div className="review-relink-title"><Link2 size={17}/><div><span>RELINK REVIEW ARCHIVE</span><h2>Choose the refreshed source review</h2></div></div><button className="icon-button small" onClick={onClose} aria-label="Close relink review"><X size={14}/></button></header>
      <div className="review-relink-native"><strong>{review.kind} · {review.owner}</strong><p>{review.body}</p><small>{review.label} · native Frame review ID stays unchanged</small></div>
      {candidates.length===0?<div className="review-relink-empty"><MessageSquare size={18}/><strong>No safe source candidates are available</strong><span>Re-import the source workbook or keep this native review on its archive. Frame will not guess a source target.</span></div>:<div className="review-relink-list">{candidates.map((candidate)=><button key={candidate.id} className={candidate.id===selectedId?'review-relink-candidate active':'review-relink-candidate'} onClick={()=>{setSelectedId(candidate.id);setError(null)}}><div className="review-relink-candidate-head"><div><strong>{candidate.tableLabel} · {candidate.columnLabel}</strong><span>{candidate.kind==='excel-thread'?'Excel review thread':'Excel cell note'} · {candidate.author}{candidate.sourceStatus?` · ${candidate.sourceStatus}`:''}</span></div><span className="review-relink-score">{candidate.score}</span></div><p>{candidate.body}</p><div className="review-relink-hints">{candidate.matchHints.length?candidate.matchHints.map((hint)=><span key={hint}>{hint}</span>):<span>manual match</span>}{candidate.replyCount!==undefined&&<span>{candidate.replyCount} repl{candidate.replyCount===1?'y':'ies'}</span>}</div></button>)}</div>}
      {selected&&<div className="review-relink-preview"><div><span>Archive</span><strong>{review.label}</strong></div><ArrowRight size={14}/><div><span>Refreshed source</span><strong>{selected.tableLabel} · {selected.columnLabel}</strong></div></div>}
      {error&&<div className="review-relink-error">{error}</div>}
      <footer><div><ShieldCheck size={13}/><span>Only the source pointer and Data target change. Native review text, owner, status, ID, history, and timestamps stay intact.</span></div><div><button className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={!selected} onClick={apply}>Relink review</button></div></footer>
    </section>
  </div>
}
