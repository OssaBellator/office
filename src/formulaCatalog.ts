import { planSchema, regionsSchema, type Metric, type WorkspaceState } from './model.ts'
import type { FieldSchema, TableSchema } from './formulas.ts'

export type FormulaSuggestion = {
  expression: string
  label: string
  description: string
}

export type FormulaReference = {
  tableId: string
  tableLabel: string
  fieldId: string
  fieldLabel: string
  type: FieldSchema['type']
}

const schemas: TableSchema[] = [regionsSchema, planSchema]
const aggregates = ['SUM','AVERAGE','MIN','MAX'] as const

export function listFormulaReferences(): FormulaReference[] {
  return schemas.flatMap((schema) => schema.fields.map((field) => ({ tableId:schema.id, tableLabel:schema.label, fieldId:field.id, fieldLabel:field.label, type:field.type })))
}

function fieldCompatible(metric: Metric, field: FieldSchema) {
  if (metric.format === 'currency') return field.type === 'currency'
  if (metric.format === 'percent') return field.type === 'percent'
  return field.type !== 'text'
}

export function getMetricFormulaSuggestions(workspace: WorkspaceState, metricId: string): FormulaSuggestion[] {
  const metric = workspace.metrics.find((candidate) => candidate.id === metricId)
  if (!metric) throw new Error(`Unknown metric: ${metricId}`)
  const suggestions: FormulaSuggestion[] = []
  for (const schema of schemas) {
    for (const field of schema.fields) {
      if (!fieldCompatible(metric, field)) continue
      for (const fn of aggregates) suggestions.push({ expression:`${fn}(${schema.id}.${field.id})`, label:`${fn} ${schema.label} ${field.label}`, description:`${fn} over ${schema.id}.${field.id}` })
      if (schema.id === 'Regions' && field.type !== 'text') suggestions.push({ expression:`SUM(Regions.${field.id} WHERE Growth >= 20)`, label:`Filtered ${field.label}`, description:`Sum ${field.label} where regional growth is at least 20%` })
    }
  }
  if (metric.format === 'currency') suggestions.push({ expression:'SUM(Regions.Revenue) - SUM(Plan.Revenue)', label:'Actual minus plan', description:'Cross-table revenue variance' })
  if (metric.format === 'number') suggestions.push({ expression:'COUNT(Regions.Region)', label:'Region count', description:'Count rows in Regions' })
  const current = metric.formula?.trim()
  return [...new Map(suggestions.map((item) => [item.expression,item])).values()].filter((item) => item.expression !== current)
}

export function getRelationshipReferenceSummary(workspace: WorkspaceState) {
  return workspace.relationships.map((relationship) => ({ id:relationship.id, label:relationship.label, expression:`${relationship.fromTable}.${relationship.fromField} ↔ ${relationship.toTable}.${relationship.toField}`, cardinality:relationship.cardinality }))
}
