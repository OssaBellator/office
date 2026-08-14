import { ArrowUpRight, CheckCircle2, Circle, Link2, Sparkles } from 'lucide-react'
import { formatMetric, metricDelta, type WorkspaceState } from '../model'

export function DocsSurface({
  workspace,
  updateDocument,
  onOpenData,
}: {
  workspace: WorkspaceState
  updateDocument: (field: keyof WorkspaceState['document'], value: string) => void
  onOpenData: () => void
}) {
  const revenue = workspace.metrics.find((metric) => metric.id === 'revenue')!
  const growth = workspace.metrics.find((metric) => metric.id === 'growth')!
  const decision = workspace.decisions[0]

  return (
    <div className="document-wrap">
      <article className="document-page">
        <input
          className="doc-eyebrow"
          value={workspace.document.eyebrow}
          onChange={(event) => updateDocument('eyebrow', event.target.value)}
          aria-label="Document status"
        />
        <textarea
          className="doc-title"
          value={workspace.document.title}
          onChange={(event) => updateDocument('title', event.target.value)}
          aria-label="Document title"
          rows={2}
        />
        <textarea
          className="doc-summary"
          value={workspace.document.summary}
          onChange={(event) => updateDocument('summary', event.target.value)}
          aria-label="Executive summary"
          rows={3}
        />

        <div className="doc-divider" />
        <h2>The opportunity</h2>
        <textarea
          className="doc-body"
          value={workspace.document.body}
          onChange={(event) => updateDocument('body', event.target.value)}
          aria-label="Document body"
          rows={7}
        />

        <div className="live-object-header">
          <div>
            <span className="object-kicker"><Link2 size={12} /> Live from financial model</span>
            <h2>Business snapshot</h2>
          </div>
          <button className="text-button" onClick={onOpenData}>Open model <ArrowUpRight size={13} /></button>
        </div>

        <div className="metric-grid">
          {workspace.metrics.map((metric) => (
            <div className="metric-card" key={metric.id}>
              <span>{metric.label}</span>
              <strong>{formatMetric(metric)}</strong>
              <small className={metricDelta(metric) >= 0 ? 'positive' : 'negative'}>
                {metricDelta(metric) >= 0 ? '↑' : '↓'} {Math.abs(metricDelta(metric)).toFixed(1)} vs prior
              </small>
            </div>
          ))}
        </div>

        <div className="insight-callout">
          <Sparkles size={17} />
          <div>
            <strong>Frame insight</strong>
            <p>
              Revenue is now {formatMetric(revenue)} with {formatMetric(growth)} YoY growth. APAC is the fastest-growing
              region, which supports the expansion recommendation but deserves a margin check before approval.
            </p>
          </div>
        </div>

        <h2>Decision</h2>
        <div className="decision-card">
          {decision.status === 'approved' ? <CheckCircle2 size={19} /> : <Circle size={19} />}
          <div>
            <strong>{decision.title}</strong>
            <p>{decision.rationale}</p>
            <span>{decision.status === 'approved' ? 'Approved' : 'Pending approval'} · Owner: {decision.owner}</span>
          </div>
        </div>
      </article>
    </div>
  )
}
