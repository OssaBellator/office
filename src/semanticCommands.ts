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
import {
  getSemanticDocument,
  updateSemanticLegacyBody,
  withSemanticDocument,
  type ClaimConfidence,
  type SemanticCitation,
  type SemanticClaim,
  type SemanticDocumentBlock,
  type SemanticDocumentState,
} from './semanticDocument.ts'

export type VersionedWorkspaceCommand =
  | WorkspaceCommand
  | { type: 'document.update'; field: keyof WorkspaceState['document']; value: string; changedAt?: string }
  | { type: 'document.semantic.replace'; value: SemanticDocumentState; changedAt?: string }
  | { type: 'document.block.update'; blockId: string; text: string; changedAt?: string }
  | { type: 'document.block.insert'; block: SemanticDocumentBlock; index?: number; claim?: SemanticClaim; citation?: SemanticCitation; changedAt?: string }
  | { type: 'document.block.remove'; blockId: string; changedAt?: string }
  | { type: 'document.block.move'; blockId: string; toIndex: number; changedAt?: string }
  | { type: 'claim.update'; claimId: string; field: 'statement' | 'rationale' | 'confidence'; value: string | ClaimConfidence; changedAt?: string }
  | { type: 'citation.update'; citationId: string; field: 'label' | 'locator'; value: string; changedAt?: string }
  | { type: 'metric.formula'; metricId: string; formula: string | null; fallbackValue?: number; changedAt?: string }
  | { type: 'source.status'; sourceId: string; status: 'live' | 'stale'; changedAt?: string }

function directMutation(workspace: WorkspaceState, summary: string, changedAt: string, changedObjectIds: string[], nextWorkspace: WorkspaceState): WorkspaceMutationResult {
  const event: ChangeEvent = { id: `change:${workspace.history.length + 1}`, changedAt, summary, changedObjectIds, affectedObjectIds: getDownstreamObjectIds(nextWorkspace.graph, changedObjectIds) }
  const withHistory = { ...nextWorkspace, history: [event, ...nextWorkspace.history].slice(0, 50) }
  return { workspace: withHistory, impacts: getWorkspaceImpacts(withHistory, changedObjectIds), event }
}

