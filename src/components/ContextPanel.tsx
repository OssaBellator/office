import { AlertTriangle, CheckCircle2, Clock3, Database, FileText, MessageSquare, Presentation, ShieldCheck, Table2, X } from 'lucide-react'
import { formatMetric, getObjectLineage, type SourceRecord, type Surface, type WorkspaceState } from '../model'
import { getPresentationState } from '../presentationState'
import { getSemanticDocument, resolveSemanticClaim } from '../semanticDocument'
import type { VersionedWorkspaceTransaction } from '../versioning'
import type { VersionedWorkspaceCommand } from '../semanticCommands'
import { getTransactionDiff } from '../revert'
import { assessWorkspaceReadiness } from '../workspaceDiagnostics'
import { getDocumentReviewGate, listReviewInbox } from '../reviewWorkflow'
import { locateWorkspaceObject } from '../workspaceNavigation'

export function ContextPanel({ workspace, surface, transactions, selectedObjectId, onSemanticCommand, onSetSourceStatus, onClose }: { workspace: WorkspaceState; surface: Surface; transactions: VersionedWorkspaceTransaction[]; selectedObjectId?: string | null; onSemanticCommand: (command: VersionedWorkspaceCommand) => void; onSetSourceStatus: (sourceId: string, status: SourceRecord['status']) => void; onClose: () => void }) {
  const revenue = workspace.metrics.find((metric) => metric.id === 'revenue')!
  const latestEvent = workspace.history[0]
  const connectedCount = workspace.graph.objects.filter((object) => object.surfaces.includes(surface)).length
  const semantic = getSemanticDocument(workspace)
  const claimStatuses = semantic.claims.map((claim) => resolveSemanticClaim(workspace, claim.id).status)
  const supportedClaims = claimStatuses.filter((status) => status === 'supported').length
  const attentionClaims = claimStatuses.length - supportedClaims
  const openReviews = semantic.annotations.filter((annotation) => annotation.status === 'open' || annotation.status === 'pending').length
  const presentation = getPresentationState(workspace)
  const visibleScenes = presentation.order.length - presentation.hiddenSceneIds.length
  const overriddenNotes = Object.keys(presentation.notes).length
  const chart = workspace.charts.find((item) => item.id === 'revenue-vs-plan')
  const readiness = assessWorkspaceReadiness(workspace)
  const reviewGate = getDocumentReviewGate(workspace)
  const reviewInbox = listReviewInbox(workspace).filter((item) => item.status === 'open' || item.status === 'pending').slice(0, 4)
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

      <div className="context-section"><span className="context-label">Review readiness</span><div className="context-readiness"><div className="context-readiness-head"><div><strong>{readiness.readyForReview ? 'Workspace ready for review' : 'Workspace needs attention'}</strong><span>{readiness.errors} errors · {readiness.warnings} warnings · {reviewGate.openTasks} open tasks</span></div><span className={readiness.readyForReview ? 'readiness-pill ready' : 'readiness-pill'}>{readiness.readyForReview ? 'Ready' : 'Blocked'}</span></div>{readiness.diagnostics.length > 0 && <div className="context-diagnostic-list">{readiness.diagnostics.slice(0, 4).map((item) => <div className={`context-diagnostic ${item.severity}`} key={item.id}><span className="context-diagnostic-dot" /><div><strong>{item.area} · {item.severity}</strong><span>{item.message}</span></div></div>)}</div>}</div></div>

      {selectedObjectId && focusedLocation && <div className="context-section"><span className="context-label">Focused object</span><div className="focused-object-card"><header><div><strong>{focusedLocation.label}</strong><span>{focusedLocation.surface} · {focusedLocation.secondarySurfaces.length ? `also ${focusedLocation.secondarySurfaces.join(', ')}` : 'primary representation'}</span></div><ShieldCheck size={14} /></header><code>{focusedLocation.objectId}</code><div className="focused-object-stats"><div><strong>{focusedLineage?.upstream.length ?? 0}</strong><span>upstream</span></div><div><strong>{focusedLineage?.downstream.length ?? 0}</strong><span>downstream</span></div></div></div></div>}

      <div className="context-section"><span className="context-label">Review inbox</span>{reviewInbox.length === 0 ? <div className="history-empty">No open block reviews</div> : reviewInbox.map((item) => <div className="context-review-item" key={item.id}><div><strong>{item.kind} · {item.owner}</strong><span>{item.body}</span></div><button onClick={() => onSemanticCommand({ type:'annotation.update', annotationId:item.id, field:'status', value:item.kind === 'approval' ? 'approved' : 'resolved' })}>{item.kind === 'approval' ? 'Approve' : 'Resolve'}</button></div>)}{reviewGate.warnings.length > 0 && <div className="activity-row"><AlertTriangle size={13} /><div><strong>Follow-up remains</strong><span>{reviewGate.warnings.join(' · ')}</span></div></div>}</div>

      <div className="context-section"><span className="context-label">Workspace semantics</span><div className="activity-row"><ShieldCheck size={14} /><div><strong>{supportedClaims}/{claimStatuses.length} claims supported</strong><span>{attentionClaims ? `${attentionClaims} claim${attentionClaims === 1 ? '' : 's'} stale or contradicted` : 'All grounded claims are currently supported'}</span></div></div><div className="activity-row"><MessageSquare size={14} /><div><strong>{openReviews} open review{openReviews === 1 ? '' : 's'}</strong><span>{semantic.annotations.length} block comments, tasks, and approvals · {semantic.blocks.length} document blocks</span></div></div><div className="activity-row"><Presentation size={14} /><div><strong>{visibleScenes}/{presentation.order.length} scenes visible</strong><span>{overriddenNotes} authored speaker note{overriddenNotes === 1 ? '' : 's'} · chart {chart?.kind === 'line' ? 'line' : 'grouped bars'}</span></div></div></div>
      <div className="context-section"><span className="context-label">Connected object</span><div className="object-detail"><div className="object-detail-title"><Database size={15} /><strong>{revenue.label}</strong></div><div className="object-value">{formatMetric(revenue)}</div><dl><div><dt>Definition</dt><dd>{revenue.formula ?? 'Manual metric'}</dd></div><div><dt>Source</dt><dd>{revenue.source}</dd></div><div><dt>Updated</dt><dd>{revenue.updatedAt}</dd></div><div><dt>Used in</dt><dd>Strategy · Performance scene</dd></div></dl></div></div>
      <div className="context-section"><span className="context-label">Sources & freshness</span><div className="context-source-list">{workspace.sources.map((source) => <div className="context-source-row" key={source.id}><span className={source.status === 'live' ? 'freshness-dot live' : 'freshness-dot stale'} /><div><strong>{source.label}</strong><span>{source.locator} · {source.status}</span></div><button onClick={() => onSetSourceStatus(source.id, source.status === 'live' ? 'stale' : 'live')}>{source.status === 'live' ? 'Mark stale' : 'Mark live'}</button></div>)}</div></div>
      <div className="context-section"><span className="context-label">Semantic history</span><div className="history-list">{transactions.length === 0 ? <div className="history-empty">No structured transactions yet</div> : transactions.slice(-4).reverse().map((transaction) => { const diffs = getTransactionDiff(transaction); return <div className="history-entry" key={transaction.id}><span className="history-marker" /><div><strong>v{transaction.revision} · {transaction.summary}</strong><span>{diffs.length} semantic change{diffs.length === 1 ? '' : 's'} · {transaction.kind}{transaction.kind === 'revert' ? ' revision' : ''}</span></div></div> })}</div></div>
      <div className="context-section"><span className="context-label">Activity</span><div className="activity-row"><Clock3 size={14} /><div><strong>{latestEvent?.summary ?? 'No semantic changes yet'}</strong><span>{latestEvent ? `${latestEvent.affectedObjectIds.length} downstream objects · ${latestEvent.changedAt}` : 'Edits to shared objects will appear here'}</span></div></div><div className="activity-row"><CheckCircle2 size={14} /><div><strong>Version ledger durable</strong><span>Undo, redo, branches and revisions persist locally</span></div></div></div>
    </aside>
  )
}
