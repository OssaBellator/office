import type { ChartDefinition, WorkspaceState } from './model.ts'

export type EditableChartKind = ChartDefinition['kind']
export type EditableChartDefinition = ChartDefinition

export function getEditableChart(workspace: WorkspaceState, chartId: string): EditableChartDefinition {
  const chart = workspace.charts.find((candidate) => candidate.id === chartId)
  if (!chart) throw new Error(`Unknown chart: ${chartId}`)
  if (chart.kind !== 'grouped-bar' && chart.kind !== 'line') throw new Error(`Unsupported chart kind: ${String(chart.kind)}`)
  return chart
}

export function updateEditableChartKind(workspace: WorkspaceState, chartId: string, kind: EditableChartKind): WorkspaceState {
  getEditableChart(workspace, chartId)
  return { ...workspace, charts: workspace.charts.map((chart) => chart.id === chartId ? { ...chart, kind } : chart) }
}
