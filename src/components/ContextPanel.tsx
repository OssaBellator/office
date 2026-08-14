import { CheckCircle2, Clock3, Database, FileText, Presentation, Table2, X } from 'lucide-react'
import { formatMetric, type Surface, type WorkspaceState, type WorkspaceTransaction } from '../model'
import { previewWorkspaceCommand } from '../commandPreview'

export function ContextPanel({
  workspace,
  surface,
  transactions,
  onClose,
}: {
  workspace: WorkspaceState
  surface: Surface
  transactions: WorkspaceTransaction[]
  onClose: () => void
}) {
  const revenue = workspace.metrics.find((metric) => metric.id === 'revenue')!
  const latestEvent = workspace.history[0]
  const connectedCount = workspace.graph.objects.filter((object) => object.surfaces.includes(surface)).length

  return (
    <aside className="context-panel">
      <div className="context-heading">
        <span>Context</span>
        <button className="icon-button small" onClick={onClose} aria-label="Close context"><X size={14} /></button>
      </div>

      <div className="context-section">
        <span className="context-label">Current view</span>
        <div className="context-view-card">
          {surface === 'docs' ? <FileText size={16} /> : surface === 'data' ? <Table2 size={16} /> : <Presentation size={16} />}
          <div>
            <strong>{surface === 'docs' ? 'Strategy document' : surface === 'data' ? 'Revenue model' : 'Board narrative'}</strong>
            <span>{connectedCount} connected objects</span>
          </div>
        </div>
      </div>

      <div className="context-section">
        <span className="context-label">Connected object</span>
        <div className="object-detail">
          <div className="object-detail-title"><Database size={15} /><strong>{revenue.label}</strong></div>
          <div className="object-value">{formatMetric(revenue)}</div>
          <dl>
            <div><dt>Definition</dt><dd>{revenue.formula ?? 'Manual metric'}</dd></div>
            <div><dt>Source</dt><dd>{revenue.source}</dd></div>
            <div><dt>Updated</dt><dd>{revenue.updatedAt}</dd></div>
            <div><dt>Used in</dt><dd>Strategy · Performance scene</dd></div>
          </dl>
        </div>
      </div>

      <div className="context-section">
        <span className="context-label">Semantic history</span>
        <div className="history-list">
          {transactions.length === 0 ? (
            <div className="history-empty">No structured transactions yet</div>
          ) : transactions.slice(-4).reverse().map((transaction) => {
            const preview = previewWorkspaceCommand(transaction.before, transaction.command)
            return (
              <div className="history-entry" key={transaction.id}>
                <span className="history-marker" />
                <div>
                  <strong>{transaction.summary}</strong>
                  <span>{preview.diffs.length} semantic change{preview.diffs.length === 1 ? '' : 's'} · {preview.impacts.length} downstream</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="context-section">
        <span className="context-label">Activity</span>
        <div className="activity-row">
          <Clock3 size={14} />
          <div>
            <strong>{latestEvent?.summary ?? 'No semantic changes yet'}</strong>
            <span>
              {latestEvent
                ? `${latestEvent.affectedObjectIds.length} downstream objects · ${latestEvent.changedAt}`
                : 'Edits to shared objects will appear here'}
            </span>
          </div>
        </div>
        <div className="activity-row"><CheckCircle2 size={14} /><div><strong>Dependency graph healthy</strong><span>No broken object references</span></div></div>
      </div>
    </aside>
  )
}