function semanticMutation(workspace: WorkspaceState, semantic: SemanticDocumentState, summary: string, changedAt: string, changedObjectIds: string[]) {
  return directMutation(workspace, summary, changedAt, changedObjectIds, withSemanticDocument(workspace, semantic))
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
    case 'document.append': {
      const appended = appendDocumentText(workspace, command.text, command.changedAt)
      const next = updateSemanticLegacyBody(appended.workspace, appended.workspace.document.body)
      return { ...appended, workspace: next }
    }
    case 'document.update': {
      const changedAt = command.changedAt ?? 'just now'
      const next = command.field === 'body'
        ? updateSemanticLegacyBody(workspace, command.value)
        : { ...workspace, document: { ...workspace.document, [command.field]: command.value } }
      return directMutation(workspace, `Strategy ${String(command.field)} updated`, changedAt, ['document:strategy'], next)
    }
    case 'document.semantic.replace': {
      const changedIds = [...command.value.blocks.map((block) => block.id), ...command.value.claims.map((claim) => claim.id), ...command.value.citations.map((citation) => citation.id)]
      return semanticMutation(workspace, command.value, 'Strategy semantic blocks restored', command.changedAt ?? 'just now', changedIds)
    }
    case 'document.block.update': {
      const semantic = getSemanticDocument(workspace)
      const block = semantic.blocks.find((item) => item.id === command.blockId)
      if (!block) throw new Error(`Unknown document block: ${command.blockId}`)
      if (block.type !== 'paragraph') throw new Error(`Block ${command.blockId} is not editable paragraph text`)
      semantic.blocks = semantic.blocks.map((item) => item.id === command.blockId ? { ...block, text: command.text } : item)
      return semanticMutation(workspace, semantic, 'Strategy paragraph updated', command.changedAt ?? 'just now', [command.blockId])
    }
    case 'document.block.insert': {
      const semantic = getSemanticDocument(workspace)
      if (semantic.blocks.some((block) => block.id === command.block.id)) throw new Error(`Document block already exists: ${command.block.id}`)
      const index = Math.max(0, Math.min(command.index ?? semantic.blocks.length, semantic.blocks.length))
      semantic.blocks.splice(index, 0, structuredClone(command.block))
      if (command.claim) semantic.claims.push(structuredClone(command.claim))
      if (command.citation) semantic.citations.push(structuredClone(command.citation))
      const ids = [command.block.id, command.claim?.id, command.citation?.id].filter(Boolean) as string[]
      return semanticMutation(workspace, semantic, `Added ${command.block.type} block`, command.changedAt ?? 'just now', ids)
    }
    case 'document.block.remove': {
      const semantic = getSemanticDocument(workspace)
      const block = semantic.blocks.find((item) => item.id === command.blockId)
      if (!block) throw new Error(`Unknown document block: ${command.blockId}`)
      semantic.blocks = semantic.blocks.filter((item) => item.id !== command.blockId)
      const removedIds = [command.blockId]
      if (block.type === 'claim') {
        const claim = semantic.claims.find((item) => item.id === block.claimId)
        if (claim) {
          removedIds.push(claim.id, ...claim.citationIds)
          semantic.claims = semantic.claims.filter((item) => item.id !== claim.id)
          semantic.citations = semantic.citations.filter((item) => !claim.citationIds.includes(item.id))
        }
      }
      return semanticMutation(workspace, semantic, `Removed ${block.type} block`, command.changedAt ?? 'just now', removedIds)
    }
    case 'document.block.move': {
      const semantic = getSemanticDocument(workspace)
      const fromIndex = semantic.blocks.findIndex((item) => item.id === command.blockId)
      if (fromIndex < 0) throw new Error(`Unknown document block: ${command.blockId}`)
      const [block] = semantic.blocks.splice(fromIndex, 1)
      const toIndex = Math.max(0, Math.min(command.toIndex, semantic.blocks.length))
      semantic.blocks.splice(toIndex, 0, block)
      return semanticMutation(workspace, semantic, `Moved ${block.type} block`, command.changedAt ?? 'just now', [command.blockId])
    }
    case 'claim.update': {
      const semantic = getSemanticDocument(workspace)
      const claim = semantic.claims.find((item) => item.id === command.claimId)
      if (!claim) throw new Error(`Unknown semantic claim: ${command.claimId}`)
      if (command.field === 'confidence' && !['low', 'medium', 'high'].includes(String(command.value))) throw new Error(`Unknown confidence: ${command.value}`)
      semantic.claims = semantic.claims.map((item) => item.id === command.claimId ? { ...item, [command.field]: command.value } as SemanticClaim : item)
      return semanticMutation(workspace, semantic, `Claim ${command.field} updated`, command.changedAt ?? 'just now', [command.claimId])
    }
    case 'citation.update': {
      const semantic = getSemanticDocument(workspace)
      const citation = semantic.citations.find((item) => item.id === command.citationId)
      if (!citation) throw new Error(`Unknown citation: ${command.citationId}`)
      semantic.citations = semantic.citations.map((item) => item.id === command.citationId ? { ...item, [command.field]: command.value } : item)
      return semanticMutation(workspace, semantic, `Citation ${command.field} updated`, command.changedAt ?? 'just now', [command.citationId])
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
    case 'document.semantic.replace': return JSON.stringify(getSemanticDocument(workspace)) === JSON.stringify(command.value)
    case 'document.block.update': {
      const block = getSemanticDocument(workspace).blocks.find((item) => item.id === command.blockId)
      return block?.type === 'paragraph' && block.text === command.text
    }
    case 'document.block.insert': return getSemanticDocument(workspace).blocks.some((block) => block.id === command.block.id)
    case 'document.block.remove': return !getSemanticDocument(workspace).blocks.some((block) => block.id === command.blockId)
    case 'document.block.move': return getSemanticDocument(workspace).blocks.findIndex((block) => block.id === command.blockId) === command.toIndex
    case 'claim.update': return getSemanticDocument(workspace).claims.find((claim) => claim.id === command.claimId)?.[command.field] === command.value
    case 'citation.update': return getSemanticDocument(workspace).citations.find((citation) => citation.id === command.citationId)?.[command.field] === command.value
    case 'metric.formula': return (workspace.metrics.find((candidate) => candidate.id === command.metricId)?.formula ?? null) === command.formula
    case 'source.status': return workspace.sources.find((source) => source.id === command.sourceId)?.status === command.status
  }
}
