import { useMemo, useState } from 'react'
import { Archive, CheckCircle2, ClipboardCheck, Filter, MessageSquare, Search, ShieldCheck, X } from 'lucide-react'
import type { WorkspaceState } from '../model'
import { buildReviewCenterItems, filterReviewCenterItems, summarizeReviewCenter, type ReviewCenterItem, type ReviewCenterKind, type ReviewCenterState } from '../reviewCenter'
import { planWorkspaceReviewStatusUpdate } from '../reviewPromotion'
import type { VersionedWorkspaceCommand } from '../semanticCommands'
import { listWorkspaceReviewInbox, type WorkspaceReviewInboxItem } from '../workspaceReviewInbox'
import { ReviewDetachDialog } from './ReviewDetachDialog'
import { ReviewPromotionDialog } from './ReviewPromotionDialog'
import { ReviewRelinkDialog } from './ReviewRelinkDialog'
import '../review-center.css'

type SourceReviewItem=Extract<WorkspaceReviewInboxItem,{origin:'imported-excel'|'imported-excel-thread'}>
type DataReviewItem=Extract<WorkspaceReviewInboxItem,{origin:'frame-data'}>

export function ReviewCenterDialog({workspace,onSemanticCommand,onOpenObject,onClose}:{workspace:WorkspaceState;onSemanticCommand:(command:VersionedWorkspaceCommand)=>void;onOpenObject?:(objectId:string)=>void;onClose:()=>void}){
  const items=useMemo(()=>buildReviewCenterItems(workspace),[workspace]),summary=useMemo(()=>summarizeReviewCenter(items),[items])
  const [state,setState]=useState<'all'|ReviewCenterState>('all'),[kind,setKind]=useState<'all'|ReviewCenterKind>('all'),[owner,setOwner]=useState('all'),[query,setQuery]=useState('')
  const [promotionId,setPromotionId]=useState<string|null>(null),[relinkId,setRelinkId]=useState<string|null>(null),[detachId,setDetachId]=useState<string|null>(null)
  const filtered=useMemo(()=>filterReviewCenterItems(items,{state,kind,owner,query}),[items,state,kind,owner,query])
  const inbox=listWorkspaceReviewInbox(workspace)
  const promotionItem=(promotionId?inbox.find((item)=>item.id===promotionId&&(item.origin==='imported-excel'||item.origin==='imported-excel-thread')):undefined) as SourceReviewItem|undefined
  const relinkItem=(relinkId?inbox.find((item)=>item.id===relinkId&&item.origin==='frame-data'):undefined) as DataReviewItem|undefined
  const detachItem=(detachId?inbox.find((item)=>item.id===detachId&&item.origin==='frame-data'):undefined) as DataReviewItem|undefined
  const complete=(item:ReviewCenterItem)=>{
    if(item.origin==='docs'){onSemanticCommand({type:'annotation.update',annotationId:item.id,field:'status',value:item.kind==='approval'?'approved':'resolved'});return}
    if(item.origin==='data'&&(item.kind==='task'||item.kind==='comment'||item.kind==='approval'))onSemanticCommand(planWorkspaceReviewStatusUpdate(workspace,item.id,item.kind==='approval'?'approved':'resolved'))
  }
  return <div className="review-center-backdrop" onMouseDown={onClose}>
    <section className="review-center-dialog" onMouseDown={(event)=>event.stopPropagation()} aria-label="Review Center">
      <header className="review-center-heading"><div><span>WORKSPACE REVIEW</span><h2>Review Center</h2><p>Native Docs and Data work, imported source review, archived provenance, and completed follow-up in one accountable queue.</p></div><button className="icon-button small" onClick={onClose} aria-label="Close Review Center"><X size={14}/></button></header>
      <div className="review-center-stats"><Stat label="Active" value={summary.active}/><Stat label="Pending approvals" value={summary.pendingApprovals}/><Stat label="Source review" value={summary.source}/><Stat label="Archived" value={summary.archived}/><Stat label="Completed" value={summary.completed}/></div>
      <div className="review-center-toolbar"><label className="review-center-search"><Search size={13}/><input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Search review, owner, source…" aria-label="Search review center"/></label><label><Filter size={12}/><select value={state} onChange={(event)=>setState(event.target.value as 'all'|ReviewCenterState)} aria-label="Review state filter"><option value="all">All states</option><option value="active">Active</option><option value="archived">Archived</option><option value="source">Source review</option><option value="completed">Completed</option></select></label><label><select value={kind} onChange={(event)=>setKind(event.target.value as 'all'|ReviewCenterKind)} aria-label="Review kind filter"><option value="all">All kinds</option><option value="task">Tasks</option><option value="comment">Comments</option><option value="approval">Approvals</option><option value="source-note">Source notes</option><option value="source-thread">Source threads</option></select></label><label><select value={owner} onChange={(event)=>setOwner(event.target.value)} aria-label="Review owner filter"><option value="all">All owners</option>{summary.owners.map((candidate)=><option value={candidate} key={candidate}>{candidate}</option>)}</select></label></div>
      <div className="review-center-results"><div className="review-center-result-count">{filtered.length} of {summary.total} review item{summary.total===1?'':'s'}</div>{filtered.length===0?<div className="review-center-empty"><CheckCircle2 size={20}/><strong>No review matches these filters</strong><span>Change the state, kind, owner, or search query.</span></div>:filtered.map((item)=><ReviewRow key={`${item.origin}:${item.id}`} item={item} onComplete={()=>complete(item)} onPromote={()=>setPromotionId(item.id)} onRelink={()=>setRelinkId(item.id)} onDetach={()=>setDetachId(item.id)} onOpenObject={onOpenObject}/>)}</div>
      <footer><div><ShieldCheck size={13}/><span>Source review stays immutable. Native review actions are versioned, reversible, and source-aware.</span></div><button className="secondary-button" onClick={onClose}>Done</button></footer>
      {promotionItem&&<ReviewPromotionDialog workspace={workspace} sourceItem={promotionItem} onApply={onSemanticCommand} onClose={()=>setPromotionId(null)}/>} 
      {relinkItem&&<ReviewRelinkDialog workspace={workspace} review={relinkItem} onApply={onSemanticCommand} onClose={()=>setRelinkId(null)}/>} 
      {detachItem&&<ReviewDetachDialog workspace={workspace} review={detachItem} onApply={onSemanticCommand} onClose={()=>setDetachId(null)}/>} 
    </section>
  </div>
}

