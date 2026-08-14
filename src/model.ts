import { evaluateSemanticFormula, type TableData, type TableSchema } from './formulas.ts'

export type Surface = 'docs' | 'data' | 'present'

export type ObjectKind = 'document' | 'region' | 'metric' | 'decision' | 'scene'

export type Metric = {
  id: string
  label: string
  value: number
  previous: number
  format: 'currency' | 'percent' | 'number'
  source: string
  updatedAt: string
}

export type RegionRow = {
  id: string
  region: string
  revenue: number
  growth: number
  margin: number
}

export type Decision = {
  id: string
  title: string
  status: 'approved' | 'pending'
  owner: string
  rationale: string
}

export type SourceRecord = {
  id: string
  label: string
  type: 'dataset' | 'research' | 'manual'
  locator: string
  status: 'live' | 'stale'
  updatedAt: string
}

export type WorkspaceObject = {
  id: string
  kind: ObjectKind
  label: string
  surfaces: Surface[]
}

export type DependencyRelation = 'derives' | 'renders' | 'supports' | 'decides'

export type DependencyEdge = {
  from: string
  to: string
  relation: DependencyRelation
  description: string
}

export type ChangeEvent = {
  id: string
  changedAt: string
  summary: string
  changedObjectIds: string[]
  affectedObjectIds: string[]
}

export type WorkspaceGraph = {
  objects: WorkspaceObject[]
  edges: DependencyEdge[]
}

export type WorkspaceState = {
  title: string
  document: {
    eyebrow: string
    title: string
    summary: string
    body: string
  }
  metrics: Metric[]
  regions: RegionRow[]
  decisions: Decision[]
  sources: SourceRecord[]
  graph: WorkspaceGraph
  history: ChangeEvent[]
}

export type WorkspaceImpact = WorkspaceObject & {
  reason: string
}

export type WorkspaceMutationResult = {
  workspace: WorkspaceState
  impacts: WorkspaceImpact[]
  event: ChangeEvent
}

function buildSeedGraph(): WorkspaceGraph {
  const objects: WorkspaceObject[] = [
    { id: 'document:strategy', kind: 'document', label: 'Strategy document', surfaces: ['docs'] },
    { id: 'metric:revenue', kind: 'metric', label: 'Q2 revenue', surfaces: ['docs', 'data', 'present'] },
    { id: 'metric:growth', kind: 'metric', label: 'YoY growth', surfaces: ['docs', 'data', 'present'] },
    { id: 'metric:margin', kind: 'metric', label: 'Gross margin', surfaces: ['docs', 'data'] },
    { id: 'decision:launch', kind: 'decision', label: 'APAC expansion decision', surfaces: ['docs', 'present'] },
    { id: 'scene:performance', kind: 'scene', label: 'Board narrative · Performance', surfaces: ['present'] },
    { id: 'scene:decision', kind: 'scene', label: 'Board narrative · Decision', surfaces: ['present'] },
    { id: 'region:na', kind: 'region', label: 'North America', surfaces: ['data'] },
    { id: 'region:eu', kind: 'region', label: 'Europe', surfaces: ['data'] },
    { id: 'region:apac', kind: 'region', label: 'APAC', surfaces: ['data'] },
    { id: 'region:latam', kind: 'region', label: 'Latin America', surfaces: ['data'] },
  ]

  const edges: DependencyEdge[] = [
    ...['na', 'eu', 'apac', 'latam'].map((region) => ({
      from: `region:${region}`,
      to: 'metric:revenue',
      relation: 'derives' as const,
      description: 'Regional revenue contributes to the Q2 revenue metric',
    })),
    { from: 'metric:revenue', to: 'document:strategy', relation: 'renders', description: 'Revenue is embedded in the strategy snapshot' },
    { from: 'metric:growth', to: 'document:strategy', relation: 'renders', description: 'Growth is embedded in the strategy snapshot' },
    { from: 'metric:revenue', to: 'scene:performance', relation: 'renders', description: 'Revenue drives the performance scene' },
    { from: 'metric:growth', to: 'scene:performance', relation: 'renders', description: 'Growth drives the performance scene' },
    { from: 'region:apac', to: 'decision:launch', relation: 'supports', description: 'APAC performance supports the expansion decision' },
    { from: 'decision:launch', to: 'document:strategy', relation: 'decides', description: 'Decision status is shown in the strategy' },
    { from: 'decision:launch', to: 'scene:decision', relation: 'renders', description: 'Decision status drives the decision scene' },
  ]

  return { objects, edges }
}

