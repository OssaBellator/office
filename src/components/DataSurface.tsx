import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, BarChart3, Check, ChevronRight, Database, FileText, Link2, MoreHorizontal, Presentation, Sparkles, Table2 } from 'lucide-react'
import {
  formatMetric,
  getObjectLineage,
  regionsSchema,
  type RegionRow,
  type WorkspaceObject,
  type WorkspaceState,
} from '../model'
import { validateMetricFormula } from '../semanticCommands'

type DataMode = 'grid' | 'model' | 'analyse'

export function DataSurface({
  workspace,
  updateRegion,
  updateMetricFormula,
}: {
  workspace: WorkspaceState
  updateRegion: (id: string, field: keyof RegionRow, value: string | number) => void
  updateMetricFormula: (metricId: string, formula: string) => void
}) {
  const [mode, setMode] = useState<DataMode>('grid')

  return (
    <div className="data-view">
      <div className="surface-heading">
        <div>
          <span className="surface-kicker">Financial model</span>
          <h1>Revenue model</h1>
          <p>Typed data, semantic formulas, and explicit downstream dependencies.</p>
        </div>
        <div className="model-health"><span className="status-dot" /> {workspace.graph.edges.length} live dependencies</div>
      </div>

      <div className="data-tabs">
        <button className={mode === 'grid' ? 'active' : ''} onClick={() => setMode('grid')}><Table2 size={14} /> Grid</button>
        <button className={mode === 'model' ? 'active' : ''} onClick={() => setMode('model')}><Database size={14} /> Model</button>
        <button className={mode === 'analyse' ? 'active' : ''} onClick={() => setMode('analyse')}><BarChart3 size={14} /> Analyse</button>
      </div>

      {mode === 'grid' && <GridView workspace={workspace} updateRegion={updateRegion} />}
      {mode === 'model' && <ModelView workspace={workspace} updateMetricFormula={updateMetricFormula} />}
      {mode === 'analyse' && <AnalysisView workspace={workspace} />}
    </div>
  )
}

function GridView({ workspace, updateRegion }: { workspace: WorkspaceState; updateRegion: (id: string, field: keyof RegionRow, value: string | number) => void }) {
  const total = workspace.regions.reduce((sum, row) => sum + row.revenue, 0)
  return (
    <div className="sheet-card">
      <div className="sheet-toolbar"><div><span className="status-dot" /> Regions</div><span>{workspace.regions.length} rows · {regionsSchema.fields.length} typed fields</span></div>
      <div className="sheet-scroll">
        <table>
          <thead><tr><th><span>A</span> Region <small>Text</small></th><th><span>B</span> Revenue <small>USD · millions</small></th><th><span>C</span> Growth <small>Percent</small></th><th><span>D</span> Margin <small>Percent</small></th></tr></thead>
          <tbody>
            {workspace.regions.map((row) => <RegionGridRow row={row} updateRegion={updateRegion} key={row.id} />)}
            <tr className="total-row"><td>Total</td><td>${total.toFixed(1)}M</td><td>—</td><td>—</td></tr>
          </tbody>
        </table>
      </div>
      <div className="formula-footer"><span>Computed metric</span><code>{workspace.metrics.find((metric) => metric.id === 'revenue')?.formula}</code><span>→ {formatMetric(workspace.metrics.find((metric) => metric.id === 'revenue')!)}</span></div>
    </div>
  )
}

function RegionGridRow({ row, updateRegion }: { row: RegionRow; updateRegion: (id: string, field: keyof RegionRow, value: string | number) => void }) {
  const [draft, setDraft] = useState({ region: row.region, revenue: String(row.revenue), growth: String(row.growth), margin: String(row.margin) })
  useEffect(() => setDraft({ region: row.region, revenue: String(row.revenue), growth: String(row.growth), margin: String(row.margin) }), [row.region, row.revenue, row.growth, row.margin])
  const commitText = () => { if (draft.region !== row.region) updateRegion(row.id, 'region', draft.region) }
  const commitNumber = (field: 'revenue' | 'growth' | 'margin') => {
    const value = Number(draft[field])
    if (!Number.isFinite(value)) { setDraft((current) => ({ ...current, [field]: String(row[field]) })); return }
    if (value !== row[field]) updateRegion(row.id, field, value)
  }
  return (
    <tr>
      <td><input value={draft.region} onChange={(event) => setDraft((current) => ({ ...current, region: event.target.value }))} onBlur={commitText} /></td>
      <td><div className="number-input"><span>$</span><input type="number" step="0.1" value={draft.revenue} onChange={(event) => setDraft((current) => ({ ...current, revenue: event.target.value }))} onBlur={() => commitNumber('revenue')} /><span>M</span></div></td>
      <td><div className="number-input"><input type="number" step="1" value={draft.growth} onChange={(event) => setDraft((current) => ({ ...current, growth: event.target.value }))} onBlur={() => commitNumber('growth')} /><span>%</span></div></td>
      <td><div className="number-input"><input type="number" step="0.1" value={draft.margin} onChange={(event) => setDraft((current) => ({ ...current, margin: event.target.value }))} onBlur={() => commitNumber('margin')} /><span>%</span></div></td>
    </tr>
  )
}

