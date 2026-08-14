import { resolveTableRelationship } from './relationships.ts'
import { workspaceTables, type ChartDefinition, type WorkspaceState } from './model.ts'
import type { TableRow } from './formulas.ts'

export type MaterializedChartRow = { category: string; values: Record<string, number> }
export type MaterializedChart = { definition: ChartDefinition; rows: MaterializedChartRow[]; maxValue: number; sourceObjectIds: string[] }

function valueFromRow(row: TableRow | undefined, fieldId: string) {
  const value = row?.[fieldId]
  if (typeof value !== 'number' || Number.isNaN(value)) throw new Error(`Chart field ${fieldId} must be numeric`)
  return value
}

export function materializeChart(workspace: WorkspaceState, chartId: string): MaterializedChart {
  const definition = workspace.charts.find((candidate) => candidate.id === chartId)
  if (!definition) throw new Error(`Unknown chart: ${chartId}`)
  const relationship = resolveTableRelationship(workspace, definition.relationshipId)
  const tables = workspaceTables(workspace)
  const categoryTable = tables.find((table) => table.schema.id === definition.category.tableId)
  if (!categoryTable) throw new Error(`Unknown chart category table: ${definition.category.tableId}`)
  if (!categoryTable.schema.fields.some((field) => field.id === definition.category.fieldId)) throw new Error(`Unknown chart category field: ${definition.category.tableId}.${definition.category.fieldId}`)

  const rows: MaterializedChartRow[] = relationship.pairs.map((pair) => {
    const base = definition.category.tableId === relationship.relationship.fromTable ? pair.from : pair.to
    const categoryValue = base[definition.category.fieldId]
    if (categoryValue === null || categoryValue === undefined) throw new Error(`Chart category is missing: ${definition.category.fieldId}`)
    const values: Record<string, number> = {}
    for (const series of definition.series) {
      const row = series.tableId === relationship.relationship.fromTable ? pair.from : series.tableId === relationship.relationship.toTable ? pair.to : undefined
      if (!row) throw new Error(`Chart series table is outside relationship: ${series.tableId}`)
      values[series.id] = valueFromRow(row, series.fieldId)
    }
    return { category: String(categoryValue), values }
  })
  const maxValue = Math.max(0, ...rows.flatMap((row) => Object.values(row.values)))
  const sourceObjectIds = [
    ...workspace.regions.map((row) => `region:${row.id}`),
    ...workspace.plans.map((row) => `plan:${row.id}`),
  ]
  return { definition, rows, maxValue, sourceObjectIds }
}