export const seedWorkspace: WorkspaceState = {
  title: 'FY27 Product Strategy',
  document: {
    eyebrow: 'Strategy brief · Draft',
    title: 'Build the operating layer for modern knowledge work',
    summary:
      'Frame treats documents, analysis, and presentations as three views over the same structured work — reducing handoffs, stale numbers, and duplicated reasoning.',
    body:
      'Our strongest opportunity is not to recreate the Office ribbon with an AI assistant attached. It is to make the underlying work legible: claims know their sources, metrics know their definitions, decisions know their owners, and every view can stay connected to the same source of truth.',
  },
  metrics: [
    {
      id: 'revenue',
      label: 'Q2 revenue',
      value: 42.8,
      previous: 36.6,
      format: 'currency',
      source: 'Finance model · Revenue · Q2 FY27',
      updatedAt: '12 min ago',
    },
    {
      id: 'growth',
      label: 'YoY growth',
      value: 17,
      previous: 14,
      format: 'percent',
      source: 'Finance model · Growth · Q2 FY27',
      updatedAt: '12 min ago',
    },
    {
      id: 'margin',
      label: 'Gross margin',
      value: 71.4,
      previous: 69.8,
      format: 'percent',
      source: 'Finance model · Margin · Q2 FY27',
      updatedAt: '12 min ago',
    },
  ],
  regions: [
    { id: 'na', region: 'North America', revenue: 18.6, growth: 12, margin: 74.1 },
    { id: 'eu', region: 'Europe', revenue: 11.9, growth: 23, margin: 70.2 },
    { id: 'apac', region: 'APAC', revenue: 8.7, growth: 31, margin: 68.8 },
    { id: 'latam', region: 'Latin America', revenue: 3.6, growth: 18, margin: 66.7 },
  ],
  decisions: [
    {
      id: 'launch',
      title: 'Prioritise APAC expansion in the second half',
      status: 'pending',
      owner: 'Strategy',
      rationale: 'APAC is the fastest-growing region, but margin remains below the company average.',
    },
  ],
  sources: [
    {
      id: 'source:finance',
      label: 'Finance model',
      type: 'dataset',
      locator: 'Revenue · Q2 FY27',
      status: 'live',
      updatedAt: '12 min ago',
    },
    {
      id: 'source:research',
      label: 'Customer research',
      type: 'research',
      locator: 'FY27 customer interviews',
      status: 'live',
      updatedAt: '2 days ago',
    },
  ],
  graph: buildSeedGraph(),
  history: [],
}

export const regionsSchema: TableSchema = {
  id: 'Regions',
  label: 'Regions',
  fields: [
    { id: 'Region', label: 'Region', type: 'text' },
    { id: 'Revenue', label: 'Revenue', type: 'currency' },
    { id: 'Growth', label: 'Growth', type: 'percent' },
    { id: 'Margin', label: 'Margin', type: 'percent' },
  ],
}

export const revenueFormula = 'SUM(Regions.Revenue)'

export function regionsTable(workspace: WorkspaceState): TableData {
  return {
    schema: regionsSchema,
    rows: workspace.regions.map((row) => ({
      Region: row.region,
      Revenue: row.revenue,
      Growth: row.growth,
      Margin: row.margin,
    })),
  }
}

export function evaluateWorkspaceFormula(workspace: WorkspaceState, expression: string) {
  return evaluateSemanticFormula(expression, [regionsTable(workspace)])
}

export function formatMetric(metric: Metric) {
  if (metric.format === 'currency') return `$${metric.value.toFixed(1)}M`
  if (metric.format === 'percent') return `${metric.value.toFixed(metric.value % 1 ? 1 : 0)}%`
  return metric.value.toLocaleString()
}

export function metricDelta(metric: Metric) {
  return metric.value - metric.previous
}

export function cloneSeedWorkspace(): WorkspaceState {
  return structuredClone(seedWorkspace)
}

