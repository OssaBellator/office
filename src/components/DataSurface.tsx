import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, BarChart3, Check, ChevronRight, Database, FileText, Link2, MoreHorizontal, Presentation, Sparkles, Table2 } from 'lucide-react'
import {
  formatMetric,
  getObjectLineage,
  planSchema,
  regionsSchema,
  type PlanRow,
  type RegionRow,
  type WorkspaceObject,
  type WorkspaceState,
} from '../model'
import { validateMetricFormula } from '../semanticCommands'

type DataMode = 'grid' | 'model' | 'analyse'
type GridTable = 'actual' | 'plan'

export function DataSurface({
  workspace,
  updateRegion,
  updatePlan,
  updateMetricFormula,
}: {
  workspace: WorkspaceState
  updateRegion: (id: string, field: keyof RegionRow, value: string | number) => void
  updatePlan: (id: string, field: keyof PlanRow, value: string | number) => void
  updateMetricFormula: (metricId: string, formula: string) => void
}) {
  const [mode, setMode] = useState<DataMode>('grid')

  return (
    <div className="data-view">
      <div className="surface-heading">
        <div>
          <span className="surface-kicker">Financial model</span>
          <h1>Revenue model</h1>
          <p>Actuals and plan are separate typed tables connected through semantic metrics and lineage.</p>
        </div>
        <div className="model-health"><span className="status-dot" /> {workspace.graph.edges.length} live dependencies</div>
      </div>

      <div className="data-tabs">
        <button className={mode === 'grid' ? 'active' : ''} onClick={() => setMode('grid')}><Table2 size={14} /> Grid</button>
        <button className={mode === 'model' ? 'active' : ''} onClick={() => setMode('model')}><Database size={14} /> Model</button>
        <button className={mode === 'analyse' ? 'active' : ''} onClick={() => setMode('analyse')}><BarChart3 size={14} /> Analyse</button>
      </div>

      {mode === 'grid' && <GridView workspace={workspace} updateRegion={updateRegion} updatePlan={updatePlan} />}
      {mode === 'model' && <ModelView workspace={workspace} updateMetricFormula={updateMetricFormula} />}
      {mode === 'analyse' && <AnalysisView workspace={workspace} />}
    </div>
  )
}

function GridView({ workspace, updateRegion, updatePlan }: { workspace: WorkspaceState; updateRegion: (id: string, field: keyof RegionRow, value: string | number) => void; updatePlan: (id: string, field: keyof PlanRow, value: string | number) => void }) {
  const [table, setTable] = useState<GridTable>('actual')
  const actualMetric = workspace.metrics.find((metric) => metric.id === 'revenue')!
  const planMetric = workspace.metrics.find((metric) => metric.id === 'planRevenue')!
  return (
    <div className="sheet-stack">
      <div className="sheet-switcher">
        <button className={table === 'actual' ? 'active' : ''} onClick={() => setTable('actual')}><span className="status-dot" /> Actuals <small>{formatMetric(actualMetric)}</small></button>
        <button className={table === 'plan' ? 'active' : ''} onClick={() => setTable('plan')}><span className="plan-dot" /> Plan <small>{formatMetric(planMetric)}</small></button>
      </div>
      {table === 'actual' ? <ActualSheet workspace={workspace} updateRegion={updateRegion} /> : <PlanSheet workspace={workspace} updatePlan={updatePlan} />}
    </div>
  )
}

function ActualSheet({ workspace, updateRegion }: { workspace: WorkspaceState; updateRegion: (id: string, field: keyof RegionRow, value: string | number) => void }) {
  const total = workspace.regions.reduce((sum, row) => sum + row.revenue, 0)
  return <div className="sheet-card"><div className="sheet-toolbar"><div><span className="status-dot" /> Regions</div><span>{workspace.regions.length} rows · {regionsSchema.fields.length} typed fields</span></div><div className="sheet-scroll"><table><thead><tr><th><span>A</span> Region <small>Text</small></th><th><span>B</span> Revenue <small>USD · millions</small></th><th><span>C</span> Growth <small>Percent</small></th><th><span>D</span> Margin <small>Percent</small></th></tr></thead><tbody>{workspace.regions.map((row) => <RegionGridRow row={row} updateRegion={updateRegion} key={row.id} />)}<tr className="total-row"><td>Total</td><td>${total.toFixed(1)}M</td><td>—</td><td>—</td></tr></tbody></table></div><div className="formula-footer"><span>Computed metric</span><code>{workspace.metrics.find((metric) => metric.id === 'revenue')?.formula}</code><span>→ {formatMetric(workspace.metrics.find((metric) => metric.id === 'revenue')!)}</span></div></div>
}

