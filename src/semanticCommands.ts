import {
  appendDocumentText,
  evaluateMetric,
  getDownstreamObjectIds,
  getWorkspaceImpacts,
  planSchema,
  regionsSchema,
  updatePlanField,
  workspaceTables,
  setDecisionStatus,
  updateRegionField,
  type ChangeEvent,
  type WorkspaceCommand,
  type WorkspaceMutationResult,
  type WorkspaceState,
} from './model.ts'
import { evaluateSemanticExpression } from './expressions.ts'

export type VersionedWorkspaceCommand =
  | WorkspaceCommand
  | { type: 'document.update'; field: keyof WorkspaceState['document']; value: string; changedAt?: string }
  | { type: 'metric.formula'; metricId: string; formula: string | null; fallbackValue?: number; changedAt?: string }
  | { type: 'source.status'; sourceId: string; status: 'live' | 'stale'; changedAt?: string }

function directMutation(workspace: WorkspaceState, summary: string, changedAt: string, changedObjectIds: string[], nextWorkspace: WorkspaceState): WorkspaceMutationResult {
  const event: ChangeEvent = { id: `change:${workspace.history.length + 1}`, changedAt, summary, changedObjectIds, affectedObjectIds: getDownstreamObjectIds(nextWorkspace.graph, changedObjectIds) }
  const withHistory = { ...nextWorkspace, history: [event, ...nextWorkspace.history].slice(0, 50) }
  return { workspace: withHistory, impacts: getWorkspaceImpacts(withHistory, changedObjectIds), event }
}

function syncMetricFormulaEdges(workspace: WorkspaceState, metricId: string, formula: string | null) {
  const metricObjectId = `metric:${metricId}`
  const retained = workspace.graph.edges.filter((edge) => !(edge.to === metricObjectId && edge.relation === 'derives'))
  if (!formula) return { ...workspace, graph: { ...workspace.graph, edges: retained } }
  const analysis = evaluateSemanticExpression(formula, workspaceTables(workspace))
  const metric = workspace.metrics.find((candidate) => candidate.id === metricId)
  const sourceIds = new Set<string>()
  for (const term of analysis.terms) {
    if (term.tableId === 'Regions') workspace.regions.forEach((row) => sourceIds.add(`region:${row.id}`))
    if (term.tableId === 'Plan') workspace.plans.forEach((row) => sourceIds.add(`plan:${row.id}`))
  }
  const description = `${analysis.terms.map((term) => `${term.tableId}.${term.fieldId}`).join(' + ')} contributes to ${metric?.label ?? metricId}`
  const derived = [...sourceIds].map((from) => ({ from, to: metricObjectId, relation: 'derives' as const, description }))
  return { ...workspace, graph: { ...workspace.graph, edges: [...retained, ...derived] } }
}

export function validateMetricFormula(workspace: WorkspaceState, metricId: string, formula: string) {
  const metric = workspace.metrics.find((candidate) => candidate.id === metricId)
  if (!metric) throw new Error(`Unknown metric: ${metricId}`)
  const analysis = evaluateSemanticExpression(formula, workspaceTables(workspace))
  if (analysis.terms.length === 0) throw new Error('Metric formula must reference at least one semantic field')
  for (const parsed of analysis.terms) {
    const schema = [regionsSchema, planSchema].find((candidate) => candidate.id === parsed.tableId)
    if (!schema) throw new Error(`Unknown table: ${parsed.tableId}`)
    const field = schema.fields.find((candidate) => candidate.id === parsed.fieldId)
    if (!field) throw new Error(`Unknown field: ${parsed.tableId}.${parsed.fieldId}`)
    if (parsed.fn === 'COUNT') {
      if (metric.format !== 'number') throw new Error(`COUNT produces a number and cannot define ${metric.format} metric ${metric.label}`)
    } else if (metric.format === 'currency' && field.type !== 'currency') throw new Error(`${metric.label} is currency and requires a currency field in every term`)
    else if (metric.format === 'percent' && field.type !== 'percent') throw new Error(`${metric.label} is percent and requires a percent field in every term`)
    else if (field.type === 'text') throw new Error(`${parsed.fn} requires a numeric field`)
  }
  return analysis
}

function updateMetricFormula(workspace: WorkspaceState, metricId: string, formula: string | null, fallbackValue: number | undefined, changedAt = 'just now'): WorkspaceMutationResult {
  const existing = workspace.metrics.find((metric) => metric.id === metricId)
  if (!existing) throw new Error(`Unknown metric: ${metricId}`)
  if (formula) validateMetricFormula(workspace, metricId, formula)
  let next = syncMetricFormulaEdges(workspace, metricId, formula)
  next = { ...next, metrics: next.metrics.map((metric) => metric.id === metricId ? { ...metric, formula: formula ?? undefined, updatedAt: changedAt } : metric) }
  const updated = next.metrics.find((metric) => metric.id === metricId)!
  const value = formula ? evaluateMetric(next, metricId).value : (fallbackValue ?? updated.value)
  next = { ...next, metrics: next.metrics.map((metric) => metric.id === metricId ? { ...metric, value: Number(value.toFixed(12)) } : metric) }
  return directMutation(workspace, `${existing.label} formula updated`, changedAt, [`metric:${metricId}`], next)
}

export function runVersionedCommand(workspace: WorkspaceState, command: VersionedWorkspaceCommand): WorkspaceMutationResult {
  switch (command.type) {
    case 'region.update': return updateRegionField(workspace, command.regionId, command.field, command.value, command.changedAt)
    case 'plan.update': return updatePlanField(workspace, command.planId, command.field, command.value, command.changedAt)
    case 'decision.status': return setDecisionStatus(workspace, command.decisionId, command.status, command.changedAt)
    case 'document.append': return appendDocumentText(workspace, command.text, command.changedAt)
    case 'document.update': {
      const next = { ...workspace, document: { ...workspace.document, [command.field]: command.value } }
      return directMutation(workspace, `Strategy ${String(command.field)} updated`, command.changedAt ?? 'just now', ['document:strategy'], next)
    }
    case 'metric.formula': return updateMetricFormula(workspace, command.metricId, command.formula, command.fallbackValue, command.changedAt)
    case 'source.status': {
      const existing = workspace.sources.find((source) => source.id === command.sourceId)
      if (!existing) throw new Error(`Unknown source: ${command.sourceId}`)
      const next = { ...workspace, sources: workspace.sources.map((source) => source.id === command.sourceId ? { ...source, status: command.status, updatedAt: command.changedAt ?? 'just now' } : source) }
      return directMutation(workspace, `${existing.label} marked ${command.status}`, command.changedAt ?? 'just now', [command.sourceId], next)
    }
  }
}

export function versionedCommandIsNoop(workspace: WorkspaceState, command: VersionedWorkspaceCommand) {
  switch (command.type) {
    case 'region.update': return workspace.regions.find((row) => row.id === command.regionId)?.[command.field] === command.value
    case 'plan.update': return workspace.plans.find((row) => row.id === command.planId)?.[command.field] === command.value
    case 'decision.status': return workspace.decisions.find((decision) => decision.id === command.decisionId)?.status === command.status
    case 'document.append': return command.text.trim().length === 0
    case 'document.update': return workspace.document[command.field] === command.value
    case 'metric.formula': return (workspace.metrics.find((candidate) => candidate.id === command.metricId)?.formula ?? null) === command.formula
    case 'source.status': return workspace.sources.find((source) => source.id === command.sourceId)?.status === command.status
  }
}