export function hydrateWorkspace(value: Partial<WorkspaceState> | null | undefined): WorkspaceState {
  if (!value) return cloneSeedWorkspace()

  return {
    ...cloneSeedWorkspace(),
    ...value,
    document: { ...seedWorkspace.document, ...(value.document ?? {}) },
    metrics: value.metrics ?? cloneSeedWorkspace().metrics,
    regions: value.regions ?? cloneSeedWorkspace().regions,
    decisions: value.decisions ?? cloneSeedWorkspace().decisions,
    sources: value.sources ?? cloneSeedWorkspace().sources,
    graph: value.graph ?? cloneSeedWorkspace().graph,
    history: value.history ?? [],
  }
}

export function getDownstreamObjectIds(graph: WorkspaceGraph, changedObjectIds: string[]): string[] {
  const changed = new Set(changedObjectIds)
  const visited = new Set(changedObjectIds)
  const queue = [...changedObjectIds]
  const downstream: string[] = []

  while (queue.length > 0) {
    const current = queue.shift()!
    for (const edge of graph.edges) {
      if (edge.from !== current || visited.has(edge.to)) continue
      visited.add(edge.to)
      queue.push(edge.to)
      if (!changed.has(edge.to)) downstream.push(edge.to)
    }
  }

  return downstream
}

export function getWorkspaceImpacts(workspace: WorkspaceState, changedObjectIds: string[]): WorkspaceImpact[] {
  const downstreamIds = getDownstreamObjectIds(workspace.graph, changedObjectIds)

  return downstreamIds.flatMap((objectId) => {
    const object = workspace.graph.objects.find((candidate) => candidate.id === objectId)
    if (!object) return []

    const inbound = workspace.graph.edges.filter(
      (edge) => edge.to === objectId && (changedObjectIds.includes(edge.from) || downstreamIds.includes(edge.from)),
    )

    return [{
      ...object,
      reason: inbound.map((edge) => edge.description).join(' · ') || 'Downstream dependency',
    }]
  })
}

function makeEvent(
  workspace: WorkspaceState,
  summary: string,
  changedAt: string,
  changedObjectIds: string[],
): ChangeEvent {
  return {
    id: `change:${workspace.history.length + 1}`,
    changedAt,
    summary,
    changedObjectIds,
    affectedObjectIds: getDownstreamObjectIds(workspace.graph, changedObjectIds),
  }
}

function appendHistory(workspace: WorkspaceState, event: ChangeEvent): WorkspaceState {
  return {
    ...workspace,
    history: [event, ...workspace.history].slice(0, 50),
  }
}

export function updateRegionField(
  workspace: WorkspaceState,
  id: string,
  field: keyof RegionRow,
  value: string | number,
  changedAt = 'just now',
): WorkspaceMutationResult {
  const existing = workspace.regions.find((row) => row.id === id)
  if (!existing) throw new Error(`Unknown region: ${id}`)

  const regions = workspace.regions.map((row) => row.id === id ? { ...row, [field]: value } : row)
  let metrics = workspace.metrics
  const changedObjectIds = [`region:${id}`]

  if (field === 'revenue') {
    const totalRevenue = Number(evaluateWorkspaceFormula({ ...workspace, regions }, revenueFormula).value.toFixed(1))
    metrics = workspace.metrics.map((metric) =>
      metric.id === 'revenue' ? { ...metric, value: totalRevenue, updatedAt: changedAt } : metric,
    )
    changedObjectIds.push('metric:revenue')
  }

  const next = { ...workspace, regions, metrics }
  const summary = `${existing.region} ${String(field)} updated`
  const event = makeEvent(next, summary, changedAt, changedObjectIds)
  const withHistory = appendHistory(next, event)

  return {
    workspace: withHistory,
    impacts: getWorkspaceImpacts(withHistory, changedObjectIds),
    event,
  }
}

export function setDecisionStatus(
  workspace: WorkspaceState,
  id: string,
  status: Decision['status'],
  changedAt = 'just now',
): WorkspaceMutationResult {
  const existing = workspace.decisions.find((decision) => decision.id === id)
  if (!existing) throw new Error(`Unknown decision: ${id}`)

  const decisions = workspace.decisions.map((decision) =>
    decision.id === id ? { ...decision, status } : decision,
  )
  const changedObjectIds = [`decision:${id}`]
  const next = { ...workspace, decisions }
  const event = makeEvent(next, `${existing.title} ${status}`, changedAt, changedObjectIds)
  const withHistory = appendHistory(next, event)

  return {
    workspace: withHistory,
    impacts: getWorkspaceImpacts(withHistory, changedObjectIds),
    event,
  }
}
