import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, BarChart3, Check, ChevronRight, Database, FileText, Link2, Plus, Presentation, Sparkles, Table2, Trash2 } from 'lucide-react'
import {
  formatMetric,
  getObjectLineage,
  planSchema,
  regionsSchema,
  type Metric,
  type PlanRow,
  type RegionRow,
  type WorkspaceObject,
  type WorkspaceState,
} from '../model'
import { getEditableChart, type EditableChartKind } from '../chartModel'
import { getMetricFormulaSuggestions, getRelationshipReferenceSummary, listFormulaReferences } from '../formulaCatalog'
import { inspectAllRelationships } from '../relationshipDiagnostics'
import { previewVersionedCommand } from '../semanticPreview'
import { validateMetricFormula, type VersionedWorkspaceCommand } from '../semanticCommands'
import { REVENUE_ATTAINMENT_FORMULA } from '../workspaceKpis'
import { RelationshipChart } from './RelationshipChart'

type DataMode = 'grid' | 'model' | 'analyse'
type GridTable = 'actual' | 'plan'

export function DataSurface({ workspace, focusedObjectId, updateRegion, updatePlan, updateMetricFormula, updateChartKind, onSemanticCommand }: {
  workspace: WorkspaceState
  focusedObjectId?: string | null
  updateRegion: (id: string, field: keyof RegionRow, value: string | number) => void
  updatePlan: (id: string, field: keyof PlanRow, value: string | number) => void
  updateMetricFormula: (metricId: string, formula: string) => void
  updateChartKind: (chartId: string, kind: EditableChartKind) => void
  onSemanticCommand: (command: VersionedWorkspaceCommand) => void
}) {
  const [mode, setMode] = useState<DataMode>('grid')
  useEffect(() => {
    if (!focusedObjectId) return
    if (focusedObjectId.startsWith('region:') || focusedObjectId.startsWith('plan:')) setMode('grid')
    else if (focusedObjectId.startsWith('metric:') || focusedObjectId.startsWith('relationship:')) setMode('model')
    else if (focusedObjectId.startsWith('chart:')) setMode('analyse')
  }, [focusedObjectId])
  return <div className="data-view">
    <div className="surface-heading"><div><span className="surface-kicker">Financial model</span><h1>Revenue model</h1><p>Actuals and plan are separate typed tables connected through semantic metrics and lineage.</p></div><div className="model-health"><span className="status-dot" /> {workspace.graph.edges.length} live dependencies</div></div>
    <div className="data-tabs"><button className={mode === 'grid' ? 'active' : ''} onClick={() => setMode('grid')}><Table2 size={14} /> Grid</button><button className={mode === 'model' ? 'active' : ''} onClick={() => setMode('model')}><Database size={14} /> Model</button><button className={mode === 'analyse' ? 'active' : ''} onClick={() => setMode('analyse')}><BarChart3 size={14} /> Analyse</button></div>
    {mode === 'grid' && <GridView workspace={workspace} focusedObjectId={focusedObjectId} updateRegion={updateRegion} updatePlan={updatePlan} />}
    {mode === 'model' && <ModelView workspace={workspace} updateMetricFormula={updateMetricFormula} onSemanticCommand={onSemanticCommand} />}
    {mode === 'analyse' && <AnalysisView workspace={workspace} updateChartKind={updateChartKind} />}
  </div>
}

