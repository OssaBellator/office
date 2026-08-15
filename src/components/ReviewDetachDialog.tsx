import { Link2Off, ShieldCheck, X } from 'lucide-react'
import type { WorkspaceState } from '../model'
import { planDetachWorkspaceReviewSource } from '../reviewDetach'
import type { VersionedWorkspaceCommand } from '../semanticCommands'
import type { WorkspaceReviewInboxItem } from '../workspaceReviewInbox'
import '../review-detach.css'

type LinkedReviewItem=Extract<WorkspaceReviewInboxItem,{origin:'frame-data'}>

export function ReviewDetachDialog({workspace,review,onApply,onClose}:{workspace:WorkspaceState;review:LinkedReviewItem;onApply:(command:VersionedWorkspaceCommand)=>void;onClose:()=>void}){
  const apply=()=>{onApply(planDetachWorkspaceReviewSource(workspace,review.id).command);onClose()}
  return <div className="review-detach-backdrop" onMouseDown={onClose}>
    <section className="review-detach-dialog" onMouseDown={(event)=>event.stopPropagation()} aria-label="Detach native review from source">
      <header><div><Link2Off size={17}/><div><span>DETACH SOURCE</span><h2>Keep the Frame work, release the source Data</h2></div></div><button className="icon-button small" onClick={onClose} aria-label="Close detach source"><X size={14}/></button></header>
      <div className="review-detach-card"><strong>{review.kind} · {review.owner}</strong><p>{review.body}</p><small>{review.label} · currently linked to {review.source}</small></div>
      <p className="review-detach-copy">The imported note/thread remains untouched in its source table. This native Frame review keeps its ID, text, owner, status, timestamp, and semantic history, but will no longer point at that imported source. The source table can then be removed independently.</p>
      <div className="review-detach-warning"><ShieldCheck size={14}/><span>The previous source pointer remains recoverable through semantic history and conflict-aware revert.</span></div>
      <footer><button className="secondary-button" onClick={onClose}>Keep source link</button><button className="primary-button" onClick={apply}>Detach source</button></footer>
    </section>
  </div>
}