function Stat({label,value}:{label:string;value:number}){return <div className="review-center-stat"><strong>{value}</strong><span>{label}</span></div>}
function ReviewRow({item,onComplete,onPromote,onRelink,onDetach,onOpenObject}:{item:ReviewCenterItem;onComplete:()=>void;onPromote:()=>void;onRelink:()=>void;onDetach:()=>void;onOpenObject?:((objectId:string)=>void)}){
  const native=item.origin==='docs'||item.origin==='data',source=item.origin==='source-note'||item.origin==='source-thread',active=item.state==='active'||item.state==='archived'
  const icon=item.state==='archived'?<Archive size={14}/>:source?<MessageSquare size={14}/>:<ClipboardCheck size={14}/>
  return <article className={`review-center-row state-${item.state}`}><button className="review-center-row-main" onClick={()=>onOpenObject?.(item.objectId)} disabled={!onOpenObject}><span className="review-center-row-icon">{icon}</span><span className="review-center-row-copy"><span className="review-center-row-meta"><strong>{item.label}</strong><small>{item.origin==='docs'?'Docs':item.origin==='data'?'Data':item.origin==='source-thread'?'Excel thread':'Excel note'} · {item.kind} · {item.owner}</small></span><span className="review-center-row-body">{item.body}</span><span className="review-center-row-foot">{item.source?`${item.source} · `:''}{item.status}{item.replyCount!==undefined?` · ${item.replyCount} repl${item.replyCount===1?'y':'ies'}`:''}{item.promotedReviewId?' · promoted':''}</span></span></button><div className="review-center-row-actions">{source&&!item.promotedReviewId&&<button onClick={onPromote}>Promote</button>}{source&&item.promotedReviewId&&<button disabled>Promoted</button>}{native&&active&&<button onClick={onComplete}>{item.kind==='approval'?'Approve':'Resolve'}</button>}{item.origin==='data'&&item.archived&&item.linkedSource&&<button onClick={onRelink}>Relink</button>}{item.origin==='data'&&item.linkedSource&&<button onClick={onDetach}>Detach</button>}</div></article>
}