function GridView({ workspace, focusedObjectId, updateRegion, updatePlan }: { workspace: WorkspaceState; focusedObjectId?: string | null; updateRegion: (id: string, field: keyof RegionRow, value: string | number) => void; updatePlan: (id: string, field: keyof PlanRow, value: string | number) => void }) {
  const [table, setTable] = useState<GridTable>(focusedObjectId?.startsWith('plan:') ? 'plan' : 'actual')
  const actualMetric = workspace.metrics.find((metric) => metric.id === 'revenue')!
  const planMetric = workspace.metrics.find((metric) => metric.id === 'planRevenue')!
  useEffect(() => {
    if (focusedObjectId?.startsWith('region:')) setTable('actual')
    if (focusedObjectId?.startsWith('plan:')) setTable('plan')
  }, [focusedObjectId])
  return <div className="sheet-stack"><div className="sheet-switcher"><button className={table === 'actual' ? 'active' : ''} onClick={() => setTable('actual')}><span className="status-dot" /> Actuals <small>{formatMetric(actualMetric)}</small></button><button className={table === 'plan' ? 'active' : ''} onClick={() => setTable('plan')}><span className="plan-dot" /> Plan <small>{formatMetric(planMetric)}</small></button></div>{table === 'actual' ? <ActualSheet workspace={workspace} updateRegion={updateRegion} /> : <PlanSheet workspace={workspace} updatePlan={updatePlan} />}</div>
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
  return <tr data-frame-object={`region:${row.id}`}><td><input value={draft.region} onChange={(event) => setDraft((current) => ({ ...current, region: event.target.value }))} onBlur={commitText} /></td><td><div className="number-input"><span>$</span><input type="number" step="0.1" value={draft.revenue} onChange={(event) => setDraft((current) => ({ ...current, revenue: event.target.value }))} onBlur={() => commitNumber('revenue')} /><span>M</span></div></td><td><div className="number-input"><input type="number" step="1" value={draft.growth} onChange={(event) => setDraft((current) => ({ ...current, growth: event.target.value }))} onBlur={() => commitNumber('growth')} /><span>%</span></div></td><td><div className="number-input"><input type="number" step="0.1" value={draft.margin} onChange={(event) => setDraft((current) => ({ ...current, margin: event.target.value }))} onBlur={() => commitNumber('margin')} /><span>%</span></div></td></tr>
}

function PlanGridRow({ row, updatePlan }: { row: PlanRow; updatePlan: (id: string, field: keyof PlanRow, value: string | number) => void }) {
  const [draft, setDraft] = useState({ region: row.region, revenue: String(row.revenue) })
  useEffect(() => setDraft({ region: row.region, revenue: String(row.revenue) }), [row.region, row.revenue])
  const commitText = () => { if (draft.region !== row.region) updatePlan(row.id, 'region', draft.region) }
  const commitRevenue = () => { const value = Number(draft.revenue); if (!Number.isFinite(value)) { setDraft((current) => ({ ...current, revenue: String(row.revenue) })); return }; if (value !== row.revenue) updatePlan(row.id, 'revenue', value) }
  return <tr data-frame-object={`plan:${row.id}`}><td><input value={draft.region} onChange={(event) => setDraft((current) => ({ ...current, region: event.target.value }))} onBlur={commitText} /></td><td><div className="number-input"><span>$</span><input type="number" step="0.1" value={draft.revenue} onChange={(event) => setDraft((current) => ({ ...current, revenue: event.target.value }))} onBlur={commitRevenue} /><span>M</span></div></td></tr>
}

