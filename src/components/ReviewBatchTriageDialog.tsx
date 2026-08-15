import { useMemo, useState } from 'react'
import { ClipboardCheck, ShieldCheck, X } from 'lucide-react'
import type { WorkspaceState } from '../model'
import { buildReviewCenterItems } from '../reviewCenter'
import { planBatchTriageWorkspaceReviews } from '../reviewBatchTriage'
import type { VersionedWorkspaceCommand } from '../semanticCommands'
import '../review-batch-triage.css'

export function ReviewBatchTriageDialog({workspace,reviewIds,onApply,onClose}:{workspace:WorkspaceState;reviewIds:string[];onApply:(command:VersionedWorkspaceCommand)=>void;onClose:()=>void}){
  const selected=useMemo(()=>{const ids=new Set(reviewIds);return buildReviewCenterItems(workspace).filter((item)=>item.origin==='data'&&ids.has(item.id))},[workspace,reviewIds])
  const [owner,setOwner]=useState(''),[complete,setComplete]=useState(false),[error,setError]=useState<string|null>(null)
  const apply=()=>{try{const plan=planBatchTriageWorkspaceReviews(workspace,reviewIds,{...(owner.trim()?{owner}:{}),complete});onApply(plan.command);onClose()}catch(reason){setError(reason instanceof Error?reason.message:'Could not triage selected review')}}
  return <div className="review-triage-backdrop" onMouseDown={onClose}>
    <section className="review-triage-dialog" onMouseDown={(event)=>event.stopPropagation()} aria-label="Batch triage native Data review">
      <header><div><ClipboardCheck size={18}/><div><span>BATCH TRIAGE</span><h2>Update {selected.length} native Data review item{selected.length===1?'':'s'}</h2><p>Owner and completion changes are committed as one semantic revision.</p></div></div><button className="icon-button small" onClick={onClose} aria-label="Close batch triage"><X size={14}/></button></header>
      <div className="review-triage-controls"><label><span>Reassign owner · optional</span><input value={owner} onChange={(event)=>{setOwner(event.target.value);setError(null)}} placeholder="e.g. Finance lead" /></label><label className="review-triage-check"><input type="checkbox" checked={complete} onChange={(event)=>{setComplete(event.target.checked);setError(null)}}/><span>Complete selected review</span><small>Tasks/comments → resolved · approvals → approved</small></label></div>
      <div className="review-triage-list">{selected.map((item)=><article key={item.id}><div><strong>{item.label}</strong><span>{item.kind} · {item.owner} · {item.status}</span></div><p>{item.body}</p>{item.source&&<small>{item.source}{item.archived?' · review archive':''}</small>}</article>)}</div>
      <div className="review-triage-policy"><ShieldCheck size={14}/><span>Source links, review IDs, authored text, and creation timestamps are preserved. Only the requested owner/status fields change.</span></div>
      {error&&<div className="review-triage-error">{error}</div>}
      <footer><button className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={!selected.length||(!owner.trim()&&!complete)} onClick={apply}>Apply to {selected.length}</button></footer>
    </section>
  </div>
}
