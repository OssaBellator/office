import { assertWorkspaceCommandPermission, type WorkspaceRole } from './permissions.ts'
import { previewVersionedCommand, type VersionedCommandPreview } from './semanticPreview.ts'
import type { VersionedWorkspaceCommand } from './semanticCommands.ts'
import { executeVersionedWorkspaceCommand, type VersionedWorkspaceSession } from './versioning.ts'
import { compareWorkspaceStates } from './workspaceCompare.ts'
import { assessWorkspaceReadiness, type WorkspaceReadiness } from './workspaceDiagnostics.ts'
import type { WorkspaceImpact } from './model.ts'

export type AutomationPlanStep = {
  index: number
  command: VersionedWorkspaceCommand
  preview: VersionedCommandPreview
}

export type WorkspaceAutomationPlan = {
  id: string
  role: WorkspaceRole
  steps: AutomationPlanStep[]
  diffs: ReturnType<typeof compareWorkspaceStates>
  impacts: WorkspaceImpact[]
  readinessBefore: WorkspaceReadiness
  readinessAfter: WorkspaceReadiness
  resultingSession: VersionedWorkspaceSession
}

function planId() {
  return `automation:${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`
}

export function planWorkspaceAutomation(session: VersionedWorkspaceSession, role: WorkspaceRole, commands: VersionedWorkspaceCommand[]): WorkspaceAutomationPlan {
  let simulated = structuredClone(session) as VersionedWorkspaceSession
  const steps: AutomationPlanStep[] = []
  const impactMap = new Map<string, WorkspaceImpact>()
  commands.forEach((command, index) => {
    assertWorkspaceCommandPermission(role, command)
    const preview = previewVersionedCommand(simulated.present, command)
    steps.push({ index, command, preview })
    preview.impacts.forEach((impact) => impactMap.set(impact.id, impact))
    simulated = executeVersionedWorkspaceCommand(simulated, command)
  })
  return {
    id:planId(),
    role,
    steps,
    diffs:compareWorkspaceStates(session.present, simulated.present),
    impacts:[...impactMap.values()],
    readinessBefore:assessWorkspaceReadiness(session.present),
    readinessAfter:assessWorkspaceReadiness(simulated.present),
    resultingSession:simulated,
  }
}

export function executeWorkspaceAutomation(session: VersionedWorkspaceSession, role: WorkspaceRole, commands: VersionedWorkspaceCommand[]) {
  return commands.reduce((current, command) => {
    assertWorkspaceCommandPermission(role, command)
    return executeVersionedWorkspaceCommand(current, command)
  }, session)
}