function ModelView({ workspace, updateMetricFormula, onSemanticCommand }: { workspace: WorkspaceState; updateMetricFormula: (metricId: string, formula: string) => void; onSemanticCommand: (command: VersionedWorkspaceCommand) => void }) {
  const revenueLineage = getObjectLineage(workspace, 'metric:revenue')
  const planLineage = getObjectLineage(workspace, 'metric:planRevenue')
  const chartLineage = getObjectLineage(workspace, 'chart:revenue-vs-plan')
  const decisionLineage = getObjectLineage(workspace, 'decision:launch')
  const relationship = workspace.relationships.find((item) => item.id === 'relationship:regions-plan')
  const relationshipReport = inspectAllRelationships(workspace).find((report) => report.relationship.id === relationship?.id)
  const computedMetrics = workspace.metrics.filter((metric) => Boolean(metric.formula))
  return <div className="model-view"><div className="model-summary-grid"><section className="schema-card"><span className="model-label">TABLE SCHEMAS</span><SchemaDefinition schema={regionsSchema} /><SchemaDefinition schema={planSchema} />{relationship && <div className="schema-definition" data-frame-object={relationship.id}><span className="model-label">RELATIONSHIP</span><div className="schema-title"><Link2 size={15} /><strong>{relationship.label}</strong></div><div className="schema-field"><span>{relationship.fromTable}.{relationship.fromField}</span><small>↔ {relationship.toTable}.{relationship.toField}</small></div>{relationshipReport && <div className="relationship-health"><div className="relationship-health-head"><strong>Integrity</strong><span className={relationshipReport.valid && relationshipReport.issues.length === 0 ? '' : 'warning'}>{relationshipReport.valid ? `${relationshipReport.matchedKeys.length} matched keys` : 'Needs attention'}</span></div>{relationshipReport.issues.length > 0 && <div className="relationship-issues">{relationshipReport.issues.map((issue) => <div className={`relationship-issue ${issue.severity}`} key={`${issue.kind}:${issue.keys.join('|')}`}>{issue.message}</div>)}</div>}</div>}</div>}</section><section className="formula-card metric-editor-stack"><div className="metric-registry-heading"><span className="model-label">COMPUTED METRICS · {computedMetrics.length}</span></div>{computedMetrics.map((metric) => <MetricFormulaEditor workspace={workspace} metricId={metric.id} updateMetricFormula={updateMetricFormula} onSemanticCommand={onSemanticCommand} key={metric.id} />)}<NewMetricBuilder workspace={workspace} onSemanticCommand={onSemanticCommand} /></section></div><FormulaReferenceBrowser workspace={workspace} /><DependencyChain title="Actual revenue lineage" subtitle="Regional actuals derive one shared metric used throughout the workspace." upstream={revenueLineage.upstream} center={revenueLineage.object} downstream={revenueLineage.downstream} /><DependencyChain title="Revenue plan lineage" subtitle="Plan rows remain distinct from actuals while producing a comparable shared metric." upstream={planLineage.upstream} center={planLineage.object} downstream={planLineage.downstream} /><DependencyChain title="Shared chart lineage" subtitle="One relationship-backed chart definition renders in both Analyse and Present." upstream={chartLineage.upstream} center={chartLineage.object} downstream={chartLineage.downstream} /><DependencyChain title="Decision lineage" subtitle="Performance evidence supports a decision object that remains shared across Docs and Present." upstream={decisionLineage.upstream} center={decisionLineage.object} downstream={decisionLineage.downstream} /></div>
}
function SchemaDefinition({ schema }: { schema: typeof regionsSchema | typeof planSchema }) { return <div className="schema-definition"><div className="schema-title"><Table2 size={15} /><strong>{schema.label}</strong></div>{schema.fields.map((field) => <div className="schema-field" key={field.id}><span>{field.label}</span><small>{field.type}</small></div>)}</div> }
function MetricFormulaEditor({ workspace, metricId, updateMetricFormula, onSemanticCommand }: { workspace: WorkspaceState; metricId: string; updateMetricFormula: (metricId: string, formula: string) => void; onSemanticCommand: (command: VersionedWorkspaceCommand) => void }) {
  const metric = workspace.metrics.find((candidate) => candidate.id === metricId)!
  const [formulaDraft, setFormulaDraft] = useState(metric.formula ?? '')
  useEffect(() => setFormulaDraft(metric.formula ?? ''), [metric.formula])
  const suggestions = useMemo(() => getMetricFormulaSuggestions(workspace, metricId).slice(0, 5), [workspace, metricId])
  const formulaState = useMemo(() => { if (!formulaDraft.trim()) return { error: 'A computed metric needs a formula.', value: null as number | null }; try { return { error: null, value: validateMetricFormula(workspace, metricId, formulaDraft).value } } catch (error) { return { error: error instanceof Error ? error.message : 'Invalid formula', value: null } } }, [formulaDraft, metricId, workspace])
  const changed = formulaDraft.trim() !== (metric.formula ?? '')
  const previewMetric = formulaState.value === null ? metric : { ...metric, value: formulaState.value }
  const consumers = [...new Set(workspace.graph.edges.filter((edge) => edge.from === `metric:${metricId}`).map((edge) => edge.to))]
  return <div className="metric-formula-editor" data-frame-object={`metric:${metricId}`}><div className="metric-formula-heading"><strong>{metric.label}</strong><div><span>{formatMetric(metric)}</span>{consumers.length === 0 && <button className="metric-remove-button" onClick={() => onSemanticCommand({ type:'metric.remove', metricId })} title={`Remove ${metric.label}`}><Trash2 size={12} /></button>}</div></div><div className={formulaState.error ? 'formula-editor invalid' : 'formula-editor'}><input value={formulaDraft} onChange={(event) => setFormulaDraft(event.target.value)} spellCheck={false} aria-label={`${metric.label} semantic formula`} /><button disabled={!changed || !!formulaState.error} onClick={() => updateMetricFormula(metricId, formulaDraft.trim())}><Check size={13} /> Apply</button></div>{formulaState.error ? <div className="formula-validation error"><AlertCircle size={12} /> {formulaState.error}</div> : <div className="formula-validation"><Check size={12} /> Preview → {formatMetric(previewMetric)}</div>}{suggestions.length > 0 && <div className="formula-suggestion-chips">{suggestions.map((suggestion) => <button key={suggestion.expression} onClick={() => setFormulaDraft(suggestion.expression)} title={suggestion.description}>{suggestion.label}</button>)}</div>}</div>
}
function metricId(workspace: WorkspaceState, label: string) {
  const stem = `custom-${label.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'metric'}`
  let candidate = stem, index = 2
  while (workspace.metrics.some((metric) => metric.id === candidate)) candidate = `${stem}-${index++}`
  return candidate
}
function defaultFormula(format: Metric['format']) { return format === 'currency' ? 'SUM(Regions.Revenue)' : format === 'percent' ? REVENUE_ATTAINMENT_FORMULA : 'COUNT(Regions.Region)' }
function NewMetricBuilder({ workspace, onSemanticCommand }: { workspace: WorkspaceState; onSemanticCommand: (command: VersionedWorkspaceCommand) => void }) {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [format, setFormat] = useState<Metric['format']>('currency')
  const [formula, setFormula] = useState(defaultFormula('currency'))
  const id = metricId(workspace, label)
  const metric: Metric = { id, label:label.trim() || 'New metric', value:0, previous:0, format, source:'Semantic model · User-defined metric', updatedAt:'just now', formula:formula.trim() }
  const preview = useMemo(() => {
    if (!open || !label.trim() || !formula.trim()) return { error:null as string | null, metric:null as Metric | null }
    try {
      const result = previewVersionedCommand(workspace, { type:'metric.create', metric })
      return { error:null, metric:result.workspace.metrics.find((candidate) => candidate.id === id) ?? null }
    } catch (error) { return { error:error instanceof Error ? error.message : 'Invalid metric', metric:null } }
  }, [workspace, open, label, format, formula, id])
  const reset = () => { setOpen(false); setLabel(''); setFormat('currency'); setFormula(defaultFormula('currency')) }
  if (!open) return <button className="new-metric-button" onClick={() => setOpen(true)}><Plus size={13} /> New computed metric</button>
  return <div className="new-metric-builder"><div className="new-metric-fields"><input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Metric name" aria-label="New metric name" /><select value={format} onChange={(event) => { const next=event.target.value as Metric['format'];setFormat(next);setFormula(defaultFormula(next)) }} aria-label="New metric format"><option value="currency">Currency</option><option value="percent">Percent</option><option value="number">Number</option></select></div><input className="new-metric-formula" value={formula} onChange={(event) => setFormula(event.target.value)} spellCheck={false} aria-label="New metric formula" />{preview.error ? <div className="formula-validation error"><AlertCircle size={12} /> {preview.error}</div> : preview.metric ? <div className="formula-validation"><Check size={12} /> Preview → {formatMetric(preview.metric)}</div> : <div className="formula-validation">Name the metric to validate its semantic formula.</div>}<div className="new-metric-actions"><button className="secondary-button" onClick={reset}>Cancel</button><button className="primary-button" disabled={!preview.metric || !!preview.error} onClick={() => { onSemanticCommand({ type:'metric.create', metric }); reset() }}><Plus size={12} /> Create metric</button></div></div>
}
function FormulaReferenceBrowser({ workspace }: { workspace: WorkspaceState }) {
  const references = listFormulaReferences()
  const relationships = getRelationshipReferenceSummary(workspace)
  return <section className="formula-reference-browser"><div className="dependency-heading"><div><strong>Semantic reference catalog</strong><span>Use meaning-based fields and explicit relationships instead of memorising cell coordinates.</span></div><span>{references.length} fields · {relationships.length} relationship{relationships.length === 1 ? '' : 's'}</span></div><div className="formula-reference-grid"><div><span className="model-label">FIELDS</span><div className="reference-token-list">{references.map((reference) => <button key={`${reference.tableId}.${reference.fieldId}`} title={`${reference.tableLabel} · ${reference.fieldLabel}`}><code>{reference.tableId}.{reference.fieldId}</code><small>{reference.type}</small></button>)}</div></div><div><span className="model-label">RELATIONSHIPS</span>{relationships.map((relationship) => <div className="relationship-reference" data-frame-object={relationship.id} key={relationship.id}><strong>{relationship.label}</strong><code>{relationship.expression}</code><small>{relationship.cardinality}</small></div>)}</div></div></section>
}
function DependencyChain({ title, subtitle, upstream, center, downstream }: { title: string; subtitle: string; upstream: WorkspaceObject[]; center: WorkspaceObject; downstream: WorkspaceObject[] }) { return <section className="dependency-section"><div className="dependency-heading"><div><strong>{title}</strong><span>{subtitle}</span></div><span>{upstream.length} upstream · {downstream.length} downstream</span></div><div className="dependency-chain"><div className="dependency-lane"><span className="model-label">UPSTREAM</span><div className="node-stack">{upstream.map((object) => <ObjectNode object={object} key={object.id} />)}</div></div><ChevronRight className="dependency-arrow" size={18} /><div className="dependency-lane center-lane"><span className="model-label">SHARED OBJECT</span><ObjectNode object={center} emphasized /></div><ChevronRight className="dependency-arrow" size={18} /><div className="dependency-lane"><span className="model-label">DOWNSTREAM</span><div className="node-stack">{downstream.map((object) => <ObjectNode object={object} key={object.id} />)}</div></div></div></section> }
function ObjectNode({ object, emphasized = false }: { object: WorkspaceObject; emphasized?: boolean }) { const Icon = object.kind === 'document' ? FileText : object.kind === 'scene' ? Presentation : object.kind === 'region' || object.kind === 'plan' ? Table2 : object.kind === 'decision' ? Link2 : object.kind === 'chart' ? BarChart3 : Database; return <div className={emphasized ? 'model-node emphasized' : 'model-node'} data-frame-object={object.id}><Icon size={14} /><div><strong>{object.label}</strong><span>{object.kind} · {object.surfaces.join(' / ')}</span></div></div> }