function PlanSheet({ workspace, updatePlan }: { workspace: WorkspaceState; updatePlan: (id: string, field: keyof PlanRow, value: string | number) => void }) {
  const total = workspace.plans.reduce((sum, row) => sum + row.revenue, 0)
  return <div className="sheet-card"><div className="sheet-toolbar"><div><span className="plan-dot" /> Plan</div><span>{workspace.plans.length} rows · {planSchema.fields.length} typed fields</span></div><div className="sheet-scroll"><table className="plan-table"><thead><tr><th><span>A</span> Region <small>Text</small></th><th><span>B</span> Revenue plan <small>USD · millions</small></th></tr></thead><tbody>{workspace.plans.map((row) => <PlanGridRow row={row} updatePlan={updatePlan} key={row.id} />)}<tr className="total-row"><td>Total plan</td><td>${total.toFixed(1)}M</td></tr></tbody></table></div><div className="formula-footer"><span>Computed metric</span><code>{workspace.metrics.find((metric) => metric.id === 'planRevenue')?.formula}</code><span>→ {formatMetric(workspace.metrics.find((metric) => metric.id === 'planRevenue')!)}</span></div></div>
}

function RegionGridRow({ row, updateRegion }: { row: RegionRow; updateRegion: (id: string, field: keyof RegionRow, value: string | number) => void }) {
  const [draft, setDraft] = useState({ region: row.region, revenue: String(row.revenue), growth: String(row.growth), margin: String(row.margin) })
  useEffect(() => setDraft({ region: row.region, revenue: String(row.revenue), growth: String(row.growth), margin: String(row.margin) }), [row.region, row.revenue, row.growth, row.margin])
  const commitText = () => { if (draft.region !== row.region) updateRegion(row.id, 'region', draft.region) }
  const commitNumber = (field: 'revenue' | 'growth' | 'margin') => { const value = Number(draft[field]); if (!Number.isFinite(value)) { setDraft((current) => ({ ...current, [field]: String(row[field]) })); return }; if (value !== row[field]) updateRegion(row.id, field, value) }
  return <tr><td><input value={draft.region} onChange={(event) => setDraft((current) => ({ ...current, region: event.target.value }))} onBlur={commitText} /></td><td><div className="number-input"><span>$</span><input type="number" step="0.1" value={draft.revenue} onChange={(event) => setDraft((current) => ({ ...current, revenue: event.target.value }))} onBlur={() => commitNumber('revenue')} /><span>M</span></div></td><td><div className="number-input"><input type="number" step="1" value={draft.growth} onChange={(event) => setDraft((current) => ({ ...current, growth: event.target.value }))} onBlur={() => commitNumber('growth')} /><span>%</span></div></td><td><div className="number-input"><input type="number" step="0.1" value={draft.margin} onChange={(event) => setDraft((current) => ({ ...current, margin: event.target.value }))} onBlur={() => commitNumber('margin')} /><span>%</span></div></td></tr>
}

function PlanGridRow({ row, updatePlan }: { row: PlanRow; updatePlan: (id: string, field: keyof PlanRow, value: string | number) => void }) {
  const [draft, setDraft] = useState({ region: row.region, revenue: String(row.revenue) })
  useEffect(() => setDraft({ region: row.region, revenue: String(row.revenue) }), [row.region, row.revenue])
  const commitText = () => { if (draft.region !== row.region) updatePlan(row.id, 'region', draft.region) }
  const commitRevenue = () => { const value = Number(draft.revenue); if (!Number.isFinite(value)) { setDraft((current) => ({ ...current, revenue: String(row.revenue) })); return }; if (value !== row.revenue) updatePlan(row.id, 'revenue', value) }
  return <tr><td><input value={draft.region} onChange={(event) => setDraft((current) => ({ ...current, region: event.target.value }))} onBlur={commitText} /></td><td><div className="number-input"><span>$</span><input type="number" step="0.1" value={draft.revenue} onChange={(event) => setDraft((current) => ({ ...current, revenue: event.target.value }))} onBlur={commitRevenue} /><span>M</span></div></td></tr>
}

