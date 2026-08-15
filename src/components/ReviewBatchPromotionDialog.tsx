import { useMemo, useState } from 'react'
import { CheckSquare, ShieldCheck, X } from 'lucide-react'
import type { WorkspaceState } from '../model'
import { planBatchPromoteSourceReviews } from '../reviewBatchPromotion'
import type { VersionedWorkspaceCommand } from '../semanticCommands'
import { buildReviewCenterItems } from '../reviewCenter'
import '../review-batch-promotion.css'

export function ReviewBatchPromotionDialog({workspace,sourceItemIds,onApply,onClose}:{workspace:WorkspaceState;sourceItemIds:string[];onApply:(command:VersionedWorkspaceCommand)=>void;onClose:()=>void}){
  const sourceItems=useMemo(()=>{const selected=new Set(sourceItemIds);return buildReviewCenterItems(workspace).filter((item)=>selected.has(item.id)&&(item.origin==='source-note'||item.origin==='source-thread'))},[workspace,sourceItemIds])
  const [kind,setKind]=useState<'task'|'comment'|'approval'>('task'),[owner,setOwner]=useState(''),[error,setError]=useState<string|null>(null)
  const apply=()=>{try{const plan=planBatchPromoteSourceReviews(workspace,sourceItemIds,{kind,owner});onApply(plan.command);onClose()}catch(reason){setError(reason instanceof Error?reason.message:'Could not promote selected review')}}
  const ownerRequired=kind==='approval'
  return <div className="review-batch-backdrop" onMouseDown={onClose}>
    <section className="review-batch-dialog" onMouseDown={(event)=>event.stopPropagation()} aria-label="Batch promote source review">
      <header><div><CheckSquare size={18}/><div><span>BATCH PROMOTION</span><h2>Turn {sourceItems.length} source review item{sourceItems.length===1?'':'s'} into Frame work</h2><p>One semantic revision creates the whole batch, so sibling promotions cannot overwrite each other.</p></div></div><button className="icon-button small" onClick={onClose} aria-label="Close batch promotion"><X size={14}/></button></header>
      <div className="review-batch-controls"><label><span>Native review kind</span><select value={kind} onChange={(event)=>{setKind(event.target.value as typeof kind);setError(null)}}><option value="task">Task</option><option value="comment">Comment</option><option value="approval">Approval</option></select></label><label><span>Owner {ownerRequired?'· required':'· optional'}</span><input value={owner} onChange={(event)=>{setOwner(event.target.value);setError(null)}} placeholder={ownerRequired?'e.g. Finance lead':'Unassigned'} /></label></div>
      <div className="review-batch-list">{sourceItems.map((item)=><article key={item.id}><div><strong>{item.label}</strong><span>{item.origin==='source-thread'?'Excel review thread':'Excel cell note'} · {item.owner} · {item.source}</span></div><p>{item.body}</p></article>)}</div>
      <div className="review-batch-policy"><ShieldCheck size={14}/><span>Each native review keeps its own source pointer and source text. The imported notes/threads remain immutable provenance.</span></div>
      {error&&<div className="review-batch-error">{error}</div>}
      <footer><button className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={!sourceItems.length||(ownerRequired&&!owner.trim())} onClick={apply}>Promote {sourceItems.length} selected</button></footer>
    </section>
  </div>
}
