import { assessAutomationGovernance, type AutomationGovernanceDecision } from './automationGovernance.ts'
import { executeWorkspaceAutomation, planWorkspaceAutomation, type WorkspaceAutomationPlan } from './automationPlan.ts'
import type { WorkspaceRole } from './permissions.ts'
import type { VersionedWorkspaceCommand } from './semanticCommands.ts'
import type { VersionedWorkspaceSession } from './versioning.ts'
import { semanticWorkspaceFingerprint } from './workspaceFingerprint.ts'

export type GovernedAutomationPlan = {
  plan: WorkspaceAutomationPlan
  baseFingerprint: string
  governance: AutomationGovernanceDecision
  warnings?: string[]
}

export type AutomationApproval = {
  planId: string
  approvedBy: string
  approvedAt: string
}

export function planGovernedAutomation(session: VersionedWorkspaceSession, role: WorkspaceRole, commands: VersionedWorkspaceCommand[], warnings: string[] = []): GovernedAutomationPlan {
  const plan = planWorkspaceAutomation(session, role, commands)
  return { plan, baseFingerprint:semanticWorkspaceFingerprint(session.present), governance:assessAutomationGovernance(plan), ...(warnings.length ? { warnings:[...warnings] } : {}) }
}

export function approveAutomation(plan: GovernedAutomationPlan, approvedBy: string): AutomationApproval {
  if (!approvedBy.trim()) throw new Error('Automation approval requires an approver identity')
  return { planId:plan.plan.id, approvedBy:approvedBy.trim(), approvedAt:new Date().toISOString() }
}

export function executeGovernedAutomation(session: VersionedWorkspaceSession, governed: GovernedAutomationPlan, approval?: AutomationApproval) {
  const fingerprint = semanticWorkspaceFingerprint(session.present)
  if (fingerprint !== governed.baseFingerprint) throw new Error('Automation plan is stale because the workspace changed after planning')
  if (governed.governance.requiresApproval) {
    if (!approval || approval.planId !== governed.plan.id) throw new Error('Automation plan requires matching human approval before execution')
  }
  return executeWorkspaceAutomation(session, governed.plan.role, governed.plan.steps.map((step) => step.command))
}
