import { useEffect, useState } from 'react'
import { ClipboardCheck, MessageSquare, ShieldCheck, X } from 'lucide-react'
import type { WorkspaceState } from '../model'
import { planPromoteSourceReview } from '../reviewPromotion'
import type { VersionedWorkspaceCommand } from '../semanticCommands'
import type { WorkspaceReviewInboxItem } from '../workspaceReviewInbox'
import type { WorkspaceReviewKind } from '../workspaceReviews'
import '../review-promotion.css'

type SourceReviewItem=Extract<WorkspaceReviewInboxItem,{origin:'imported-excel'|'imported-excel-thread'|'imported-word'}>

export function ReviewPromotionDialog({workspace,sourceItem,onApply,onClose}:{workspace:WorkspaceState;sourceItem:SourceReviewItem;onApply:(command:VersionedWorkspaceCommand)=>void;onClose:()=>void}){
  const [kind,setKind]=useState<WorkspaceReviewKind>('task')
  const [owner,setOwner]=useState('')
  const [body,setBody]=useState(sourceItem.body)
  const [error,setError]=useState<string|null>(null)
  useEffect(()=>{setKind('task');setOwner('');setBody(sourceItem.body);setError(null)},[sourceItem.id,sourceItem.body])
  const apply=()=>{
    try{
      const promotion=planPromoteSourceReview(workspace,sourceItem.id,{kind,owner,body})
      onApply(promotion.command)
      onClose()
    }catch(reason){setError(reason instanceof Error?reason.message:'Could not promote source review')}
  }
  const threaded=sourceItem.origin==='imported-excel-thread',word=sourceItem.origin==='imported-word'
  const sourceKind=word?'Word comment':threaded?'Excel review thread':'Excel cell note'
  const needsOwner=kind==='approval'&&!owner.trim()
  return <div className="review-promotion-backdrop" onMouseDown={onClose}>
    <section className="review-promotion-dialog" onMouseDown={(event)=>event.stopPropagation()} aria-label="Promote source review">
      <header><div className="review-promotion-title"><ClipboardCheck size={17}/><div><span>PROMOTE SOURCE REVIEW</span><h2>Turn provenance into accountable work</h2></div></div><button className="icon-button small" onClick={onClose} aria-label="Close promotion editor"><X size={14}/></button></header>
      <div className="review-promotion-source"><div><MessageSquare size={14}/><strong>{sourceKind}</strong></div><p>{sourceItem.body}</p><small>{sourceItem.label} · {sourceItem.source} · source author {sourceItem.owner}{threaded?` · ${sourceItem.replyCount} repl${sourceItem.replyCount===1?'y':'ies'} · ${sourceItem.sourceStatus}`:''}</small></div>
      <div className="review-promotion-field"><span>Frame review type</span><div className="review-promotion-kinds">{(['task','comment','approval'] as WorkspaceReviewKind[]).map((candidate)=><button key={candidate} className={kind===candidate?'active':''} onClick={()=>{setKind(candidate);setError(null)}}>{candidate==='task'?'Task':candidate==='comment'?'Comment':'Approval'}</button>)}</div></div>
      <label className="review-promotion-field"><span>Owner{kind==='approval'?' · required':''}</span><input value={owner} onChange={(event)=>{setOwner(event.target.value);setError(null)}} placeholder={kind==='approval'?'Choose an approver':'Unassigned'} aria-label="Promoted review owner"/><small>{kind==='approval'?'An approval needs a named owner and remains pending until explicitly approved.':'Leave blank to keep the follow-up unassigned.'}</small></label>
      <label className="review-promotion-field"><span>Native follow-up</span><textarea value={body} onChange={(event)=>{setBody(event.target.value);setError(null)}} rows={4} aria-label="Promoted review body"/><small>The imported source review remains unchanged; edits here apply only to the new Frame review.</small></label>
      {error&&<div className="review-promotion-error">{error}</div>}
      <footer><div><ShieldCheck size={13}/><span>Promotion is a normal semantic revision with undo, history, revert, and source linkage.</span></div><div><button className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={!body.trim()||needsOwner} onClick={apply}>Promote as {kind}</button></div></footer>
    </section>
  </div>
}
