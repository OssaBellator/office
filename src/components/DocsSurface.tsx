import { useEffect, useState } from 'react'
import { ArrowUpRight, CheckCircle2, Circle, Link2, Sparkles } from 'lucide-react'
import { formatMetric, metricDelta, type WorkspaceState } from '../model'

export function DocsSurface({
  workspace,
  commitDocument,
  onOpenData,
}: {
  workspace: WorkspaceState
  commitDocument: (field: keyof WorkspaceState['document'], value: string) => void
  onOpenData: () => void
}) {
  const [draft, setDraft] = useState(workspace.document)
  const revenue = workspace.metrics.find((metric) => metric.id === 'revenue')!
  const growth = workspace.metrics.find((metric) => metric.id === 'growth')!
  const decision = workspace.decisions[0]
  const fastest = workspace.regions.reduce((best, row) => row.growth > best.growth ? row : best)

  useEffect(() => {
    setDraft(workspace.document)
  }, [workspace.document.eyebrow, workspace.document.title, workspace.document.summary, workspace.document.body])

  const edit = (field: keyof WorkspaceState['document'], value: string) => {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  const commit = (field: keyof WorkspaceState['document']) => {
    if (draft[field] !== workspace.document[field]) commitDocument(field, draft[field])
  }

  return (
    <div className="document-wrap">
      <article className="document-page">
        <input className="doc-eyebrow" value={draft.eyebrow} onChange={(event) => edit('eyebrow', event.target.value)} onBlur={() => commit('eyebrow')} aria-label="Document status" />
        <textarea className="doc-title" value={draft.title} onChange={(event) => edit('title', event.target.value)} onBlur={() => commit('title')} aria-label="Document title" rows={2} />
        <textarea className="doc-summary" value={draft.summary} onChange={(event) => edit('summary', event.target.value)} onBlur={() => commit('summary')} aria-label="Executive summary" rows={3} />

        <div className="doc-divider" />
        <h2>The opportunity</h2>
        <textarea className="doc-body" value={draft.body} onChange={(event) => edit('body', event.target.value)} onBlur={() => commit('body')} aria-label="Document body" rows={7} />

        <div className="claim-card">
          <div className="claim-header"><span>SUPPORTED CLAIM</span><span><CheckCircle2 size={12} /> Live evidence</span></div>
          <strong>{fastest.region} is the fastest-growing region at {fastest.growth}%.</strong>
          <div className="claim-source"><Link2 size={12} /> Finance model · Regions.Growth · {fastest.region}</div>
        </div>

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
              <small className={metricDelta(metric) >= 0 ? 'positive' : 'negative'}>{metricDelta(metric) >= 0 ? '↑' : '↓'} {Math.abs(metricDelta(metric)).toFixed(1)} vs prior</small>
            </div>
          ))}
        </div>

        <div className="insight-callout">
          <Sparkles size={17} />
          <div>
            <strong>Frame insight</strong>
            <p>Revenue is now {formatMetric(revenue)} with {formatMetric(growth)} YoY growth. {fastest.region} is the fastest-growing region, which supports the expansion recommendation but deserves a margin check before approval.</p>
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
