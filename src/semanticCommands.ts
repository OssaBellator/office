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
import { getEditableChart, updateEditableChartKind, type EditableChartKind } from './chartModel.ts'
import {
  getPresentationState,
  withPresentationState,
  type PresentationSceneId,
  type PresentationState,
} from './presentationState.ts'
import {
  getSemanticDocument,
  updateSemanticLegacyBody,
  withSemanticDocument,
  type BlockAnnotation,
  type BlockAnnotationStatus,
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
  | { type: 'annotation.insert'; annotation: BlockAnnotation; changedAt?: string }
  | { type: 'annotation.update'; annotationId: string; field: 'body' | 'owner' | 'status'; value: string | BlockAnnotationStatus; changedAt?: string }
  | { type: 'annotation.remove'; annotationId: string; changedAt?: string }
  | { type: 'chart.kind'; chartId: string; kind: EditableChartKind; changedAt?: string }
  | { type: 'presentation.replace'; value: PresentationState; changedAt?: string }
  | { type: 'presentation.scene.move'; sceneId: PresentationSceneId; toIndex: number; changedAt?: string }
  | { type: 'presentation.scene.visibility'; sceneId: PresentationSceneId; visible: boolean; changedAt?: string }
  | { type: 'presentation.note.update'; sceneId: PresentationSceneId; note: string; changedAt?: string }
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

function presentationMutation(workspace: WorkspaceState, state: PresentationState, summary: string, changedAt: string, sceneIds: PresentationSceneId[]) {
  return directMutation(workspace, summary, changedAt, sceneIds.map((id) => `scene:${id}`), withPresentationState(workspace, state))
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
    if (parsed.fn !== 'COUNT' && field.type === 'text') throw new Error(`${parsed.fn} requires a numeric field`)
  }
  const compatibleDimension = metric.format === 'percent'
    ? analysis.dimension === 'percent' || analysis.dimension === 'number'
    : analysis.dimension === metric.format
  if (!compatibleDimension) throw new Error(`${metric.label} is ${metric.format} but the formula produces ${analysis.dimension}`)
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
      const changedIds = [...command.value.blocks.map((block) => block.id), ...command.value.claims.map((claim) => claim.id), ...command.value.citations.map((citation) => citation.id), ...command.value.annotations.map((annotation) => annotation.id)]
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
      const attachedAnnotations = semantic.annotations.filter((annotation) => annotation.blockId === command.blockId)
      removedIds.push(...attachedAnnotations.map((annotation) => annotation.id))
      semantic.annotations = semantic.annotations.filter((annotation) => annotation.blockId !== command.blockId)
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
    case 'annotation.insert': {
      const semantic = getSemanticDocument(workspace)
      if (!semantic.blocks.some((block) => block.id === command.annotation.blockId)) throw new Error(`Unknown annotation block: ${command.annotation.blockId}`)
      if (semantic.annotations.some((annotation) => annotation.id === command.annotation.id)) throw new Error(`Annotation already exists: ${command.annotation.id}`)
      semantic.annotations.push(structuredClone(command.annotation))
      return semanticMutation(workspace, semantic, `Added ${command.annotation.kind}`, command.changedAt ?? 'just now', [command.annotation.id])
    }
    case 'annotation.update': {
      const semantic = getSemanticDocument(workspace)
      const annotation = semantic.annotations.find((item) => item.id === command.annotationId)
      if (!annotation) throw new Error(`Unknown annotation: ${command.annotationId}`)
      if (command.field === 'status' && !['open','resolved','pending','approved'].includes(String(command.value))) throw new Error(`Unknown annotation status: ${command.value}`)
      semantic.annotations = semantic.annotations.map((item) => item.id === command.annotationId ? { ...item, [command.field]: command.value } as BlockAnnotation : item)
      return semanticMutation(workspace, semantic, `${annotation.kind} ${command.field} updated`, command.changedAt ?? 'just now', [command.annotationId])
    }
    case 'annotation.remove': {
      const semantic = getSemanticDocument(workspace)
      const annotation = semantic.annotations.find((item) => item.id === command.annotationId)
      if (!annotation) throw new Error(`Unknown annotation: ${command.annotationId}`)
      semantic.annotations = semantic.annotations.filter((item) => item.id !== command.annotationId)
      return semanticMutation(workspace, semantic, `Removed ${annotation.kind}`, command.changedAt ?? 'just now', [command.annotationId])
    }
    case 'chart.kind': {
      const chart = getEditableChart(workspace, command.chartId)
      const next = updateEditableChartKind(workspace, command.chartId, command.kind)
      return directMutation(workspace, `${chart.label} changed to ${command.kind === 'line' ? 'line' : 'grouped bars'}`, command.changedAt ?? 'just now', [`chart:${command.chartId}`], next)
    }
    case 'presentation.replace': {
      return presentationMutation(workspace, command.value, 'Board narrative structure restored', command.changedAt ?? 'just now', command.value.order)
    }
    case 'presentation.scene.move': {
      const state = getPresentationState(workspace)
      const fromIndex = state.order.indexOf(command.sceneId)
      if (fromIndex < 0) throw new Error(`Unknown presentation scene: ${command.sceneId}`)
      const [scene] = state.order.splice(fromIndex, 1)
      const toIndex = Math.max(0, Math.min(command.toIndex, state.order.length))
      state.order.splice(toIndex, 0, scene)
      return presentationMutation(workspace, state, `Moved ${command.sceneId} scene`, command.changedAt ?? 'just now', [command.sceneId])
    }
    case 'presentation.scene.visibility': {
      const state = getPresentationState(workspace)
      if (!state.order.includes(command.sceneId)) throw new Error(`Unknown presentation scene: ${command.sceneId}`)
      const hidden = new Set(state.hiddenSceneIds)
      if (command.visible) hidden.delete(command.sceneId)
      else {
        const visibleCount = state.order.filter((id) => !hidden.has(id)).length
        if (!hidden.has(command.sceneId) && visibleCount <= 1) throw new Error('A presentation must keep at least one visible scene')
        hidden.add(command.sceneId)
      }
      state.hiddenSceneIds = [...hidden]
      return presentationMutation(workspace, state, `${command.visible ? 'Showed' : 'Hid'} ${command.sceneId} scene`, command.changedAt ?? 'just now', [command.sceneId])
    }
    case 'presentation.note.update': {
      const state = getPresentationState(workspace)
      if (!state.order.includes(command.sceneId)) throw new Error(`Unknown presentation scene: ${command.sceneId}`)
      const note = command.note.trim()
      if (note) state.notes[command.sceneId] = command.note
      else delete state.notes[command.sceneId]
      return presentationMutation(workspace, state, `Updated ${command.sceneId} speaker note`, command.changedAt ?? 'just now', [command.sceneId])
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
    case 'annotation.insert': return getSemanticDocument(workspace).annotations.some((annotation) => annotation.id === command.annotation.id)
    case 'annotation.update': return getSemanticDocument(workspace).annotations.find((annotation) => annotation.id === command.annotationId)?.[command.field] === command.value
    case 'annotation.remove': return !getSemanticDocument(workspace).annotations.some((annotation) => annotation.id === command.annotationId)
    case 'chart.kind': return getEditableChart(workspace, command.chartId).kind === command.kind
    case 'presentation.replace': return JSON.stringify(getPresentationState(workspace)) === JSON.stringify(command.value)
    case 'presentation.scene.move': return getPresentationState(workspace).order.indexOf(command.sceneId) === command.toIndex
    case 'presentation.scene.visibility': return getPresentationState(workspace).hiddenSceneIds.includes(command.sceneId) === !command.visible
    case 'presentation.note.update': return (getPresentationState(workspace).notes[command.sceneId] ?? '') === command.note
    case 'metric.formula': return (workspace.metrics.find((candidate) => candidate.id === command.metricId)?.formula ?? null) === command.formula
    case 'source.status': return workspace.sources.find((source) => source.id === command.sourceId)?.status === command.status
  }
}
