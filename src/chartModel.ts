import type { ChartDefinition, WorkspaceState } from './model.ts'

export type EditableChartKind = 'grouped-bar' | 'line'
export type EditableChartDefinition = Omit<ChartDefinition, 'kind'> & { kind: EditableChartKind }

export function getEditableChart(workspace: WorkspaceState, chartId: string): EditableChartDefinition {
  const chart = workspace.charts.find((candidate) => candidate.id === chartId)
  if (!chart) throw new Error(`Unknown chart: ${chartId}`)
  const kind = String(chart.kind)
  if (kind !== 'grouped-bar' && kind !== 'line') throw new Error(`Unsupported chart kind: ${kind}`)
  return chart as EditableChartDefinition
}

export function updateEditableChartKind(workspace: WorkspaceState, chartId: string, kind: EditableChartKind): WorkspaceState {
  getEditableChart(workspace, chartId)
  const charts = workspace.charts.map((chart) => chart.id === chartId ? { ...chart, kind } : chart) as WorkspaceState['charts']
  return { ...workspace, charts }
}
