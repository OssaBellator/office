import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock3, Database, FileText, MessageSquare, Presentation, ShieldCheck, Table2, X } from 'lucide-react'
import { formatMetric, getObjectLineage, type SourceRecord, type Surface, type WorkspaceState } from '../model'
import { getPresentationState } from '../presentationState'
import { getSemanticDocument, resolveSemanticClaim } from '../semanticDocument'
import type { VersionedWorkspaceTransaction } from '../versioning'
import type { VersionedWorkspaceCommand } from '../semanticCommands'
import { getTransactionDiff } from '../revert'
import { assessWorkspaceReadiness } from '../workspaceDiagnostics'
import { getDocumentReviewGate } from '../reviewWorkflow'
import { planWorkspaceReviewStatusUpdate } from '../reviewPromotion'
import { listWorkspaceReviewInbox, summarizeWorkspaceReviewInbox, type WorkspaceReviewInboxItem } from '../workspaceReviewInbox'
import { locateWorkspaceObject } from '../workspaceNavigation'
import { ReviewPromotionDialog } from './ReviewPromotionDialog'
import { ReviewRelinkDialog } from './ReviewRelinkDialog'

type SourceReviewItem=Extract<WorkspaceReviewInboxItem,{origin:'imported-excel'|'imported-excel-thread'}>
type PromotedDataReviewItem=Extract<WorkspaceReviewInboxItem,{origin:'frame-data'}>