function ModelView({ workspace, updateMetricFormula }: { workspace: WorkspaceState; updateMetricFormula: (metricId: string, formula: string) => void }) {
  const revenue = workspace.metrics.find((metric) => metric.id === 'revenue')!
  const planRevenue = workspace.metrics.find((metric) => metric.id === 'planRevenue')!
  const revenueLineage = getObjectLineage(workspace, 'metric:revenue')
  const planLineage = getObjectLineage(workspace, 'metric:planRevenue')
  const decisionLineage = getObjectLineage(workspace, 'decision:launch')
  return (
    <div className="model-view">
      <div className="model-summary-grid">
        <section className="schema-card"><span className="model-label">TABLE SCHEMAS</span><SchemaDefinition schema={regionsSchema} /><SchemaDefinition schema={planSchema} /></section>
        <section className="formula-card metric-editor-stack"><span className="model-label">COMPUTED METRICS</span><MetricFormulaEditor workspace={workspace} metricId="revenue" updateMetricFormula={updateMetricFormula} /><MetricFormulaEditor workspace={workspace} metricId="planRevenue" updateMetricFormula={updateMetricFormula} /></section>
      </div>
      <DependencyChain title="Actual revenue lineage" subtitle="Regional actuals derive one shared metric used throughout the workspace." upstream={revenueLineage.upstream} center={revenueLineage.object} downstream={revenueLineage.downstream} />
      <DependencyChain title="Revenue plan lineage" subtitle="Plan rows remain distinct from actuals while producing a comparable shared metric." upstream={planLineage.upstream} center={planLineage.object} downstream={planLineage.downstream} />
      <DependencyChain title="Decision lineage" subtitle="Performance evidence supports a decision object that remains shared across Docs and Present." upstream={decisionLineage.upstream} center={decisionLineage.object} downstream={decisionLineage.downstream} />
    </div>
  )
}

function SchemaDefinition({ schema }: { schema: typeof regionsSchema | typeof planSchema }) {
  return <div className="schema-definition"><div className="schema-title"><Table2 size={15} /><strong>{schema.label}</strong></div>{schema.fields.map((field) => <div className="schema-field" key={field.id}><span>{field.label}</span><small>{field.type}</small></div>)}</div>
}

function MetricFormulaEditor({ workspace, metricId, updateMetricFormula }: { workspace: WorkspaceState; metricId: string; updateMetricFormula: (metricId: string, formula: string) => void }) {
  const metric = workspace.metrics.find((candidate) => candidate.id === metricId)!
  const [formulaDraft, setFormulaDraft] = useState(metric.formula ?? '')
  useEffect(() => setFormulaDraft(metric.formula ?? ''), [metric.formula])
  const formulaState = useMemo(() => {
    if (!formulaDraft.trim()) return { error: 'A computed metric needs a formula.', value: null as number | null }
    try { return { error: null, value: validateMetricFormula(workspace, metricId, formulaDraft).value } }
    catch (error) { return { error: error instanceof Error ? error.message : 'Invalid formula', value: null } }
  }, [formulaDraft, metricId, workspace])
  const changed = formulaDraft.trim() !== (metric.formula ?? '')
  return <div className="metric-formula-editor"><div className="metric-formula-heading"><strong>{metric.label}</strong><span>{formatMetric(metric)}</span></div><div className={formulaState.error ? 'formula-editor invalid' : 'formula-editor'}><input value={formulaDraft} onChange={(event) => setFormulaDraft(event.target.value)} spellCheck={false} aria-label={`${metric.label} semantic formula`} /><button disabled={!changed || !!formulaState.error} onClick={() => updateMetricFormula(metricId, formulaDraft.trim())}><Check size={13} /> Apply</button></div>{formulaState.error ? <div className="formula-validation error"><AlertCircle size={12} /> {formulaState.error}</div> : <div className="formula-validation"><Check size={12} /> Preview → ${formulaState.value?.toFixed(2)}M</div>}</div>
}

