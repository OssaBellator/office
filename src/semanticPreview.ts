import { runVersionedCommand, type VersionedWorkspaceCommand } from './semanticCommands.ts'
import { compareWorkspaceStates, type WorkspaceVersionDiff } from './workspaceCompare.ts'
import type { WorkspaceImpact, WorkspaceMutationResult, WorkspaceState } from './model.ts'

export type VersionedCommandPreview = WorkspaceMutationResult & {
  command: VersionedWorkspaceCommand
  diffs: WorkspaceVersionDiff[]
}

export function previewVersionedCommand(workspace: WorkspaceState, command: VersionedWorkspaceCommand): VersionedCommandPreview {
  const result = runVersionedCommand(workspace, command)
  return {
    ...result,
    command,
    diffs: compareWorkspaceStates(workspace, result.workspace),
  }
}

export function summarizeVersionedImpacts(impacts: WorkspaceImpact[]) {
  return impacts.map((impact) => ({ id: impact.id, label: impact.label, surfaces: impact.surfaces, reason: impact.reason }))
}
