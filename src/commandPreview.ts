import {
  appendDocumentText,
  setDecisionStatus,
  updateRegionField,
  type WorkspaceCommand,
  type WorkspaceImpact,
  type WorkspaceMutationResult,
  type WorkspaceState,
} from './model.ts'

export type SemanticDiff = {
  objectId: string
  label: string
  field: string
  before: string | number | null
  after: string | number | null
}

export type WorkspaceCommandPreview = WorkspaceMutationResult & {
  command: WorkspaceCommand
  diffs: SemanticDiff[]
}

function objectLabel(workspace: WorkspaceState, objectId: string) {
  return workspace.graph.objects.find((object) => object.id === objectId)?.label ?? objectId
}

function runCommand(workspace: WorkspaceState, command: WorkspaceCommand): WorkspaceMutationResult {
  switch (command.type) {
    case 'region.update':
      return updateRegionField(workspace, command.regionId, command.field, command.value, command.changedAt)
    case 'decision.status':
      return setDecisionStatus(workspace, command.decisionId, command.status, command.changedAt)
    case 'document.append':
      return appendDocumentText(workspace, command.text, command.changedAt)
  }
}

function buildDiffs(before: WorkspaceState, after: WorkspaceState, command: WorkspaceCommand): SemanticDiff[] {
  switch (command.type) {
    case 'region.update': {
      const beforeRow = before.regions.find((row) => row.id === command.regionId)
      const afterRow = after.regions.find((row) => row.id === command.regionId)
      if (!beforeRow || !afterRow) return []

      const diffs: SemanticDiff[] = []
      if (beforeRow[command.field] !== afterRow[command.field]) {
        diffs.push({
          objectId: `region:${command.regionId}`,
          label: objectLabel(after, `region:${command.regionId}`),
          field: String(command.field),
          before: beforeRow[command.field],
          after: afterRow[command.field],
        })
      }

      if (command.field === 'revenue') {
        const beforeMetric = before.metrics.find((metric) => metric.id === 'revenue')
        const afterMetric = after.metrics.find((metric) => metric.id === 'revenue')
        if (beforeMetric && afterMetric && beforeMetric.value !== afterMetric.value) {
          diffs.push({
            objectId: 'metric:revenue',
            label: objectLabel(after, 'metric:revenue'),
            field: 'value',
            before: beforeMetric.value,
            after: afterMetric.value,
          })
        }
      }

      return diffs
    }
    case 'decision.status': {
      const beforeDecision = before.decisions.find((decision) => decision.id === command.decisionId)
      const afterDecision = after.decisions.find((decision) => decision.id === command.decisionId)
      if (!beforeDecision || !afterDecision || beforeDecision.status === afterDecision.status) return []
      return [{
        objectId: `decision:${command.decisionId}`,
        label: objectLabel(after, `decision:${command.decisionId}`),
        field: 'status',
        before: beforeDecision.status,
        after: afterDecision.status,
      }]
    }
    case 'document.append':
      if (!command.text.trim()) return []
      return [{
        objectId: 'document:strategy',
        label: objectLabel(after, 'document:strategy'),
        field: 'append',
        before: null,
        after: command.text,
      }]
  }
}

export function previewWorkspaceCommand(workspace: WorkspaceState, command: WorkspaceCommand): WorkspaceCommandPreview {
  const result = runCommand(workspace, command)
  return {
    ...result,
    command,
    diffs: buildDiffs(workspace, result.workspace, command),
  }
}

export function summarizeImpacts(impacts: WorkspaceImpact[]) {
  return impacts.map((impact) => ({
    id: impact.id,
    label: impact.label,
    surfaces: impact.surfaces,
    reason: impact.reason,
  }))
}