function DependencyChain({ title, subtitle, upstream, center, downstream }: { title: string; subtitle: string; upstream: WorkspaceObject[]; center: WorkspaceObject; downstream: WorkspaceObject[] }) {
  return <section className="dependency-section"><div className="dependency-heading"><div><strong>{title}</strong><span>{subtitle}</span></div><span>{upstream.length} upstream · {downstream.length} downstream</span></div><div className="dependency-chain"><div className="dependency-lane"><span className="model-label">UPSTREAM</span><div className="node-stack">{upstream.map((object) => <ObjectNode object={object} key={object.id} />)}</div></div><ChevronRight className="dependency-arrow" size={18} /><div className="dependency-lane center-lane"><span className="model-label">SHARED OBJECT</span><ObjectNode object={center} emphasized /></div><ChevronRight className="dependency-arrow" size={18} /><div className="dependency-lane"><span className="model-label">DOWNSTREAM</span><div className="node-stack">{downstream.map((object) => <ObjectNode object={object} key={object.id} />)}</div></div></div></section>
}
function ObjectNode({ object, emphasized = false }: { object: WorkspaceObject; emphasized?: boolean }) { const Icon = object.kind === 'document' ? FileText : object.kind === 'scene' ? Presentation : object.kind === 'region' || object.kind === 'plan' ? Table2 : object.kind === 'decision' ? Link2 : Database; return <div className={emphasized ? 'model-node emphasized' : 'model-node'}><Icon size={14} /><div><strong>{object.label}</strong><span>{object.kind} · {object.surfaces.join(' / ')}</span></div></div> }

function AnalysisView({ workspace }: { workspace: WorkspaceState }) {
  const total = workspace.regions.reduce((sum, row) => sum + row.revenue, 0)
  const planTotal = workspace.plans.reduce((sum, row) => sum + row.revenue, 0)
  const maxRevenue = Math.max(...workspace.regions.map((row) => row.revenue), ...workspace.plans.map((row) => row.revenue))
  const fastest = workspace.regions.reduce((best, row) => row.growth > best.growth ? row : best)
  const averageMargin = workspace.regions.reduce((sum, row) => sum + row.margin, 0) / workspace.regions.length
  const variance = total - planTotal
  return <div className="analysis-grid analysis-mode"><section className="analysis-card"><div className="card-heading"><div><span>Actual vs plan</span><strong>${total.toFixed(1)}M <small className={variance >= 0 ? 'positive' : 'negative'}>{variance >= 0 ? '+' : ''}${variance.toFixed(1)}M</small></strong></div><MoreHorizontal size={16} /></div><div className="comparison-list">{workspace.regions.map((row) => { const plan = workspace.plans.find((item) => item.id === row.id)?.revenue ?? 0; const rowVariance = row.revenue - plan; return <div className="comparison-row" key={row.id}><span>{row.region}</span><div><div className="comparison-bar actual" style={{ width: `${(row.revenue / maxRevenue) * 100}%` }} /><div className="comparison-bar plan" style={{ width: `${(plan / maxRevenue) * 100}%` }} /></div><strong className={rowVariance >= 0 ? 'positive' : 'negative'}>{rowVariance >= 0 ? '+' : ''}{rowVariance.toFixed(1)}</strong></div> })}</div><div className="comparison-legend"><span><i className="actual" /> Actual</span><span><i className="plan" /> Plan</span></div></section><section className="analysis-card insight-panel"><div className="insight-icon"><Sparkles size={18} /></div><span>Analysis</span><h3>Revenue is ${Math.abs(variance).toFixed(1)}M {variance >= 0 ? 'above' : 'below'} plan while {fastest.region} remains the strongest growth signal.</h3><p>{fastest.region} is growing {fastest.growth}% with {fastest.margin.toFixed(1)}% margin versus a {averageMargin.toFixed(1)}% regional average. Actual-vs-plan variance is now a separate modeling concern from the growth thesis.</p><button className="text-button">Show semantic calculation <ChevronRight size={13} /></button></section></div>
}
