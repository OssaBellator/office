import type { WorkspaceAutomationPlan } from './automationPlan.ts'
import { getCommandCapability } from './permissions.ts'

export type AutomationRisk = 'low' | 'medium' | 'high'
export type AutomationGovernanceDecision = {
  risk: AutomationRisk
  requiresApproval: boolean
  reasons: string[]
}

function commandRisk(type: string) {
  if (type === 'source.status' || type === 'metric.formula' || type === 'metric.remove' || type === 'document.block.remove' || type === 'document.semantic.replace') return 'high' as const
  if (type === 'data.imported.replace' || type === 'metric.create' || type === 'decision.status' || type === 'presentation.scene.visibility' || type === 'chart.kind' || type === 'claim.update' || type === 'citation.update') return 'medium' as const
  return 'low' as const
}

function maxRisk(left: AutomationRisk, right: AutomationRisk): AutomationRisk {
  const rank: Record<AutomationRisk, number> = { low:0, medium:1, high:2 }
  return rank[right] > rank[left] ? right : left
}

export function assessAutomationGovernance(plan: WorkspaceAutomationPlan): AutomationGovernanceDecision {
  let risk: AutomationRisk = 'low'
  const reasons: string[] = []
  for (const step of plan.steps) {
    const stepRisk = commandRisk(step.command.type)
    risk = maxRisk(risk, stepRisk)
    if (stepRisk !== 'low') reasons.push(`${step.command.type} is a ${stepRisk}-risk semantic mutation`)
    const capability = getCommandCapability(step.command)
    if (capability === 'provenance') reasons.push('Provenance changes alter evidence freshness and require explicit human review')
  }
  if (plan.steps.length > 5) {
    risk = maxRisk(risk, 'medium')
    reasons.push(`Plan contains ${plan.steps.length} semantic steps`)
  }
  if (plan.diffs.length > 12) {
    risk = maxRisk(risk, 'medium')
    reasons.push(`Plan changes ${plan.diffs.length} semantic fields/objects`)
  }
  if (plan.readinessAfter.errors > plan.readinessBefore.errors) {
    risk = 'high'
    reasons.push(`Plan increases workspace errors from ${plan.readinessBefore.errors} to ${plan.readinessAfter.errors}`)
  }
  if (plan.readinessAfter.openApprovals > plan.readinessBefore.openApprovals) {
    risk = maxRisk(risk, 'medium')
    reasons.push('Plan introduces additional pending approvals')
  }
  return {
    risk,
    requiresApproval:risk !== 'low',
    reasons:[...new Set(reasons)],
  }
}
