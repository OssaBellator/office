import { evaluateSemanticExpression, type SemanticDimension, type SemanticExpressionResult } from './expressions.ts'
import { evaluateMetric, workspaceTables, type WorkspaceState } from './model.ts'

export type RelationshipLookupResult = {
  value: number
  dimension: SemanticDimension
  dependencies: string[]
  objectDependencies: string[]
}

function dimensionFor(type: string): SemanticDimension {
  if (type === 'currency') return 'currency'
  if (type === 'percent') return 'percent'
  return 'number'
}

function rowObjectId(workspace: WorkspaceState, tableId: string, rowIndex: number) {
  if (tableId === 'Regions') return workspace.regions[rowIndex] ? `region:${workspace.regions[rowIndex].id}` : null
  if (tableId === 'Plan') return workspace.plans[rowIndex] ? `plan:${workspace.plans[rowIndex].id}` : null
  return null
}

export function resolveRelationshipLookup(workspace: WorkspaceState, relationshipId: string, key: string | number, tableId: string, fieldId: string): RelationshipLookupResult {
  const relationship = workspace.relationships.find((candidate) => candidate.id === relationshipId)
  if (!relationship) throw new Error(`Unknown relationship: ${relationshipId}`)
  const keyField = tableId === relationship.fromTable
    ? relationship.fromField
    : tableId === relationship.toTable
      ? relationship.toField
      : null
  if (!keyField) throw new Error(`${tableId} is not an endpoint of relationship ${relationshipId}`)
  const table = workspaceTables(workspace).find((candidate) => candidate.schema.id === tableId)
  if (!table) throw new Error(`Unknown lookup table: ${tableId}`)
  const field = table.schema.fields.find((candidate) => candidate.id === fieldId)
  if (!field) throw new Error(`Unknown lookup field: ${tableId}.${fieldId}`)
  if (field.type === 'text') throw new Error(`LOOKUP expressions require a numeric target field: ${tableId}.${fieldId}`)
  const matches = table.rows.map((row,index)=>({row,index})).filter(({row}) => String(row[keyField] ?? '') === String(key))
  if (matches.length === 0) throw new Error(`No ${tableId} row matches ${keyField} = ${String(key)} through ${relationshipId}`)
  if (matches.length > 1) throw new Error(`Ambiguous ${relationshipId} lookup for key ${String(key)}: ${matches.length} ${tableId} rows match`)
  const match = matches[0]
  const value = match.row[fieldId]
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`LOOKUP target ${tableId}.${fieldId} is not numeric for key ${String(key)}`)
  const objectId = rowObjectId(workspace, tableId, match.index)
  return {
    value,
    dimension:dimensionFor(field.type),
    dependencies:[relationshipId,`field:${tableId}.${keyField}`,`field:${tableId}.${fieldId}`],
    objectDependencies:[relationshipId,...(objectId?[objectId]:[])],
  }
}

export function evaluateRelationshipExpression(workspace: WorkspaceState, expression: string, metricStack: string[] = []): SemanticExpressionResult {
  return evaluateSemanticExpression(expression, workspaceTables(workspace), {
    resolveMetric:(metricId)=>{
      const metric=workspace.metrics.find((candidate)=>candidate.id===metricId)
      if(!metric)throw new Error(`Unknown metric: ${metricId}`)
      const result=evaluateMetric(workspace,metricId,metricStack)
      return{value:result.value,dimension:metric.format}
    },
    resolveLookup:(relationshipId,key,tableId,fieldId)=>resolveRelationshipLookup(workspace,relationshipId,key,tableId,fieldId),
  })
}
