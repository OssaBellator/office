export type Surface = 'docs' | 'data' | 'present'

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
}

export function formatMetric(metric: Metric) {
  if (metric.format === 'currency') return `$${metric.value.toFixed(1)}M`
  if (metric.format === 'percent') return `${metric.value.toFixed(metric.value % 1 ? 1 : 0)}%`
  return metric.value.toLocaleString()
}

export function metricDelta(metric: Metric) {
  return metric.value - metric.previous
}
