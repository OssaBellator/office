import { CheckCircle2, Clock3, Database, FileText, Presentation, Table2, X } from 'lucide-react'
import { formatMetric, type SourceRecord, type Surface, type WorkspaceState } from '../model'
import type { VersionedWorkspaceTransaction } from '../versioning'
import { getTransactionDiff } from '../revert'

export function ContextPanel({ workspace, surface, transactions, onSetSourceStatus, onClose }: { workspace: WorkspaceState; surface: Surface; transactions: VersionedWorkspaceTransaction[]; onSetSourceStatus: (sourceId: string, status: SourceRecord['status']) => void; onClose: () => void }) {
  const revenue = workspace.metrics.find((metric) => metric.id === 'revenue')!
  const latestEvent = workspace.history[0]
  const connectedCount = workspace.graph.objects.filter((object) => object.surfaces.includes(surface)).length
  return (
    <aside className="context-panel">
      <div className="context-heading"><span>Context</span><button className="icon-button small" onClick={onClose} aria-label="Close context"><X size={14} /></button></div>
      <div className="context-section"><span className="context-label">Current view</span><div className="context-view-card">{surface === 'docs' ? <FileText size={16} /> : surface === 'data' ? <Table2 size={16} /> : <Presentation size={16} />}<div><strong>{surface === 'docs' ? 'Strategy document' : surface === 'data' ? 'Revenue model' : 'Board narrative'}</strong><span>{connectedCount} connected objects</span></div></div></div>
      <div className="context-section"><span className="context-label">Connected object</span><div className="object-detail"><div className="object-detail-title"><Database size={15} /><strong>{revenue.label}</strong></div><div className="object-value">{formatMetric(revenue)}</div><dl><div><dt>Definition</dt><dd>{revenue.formula ?? 'Manual metric'}</dd></div><div><dt>Source</dt><dd>{revenue.source}</dd></div><div><dt>Updated</dt><dd>{revenue.updatedAt}</dd></div><div><dt>Used in</dt><dd>Strategy · Performance scene</dd></div></dl></div></div>
      <div className="context-section"><span className="context-label">Sources & freshness</span><div className="context-source-list">{workspace.sources.map((source) => <div className="context-source-row" key={source.id}><span className={source.status === 'live' ? 'freshness-dot live' : 'freshness-dot stale'} /><div><strong>{source.label}</strong><span>{source.locator} · {source.status}</span></div><button onClick={() => onSetSourceStatus(source.id, source.status === 'live' ? 'stale' : 'live')}>{source.status === 'live' ? 'Mark stale' : 'Mark live'}</button></div>)}</div></div>
      <div className="context-section"><span className="context-label">Semantic history</span><div className="history-list">{transactions.length === 0 ? <div className="history-empty">No structured transactions yet</div> : transactions.slice(-4).reverse().map((transaction) => { const diffs = getTransactionDiff(transaction); return <div className="history-entry" key={transaction.id}><span className="history-marker" /><div><strong>v{transaction.revision} · {transaction.summary}</strong><span>{diffs.length} semantic change{diffs.length === 1 ? '' : 's'} · {transaction.kind}{transaction.kind === 'revert' ? ' revision' : ''}</span></div></div> })}</div></div>
      <div className="context-section"><span className="context-label">Activity</span><div className="activity-row"><Clock3 size={14} /><div><strong>{latestEvent?.summary ?? 'No semantic changes yet'}</strong><span>{latestEvent ? `${latestEvent.affectedObjectIds.length} downstream objects · ${latestEvent.changedAt}` : 'Edits to shared objects will appear here'}</span></div></div><div className="activity-row"><CheckCircle2 size={14} /><div><strong>Version ledger durable</strong><span>Undo, redo, branches and revisions persist locally</span></div></div></div>
    </aside>
  )
}
