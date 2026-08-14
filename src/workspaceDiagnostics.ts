import { materializeChart } from './charts.ts'
import { evaluateMetric, type WorkspaceState } from './model.ts'
import { getPresentationState } from './presentationState.ts'
import { getSemanticDocument, resolveSemanticClaim } from './semanticDocument.ts'

export type DiagnosticSeverity = 'error' | 'warning' | 'info'
export type DiagnosticArea = 'claims' | 'reviews' | 'sources' | 'data' | 'charts' | 'graph' | 'presentation'

export type WorkspaceDiagnostic = {
  id: string
  severity: DiagnosticSeverity
  area: DiagnosticArea
  message: string
  objectIds: string[]
}

export type WorkspaceReadiness = {
  readyForReview: boolean
  errors: number
  warnings: number
  openApprovals: number
  openTasks: number
  diagnostics: WorkspaceDiagnostic[]
}

function diagnostic(id: string, severity: DiagnosticSeverity, area: DiagnosticArea, message: string, objectIds: string[]): WorkspaceDiagnostic {
  return { id, severity, area, message, objectIds }
}

export function buildWorkspaceDiagnostics(workspace: WorkspaceState): WorkspaceDiagnostic[] {
  const diagnostics: WorkspaceDiagnostic[] = []
  const semantic = getSemanticDocument(workspace)

  for (const source of workspace.sources) {
    if (source.status === 'stale') diagnostics.push(diagnostic(`source-stale:${source.id}`, 'warning', 'sources', `${source.label} is marked stale.`, [source.id]))
  }

  for (const claim of semantic.claims) {
    const resolved = resolveSemanticClaim(workspace, claim.id)
    if (resolved.status === 'contradicted') diagnostics.push(diagnostic(`claim-contradicted:${claim.id}`, 'error', 'claims', `Claim is contradicted by current workspace evidence: ${claim.statement}`, [claim.id, ...claim.citationIds]))
    else if (resolved.status === 'stale') diagnostics.push(diagnostic(`claim-stale:${claim.id}`, 'warning', 'claims', `Claim depends on stale or missing evidence: ${claim.statement}`, [claim.id, ...claim.citationIds]))
  }

  for (const annotation of semantic.annotations) {
    if (annotation.kind === 'approval' && annotation.status !== 'approved') diagnostics.push(diagnostic(`approval-pending:${annotation.id}`, 'warning', 'reviews', `Approval pending: ${annotation.body}`, [annotation.id, annotation.blockId]))
    if (annotation.kind === 'task' && annotation.status !== 'resolved') diagnostics.push(diagnostic(`task-open:${annotation.id}`, 'info', 'reviews', `Open task for ${annotation.owner}: ${annotation.body}`, [annotation.id, annotation.blockId]))
    if (annotation.kind === 'comment' && annotation.status !== 'resolved') diagnostics.push(diagnostic(`comment-open:${annotation.id}`, 'info', 'reviews', `Unresolved comment: ${annotation.body}`, [annotation.id, annotation.blockId]))
  }

  for (const metric of workspace.metrics) {
    if (!metric.formula) continue
    try { evaluateMetric(workspace, metric.id) }
    catch (error) { diagnostics.push(diagnostic(`metric-invalid:${metric.id}`, 'error', 'data', error instanceof Error ? `${metric.label}: ${error.message}` : `${metric.label} formula is invalid.`, [`metric:${metric.id}`])) }
  }

  for (const chart of workspace.charts) {
    try { materializeChart(workspace, chart.id) }
    catch (error) { diagnostics.push(diagnostic(`chart-invalid:${chart.id}`, 'error', 'charts', error instanceof Error ? `${chart.label}: ${error.message}` : `${chart.label} cannot be materialized.`, [`chart:${chart.id}`])) }
  }

  const objectIds = new Set(workspace.graph.objects.map((object) => object.id))
  workspace.graph.edges.forEach((edge, index) => {
    const missing = [edge.from, edge.to].filter((id) => !objectIds.has(id))
    if (missing.length) diagnostics.push(diagnostic(`graph-dangling:${index}`, 'error', 'graph', `Dependency edge references missing object${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}`, missing))
  })

  const presentation = getPresentationState(workspace)
  const visibleScenes = presentation.order.filter((id) => !presentation.hiddenSceneIds.includes(id))
  if (visibleScenes.length === 0) diagnostics.push(diagnostic('presentation-empty', 'error', 'presentation', 'The board narrative has no visible scenes.', presentation.order.map((id) => `scene:${id}`)))
  else if (visibleScenes.length === 1) diagnostics.push(diagnostic('presentation-single-scene', 'warning', 'presentation', 'The board narrative has only one visible scene.', [`scene:${visibleScenes[0]}`]))

  return diagnostics
}

export function assessWorkspaceReadiness(workspace: WorkspaceState): WorkspaceReadiness {
  const diagnostics = buildWorkspaceDiagnostics(workspace)
  const semantic = getSemanticDocument(workspace)
  const openApprovals = semantic.annotations.filter((annotation) => annotation.kind === 'approval' && annotation.status !== 'approved').length
  const openTasks = semantic.annotations.filter((annotation) => annotation.kind === 'task' && annotation.status !== 'resolved').length
  const errors = diagnostics.filter((item) => item.severity === 'error').length
  const warnings = diagnostics.filter((item) => item.severity === 'warning').length
  return {
    readyForReview: errors === 0 && openApprovals === 0,
    errors,
    warnings,
    openApprovals,
    openTasks,
    diagnostics,
  }
}