export function ContextPanel({ workspace, surface, transactions, selectedObjectId, onSemanticCommand, onSetSourceStatus, onClose }: { workspace: WorkspaceState; surface: Surface; transactions: VersionedWorkspaceTransaction[]; selectedObjectId?: string | null; onSemanticCommand: (command: VersionedWorkspaceCommand) => void; onSetSourceStatus: (sourceId: string, status: SourceRecord['status']) => void; onClose: () => void }) {
  const [promotionSourceId,setPromotionSourceId]=useState<string|null>(null)
  const [relinkReviewId,setRelinkReviewId]=useState<string|null>(null)
  const revenue = workspace.metrics.find((metric) => metric.id === 'revenue')!
  const latestEvent = workspace.history[0]
  const connectedCount = workspace.graph.objects.filter((object) => object.surfaces.includes(surface)).length
  const semantic = getSemanticDocument(workspace)
  const claimStatuses = semantic.claims.map((claim) => resolveSemanticClaim(workspace, claim.id).status)
  const supportedClaims = claimStatuses.filter((status) => status === 'supported').length
  const attentionClaims = claimStatuses.length - supportedClaims
  const presentation = getPresentationState(workspace)
  const visibleScenes = presentation.order.length - presentation.hiddenSceneIds.length
  const overriddenNotes = Object.keys(presentation.notes).length
  const chart = workspace.charts.find((item) => item.id === 'revenue-vs-plan')
  const readiness = assessWorkspaceReadiness(workspace)
  const reviewGate = getDocumentReviewGate(workspace)
  const reviewSummary = summarizeWorkspaceReviewInbox(workspace)
  const allReviewInbox = listWorkspaceReviewInbox(workspace)
  const reviewInbox = allReviewInbox.slice(0, 6)
  const promotionItem=(promotionSourceId?allReviewInbox.find((item)=>item.id===promotionSourceId&&(item.origin==='imported-excel'||item.origin==='imported-excel-thread')):undefined) as SourceReviewItem|undefined
  const relinkItem=(relinkReviewId?allReviewInbox.find((item)=>item.id===relinkReviewId&&item.origin==='frame-data'&&item.archived):undefined) as PromotedDataReviewItem|undefined
  const sourceReviewCount=reviewSummary.importedWordComments+reviewSummary.importedSourceNotes+reviewSummary.importedThreads
  const nativeOpenReviews=reviewSummary.nativeOpen
  let focusedLocation = null as ReturnType<typeof locateWorkspaceObject> | null
  let focusedLineage = null as ReturnType<typeof getObjectLineage> | null
  if (selectedObjectId) {
    try { focusedLocation = locateWorkspaceObject(workspace, selectedObjectId) } catch { focusedLocation = null }
    try { focusedLineage = getObjectLineage(workspace, selectedObjectId) } catch { focusedLineage = null }
  }
  return (
    <aside className="context-panel">
      <div className="context-heading"><span>Context</span><button className="icon-button small" onClick={onClose} aria-label="Close context"><X size={14} /></button></div>
      <div className="context-section"><span className="context-label">Current view</span><div className="context-view-card">{surface === 'docs' ? <FileText size={16} /> : surface === 'data' ? <Table2 size={16} /> : <Presentation size={16} />}<div><strong>{surface === 'docs' ? 'Strategy document' : surface === 'data' ? 'Revenue model' : 'Board narrative'}</strong><span>{connectedCount} connected objects</span></div></div></div>

      <div className="context-section"><span className="context-label">Review readiness</span><div className="context-readiness"><div className="context-readiness-head"><div><strong>{readiness.readyForReview ? 'Workspace ready for review' : 'Workspace needs attention'}</strong><span>{readiness.errors} errors · {readiness.warnings} warnings · {readiness.openTasks} open tasks{sourceReviewCount ? ` · ${sourceReviewCount} source review${sourceReviewCount === 1 ? '' : 's'}` : ''}{reviewSummary.archivedNativeOpen?` · ${reviewSummary.archivedNativeOpen} archived review${reviewSummary.archivedNativeOpen===1?'':'s'}`:''}</span></div><span className={readiness.readyForReview ? 'readiness-pill ready' : 'readiness-pill'}>{readiness.readyForReview ? 'Ready' : 'Blocked'}</span></div>{readiness.diagnostics.length > 0 && <div className="context-diagnostic-list">{readiness.diagnostics.slice(0, 4).map((item) => <div className={`context-diagnostic ${item.severity}`} key={item.id}><span className="context-diagnostic-dot" /><div><strong>{item.area} · {item.severity}</strong><span>{item.message}</span></div></div>)}</div>}</div></div>

      {selectedObjectId && focusedLocation && <div className="context-section"><span className="context-label">Focused object</span><div className="focused-object-card"><header><div><strong>{focusedLocation.label}</strong><span>{focusedLocation.surface} · {focusedLocation.secondarySurfaces.length ? `also ${focusedLocation.secondarySurfaces.join(', ')}` : 'primary representation'}</span></div><ShieldCheck size={14} /></header><code>{focusedLocation.objectId}</code><div className="focused-object-stats"><div><strong>{focusedLineage?.upstream.length ?? 0}</strong><span>upstream</span></div><div><strong>{focusedLineage?.downstream.length ?? 0}</strong><span>downstream</span></div></div></div></div>}

      <div className="context-section"><span className="context-label">Review inbox</span>{reviewInbox.length === 0 ? <div className="history-empty">No open reviews or imported source review</div> : reviewInbox.map((item) => {
        const threaded=item.origin==='imported-excel-thread',wordSource=item.origin==='imported-word',documentNative=item.origin==='frame',promotedNative=item.origin==='frame-data',excelSource=item.origin==='imported-excel'||item.origin==='imported-excel-thread'
        const sourceLabel=wordSource?'Word source comment':threaded?'Excel source thread':'Excel source note'
        return <div className="context-review-item" key={item.id}><div><strong>{documentNative||promotedNative?`${item.kind} · ${item.owner}`:`${sourceLabel} · ${item.owner}`}</strong><span>{item.body}</span>{promotedNative&&<small>{item.label} · {item.archived?'review archive · ':'promoted from '}{item.source}</small>}{(excelSource||wordSource)&&<small>{item.label} · {item.source}{threaded?` · ${item.replyCount} repl${item.replyCount===1?'y':'ies'} · ${item.sourceStatus}`:''}</small>}</div>{documentNative?<button onClick={() => onSemanticCommand({ type:'annotation.update', annotationId:item.id, field:'status', value:item.kind === 'approval' ? 'approved' : 'resolved' })}>{item.kind === 'approval' ? 'Approve' : 'Resolve'}</button>:promotedNative?<div className="context-review-actions"><button onClick={()=>onSemanticCommand(planWorkspaceReviewStatusUpdate(workspace,item.id,item.kind==='approval'?'approved':'resolved'))}>{item.kind==='approval'?'Approve':'Resolve'}</button>{item.archived&&<button onClick={()=>setRelinkReviewId(item.id)} title="Explicitly attach this native review to a refreshed source note or thread">Relink</button>}</div>:wordSource?<button disabled title="Imported Word comment provenance is read-only source review">Source</button>:excelSource&&item.promotedReviewId?<button disabled title={`Promoted as ${item.promotedReviewId}`}>Promoted</button>:excelSource?<button onClick={()=>setPromotionSourceId(item.id)} title="Create native Frame review linked back to this immutable source review">Promote</button>:null}</div>
      })}{reviewGate.warnings.length > 0 && <div className="activity-row"><AlertTriangle size={13} /><div><strong>Follow-up remains</strong><span>{reviewGate.warnings.join(' · ')}</span></div></div>}{reviewSummary.archivedNativeOpen>0&&<div className="activity-row"><AlertTriangle size={13}/><div><strong>{reviewSummary.archivedNativeOpen} native review{reviewSummary.archivedNativeOpen===1?'':'s'} awaiting source relink</strong><span>Automatic re-import matching refused to guess. Use Relink to choose the refreshed source explicitly.</span></div></div>}{sourceReviewCount > 0 && <div className="activity-row"><MessageSquare size={13} /><div><strong>{reviewSummary.importedWordComments} Word comment{reviewSummary.importedWordComments === 1 ? '' : 's'} · {reviewSummary.importedSourceNotes} Excel note{reviewSummary.importedSourceNotes === 1 ? '' : 's'} · {reviewSummary.importedThreads} Excel thread{reviewSummary.importedThreads === 1 ? '' : 's'}</strong><span>{reviewSummary.importedOpenThreads} imported Excel thread{reviewSummary.importedOpenThreads===1?'':'s'} open · {reviewSummary.promotedNativeOpen} promoted Frame review{reviewSummary.promotedNativeOpen===1?'':'s'} open · source provenance does not block readiness until promoted</span></div></div>}</div>

      <div className="context-section"><span className="context-label">Workspace semantics</span><div className="activity-row"><ShieldCheck size={14} /><div><strong>{supportedClaims}/{claimStatuses.length} claims supported</strong><span>{attentionClaims ? `${attentionClaims} claim${attentionClaims === 1 ? '' : 's'} stale or contradicted` : 'All grounded claims are currently supported'}</span></div></div><div className="activity-row"><MessageSquare size={14} /><div><strong>{nativeOpenReviews} native review{nativeOpenReviews === 1 ? '' : 's'} open · {sourceReviewCount} source review{sourceReviewCount === 1 ? '' : 's'}</strong><span>{semantic.annotations.length} Docs review records · {reviewSummary.promotedNativeOpen} promoted Data review{reviewSummary.promotedNativeOpen===1?'':'s'} · {reviewSummary.importedThreadComments} imported threaded comment{reviewSummary.importedThreadComments === 1 ? '' : 's'}</span></div></div><div className="activity-row"><Presentation size={14} /><div><strong>{visibleScenes}/{presentation.order.length} scenes visible</strong><span>{overriddenNotes} authored speaker note{overriddenNotes === 1 ? '' : 's'} · chart {chart?.kind === 'line' ? 'line' : 'grouped bars'}</span></div></div></div>
      <div className="context-section"><span className="context-label">Connected object</span><div className="object-detail"><div className="object-detail-title"><Database size={15} /><strong>{revenue.label}</strong></div><div className="object-value">{formatMetric(revenue)}</div><dl><div><dt>Definition</dt><dd>{revenue.formula ?? 'Manual metric'}</dd></div><div><dt>Source</dt><dd>{revenue.source}</dd></div><div><dt>Updated</dt><dd>{revenue.updatedAt}</dd></div><div><dt>Used in</dt><dd>Strategy · Performance scene</dd></div></dl></div></div>
      <div className="context-section"><span className="context-label">Sources & freshness</span><div className="context-source-list">{workspace.sources.map((source) => <div className="context-source-row" key={source.id}><span className={source.status === 'live' ? 'freshness-dot live' : 'freshness-dot stale'} /><div><strong>{source.label}</strong><span>{source.locator} · {source.status}</span></div><button onClick={() => onSetSourceStatus(source.id, source.status === 'live' ? 'stale' : 'live')}>{source.status === 'live' ? 'Mark stale' : 'Mark live'}</button></div>)}</div></div>
      <div className="context-section"><span className="context-label">Semantic history</span><div className="history-list">{transactions.length === 0 ? <div className="history-empty">No structured transactions yet</div> : transactions.slice(-4).reverse().map((transaction) => { const diffs = getTransactionDiff(transaction); return <div className="history-entry" key={transaction.id}><span className="history-marker" /><div><strong>v{transaction.revision} · {transaction.summary}</strong><span>{diffs.length} semantic change{diffs.length === 1 ? '' : 's'} · {transaction.kind}{transaction.kind === 'revert' ? ' revision' : ''}</span></div></div> })}</div></div>
      <div className="context-section"><span className="context-label">Activity</span><div className="activity-row"><Clock3 size={14} /><div><strong>{latestEvent?.summary ?? 'No semantic changes yet'}</strong><span>{latestEvent ? `${latestEvent.affectedObjectIds.length} downstream objects · ${latestEvent.changedAt}` : 'Edits to shared objects will appear here'}</span></div></div><div className="activity-row"><CheckCircle2 size={14} /><div><strong>Version ledger durable</strong><span>Undo, redo, branches and revisions persist locally</span></div></div></div>
      {promotionItem&&<ReviewPromotionDialog workspace={workspace} sourceItem={promotionItem} onApply={onSemanticCommand} onClose={()=>setPromotionSourceId(null)}/>} 
      {relinkItem&&<ReviewRelinkDialog workspace={workspace} review={relinkItem} onApply={onSemanticCommand} onClose={()=>setRelinkReviewId(null)}/>} 
    </aside>
  )
}