function ModelView({ workspace, updateMetricFormula }: { workspace: WorkspaceState; updateMetricFormula: (metricId: string, formula: string) => void }) {
  const revenue = workspace.metrics.find((metric) => metric.id === 'revenue')!
  const revenueLineage = getObjectLineage(workspace, 'metric:revenue')
  const decisionLineage = getObjectLineage(workspace, 'decision:launch')
  const [formulaDraft, setFormulaDraft] = useState(revenue.formula ?? '')
  useEffect(() => setFormulaDraft(revenue.formula ?? ''), [revenue.formula])
  const formulaState = useMemo(() => {
    if (!formulaDraft.trim()) return { error: 'A computed metric needs a formula.', value: null as number | null }
    try { return { error: null, value: validateMetricFormula(workspace, 'revenue', formulaDraft).value } }
    catch (error) { return { error: error instanceof Error ? error.message : 'Invalid formula', value: null } }
  }, [formulaDraft, workspace])
  const changed = formulaDraft.trim() !== (revenue.formula ?? '')

  return (
    <div className="model-view">
      <div className="model-summary-grid">
        <section className="schema-card">
          <span className="model-label">TABLE SCHEMA</span>
          <div className="schema-title"><Table2 size={15} /><strong>{regionsSchema.label}</strong></div>
          {regionsSchema.fields.map((field) => <div className="schema-field" key={field.id}><span>{field.label}</span><small>{field.type}</small></div>)}
        </section>
        <section className="formula-card">
          <span className="model-label">COMPUTED METRIC</span>
          <strong>{revenue.label}</strong>
          <div className="formula-value">{formatMetric(revenue)}</div>
          <div className={formulaState.error ? 'formula-editor invalid' : 'formula-editor'}>
            <input value={formulaDraft} onChange={(event) => setFormulaDraft(event.target.value)} spellCheck={false} aria-label="Revenue semantic formula" />
            <button disabled={!changed || !!formulaState.error} onClick={() => updateMetricFormula('revenue', formulaDraft.trim())}><Check size={13} /> Apply</button>
          </div>
          {formulaState.error ? <div className="formula-validation error"><AlertCircle size={12} /> {formulaState.error}</div> : <div className="formula-validation"><Check size={12} /> Preview → ${formulaState.value?.toFixed(2)}M</div>}
          <p>Meaning-based references replace fragile cell ranges. Formula edits become reversible semantic revisions and refresh lineage automatically.</p>
        </section>
      </div>

      <DependencyChain title="Revenue lineage" subtitle="Regional rows derive one metric that renders into multiple work surfaces." upstream={revenueLineage.upstream} center={{ id: 'metric:revenue', kind: 'metric', label: revenue.label, surfaces: ['data', 'docs', 'present'] }} downstream={revenueLineage.downstream} />
      <DependencyChain title="Decision lineage" subtitle="Performance evidence supports a decision object that remains shared across Docs and Present." upstream={decisionLineage.upstream} center={decisionLineage.object} downstream={decisionLineage.downstream} />
    </div>
  )
}

function DependencyChain({ title, subtitle, upstream, center, downstream }: { title: string; subtitle: string; upstream: WorkspaceObject[]; center: WorkspaceObject; downstream: WorkspaceObject[] }) {
  return <section className="dependency-section"><div className="dependency-heading"><div><strong>{title}</strong><span>{subtitle}</span></div><span>{upstream.length} upstream · {downstream.length} downstream</span></div><div className="dependency-chain"><div className="dependency-lane"><span className="model-label">UPSTREAM</span><div className="node-stack">{upstream.map((object) => <ObjectNode object={object} key={object.id} />)}</div></div><ChevronRight className="dependency-arrow" size={18} /><div className="dependency-lane center-lane"><span className="model-label">SHARED OBJECT</span><ObjectNode object={center} emphasized /></div><ChevronRight className="dependency-arrow" size={18} /><div className="dependency-lane"><span className="model-label">DOWNSTREAM</span><div className="node-stack">{downstream.map((object) => <ObjectNode object={object} key={object.id} />)}</div></div></div></section>
}
function ObjectNode({ object, emphasized = false }: { object: WorkspaceObject; emphasized?: boolean }) { const Icon = object.kind === 'document' ? FileText : object.kind === 'scene' ? Presentation : object.kind === 'region' ? Table2 : object.kind === 'decision' ? Link2 : Database; return <div className={emphasized ? 'model-node emphasized' : 'model-node'}><Icon size={14} /><div><strong>{object.label}</strong><span>{object.kind} · {object.surfaces.join(' / ')}</span></div></div> }
function AnalysisView({ workspace }: { workspace: WorkspaceState }) {
  const total = workspace.regions.reduce((sum, row) => sum + row.revenue, 0), maxRevenue = Math.max(...workspace.regions.map((row) => row.revenue)), fastest = workspace.regions.reduce((best, row) => row.growth > best.growth ? row : best), averageMargin = workspace.regions.reduce((sum, row) => sum + row.margin, 0) / workspace.regions.length
  return <div className="analysis-grid analysis-mode"><section className="analysis-card"><div className="card-heading"><div><span>Revenue by region</span><strong>${total.toFixed(1)}M</strong></div><MoreHorizontal size={16} /></div><div className="bar-list">{workspace.regions.map((row) => <div className="bar-row" key={row.id}><span>{row.region}</span><div className="bar-track"><div className="bar-fill" style={{ width: `${(row.revenue / maxRevenue) * 100}%` }} /></div><strong>${row.revenue.toFixed(1)}M</strong></div>)}</div></section><section className="analysis-card insight-panel"><div className="insight-icon"><Sparkles size={18} /></div><span>Analysis</span><h3>{fastest.region} combines the highest growth with {fastest.margin < averageMargin ? 'below-average' : 'above-average'} margin.</h3><p>{fastest.region} is growing {fastest.growth}% with {fastest.margin.toFixed(1)}% margin versus a {averageMargin.toFixed(1)}% regional average. The recommendation should preserve that tradeoff explicitly.</p><button className="text-button">Show semantic calculation <ChevronRight size={13} /></button></section></div>
}