function AnalysisView({ workspace, updateChartKind }: { workspace: WorkspaceState; updateChartKind: (chartId: string, kind: EditableChartKind) => void }) {
  const total = workspace.regions.reduce((sum, row) => sum + row.revenue, 0)
  const fastest = workspace.regions.reduce((best, row) => row.growth > best.growth ? row : best)
  const averageMargin = workspace.regions.reduce((sum, row) => sum + row.margin, 0) / workspace.regions.length
  const variance = workspace.metrics.find((metric) => metric.id === 'variance')!.value
  const chart = getEditableChart(workspace, 'revenue-vs-plan')
  return <div className="analysis-grid analysis-mode"><section className="analysis-card shared-chart-card" data-frame-object={`chart:${chart.id}`}><div className="card-heading"><div><span>{chart.label}</span><strong>${total.toFixed(1)}M <small className={variance >= 0 ? 'positive' : 'negative'}>{variance >= 0 ? '+' : ''}${variance.toFixed(1)}M</small></strong></div><label className="chart-kind-control"><span>View</span><select value={chart.kind} onChange={(event) => updateChartKind(chart.id, event.target.value as EditableChartKind)} aria-label="Shared chart type"><option value="grouped-bar">Grouped bars</option><option value="line">Line</option></select></label></div><RelationshipChart workspace={workspace} chartId={chart.id} /></section><section className="analysis-card insight-panel"><div className="insight-icon"><Sparkles size={18} /></div><span>Analysis</span><h3>Revenue is ${Math.abs(variance).toFixed(1)}M {variance >= 0 ? 'above' : 'below'} plan while {fastest.region} remains the strongest growth signal.</h3><p>{fastest.region} is growing {fastest.growth}% with {fastest.margin.toFixed(1)}% margin versus a {averageMargin.toFixed(1)}% regional average. The comparison visual is one saved chart object shared with Present.</p><button className="text-button">Show semantic calculation <ChevronRight size={13} /></button></section></div>
}
