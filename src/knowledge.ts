import type { SourceRecord, Surface, WorkspaceObject, WorkspaceState } from './model.ts'

export type ClaimConfidence = 'high' | 'medium' | 'low'
export type ClaimStatus = 'supported' | 'stale'

export type DerivedClaim = {
  id: string
  statement: string
  status: ClaimStatus
  confidence: ClaimConfidence
  sourceIds: string[]
  evidenceObjectIds: string[]
  surfaces: Surface[]
  rationale: string
}

export type ClaimLineage = {
  claim: DerivedClaim
  sources: SourceRecord[]
  evidence: WorkspaceObject[]
}

export function deriveGrowthLeaderClaim(workspace: WorkspaceState): DerivedClaim {
  const ordered = [...workspace.regions].sort((left, right) => right.growth - left.growth)
  const leader = ordered[0]
  if (!leader) throw new Error('Cannot derive growth claim without regional data')
  const runnerUp = ordered[1]
  const lead = runnerUp ? leader.growth - runnerUp.growth : leader.growth
  const financeSource = workspace.sources.find((source) => source.id === 'source:finance')
  const confidence: ClaimConfidence = lead >= 5 ? 'high' : lead >= 2 ? 'medium' : 'low'
  return {
    id: 'claim:regional-growth-leader',
    statement: `${leader.region} is the fastest-growing region at ${leader.growth}%.`,
    status: financeSource?.status === 'stale' ? 'stale' : 'supported',
    confidence,
    sourceIds: financeSource ? [financeSource.id] : [],
    evidenceObjectIds: [`region:${leader.id}`],
    surfaces: ['docs', 'present'],
    rationale: runnerUp
      ? `${leader.region} leads ${runnerUp.region} by ${lead.toFixed(1)} percentage points.`
      : `${leader.region} is the only regional observation.`,
  }
}

export function deriveWorkspaceClaims(workspace: WorkspaceState): DerivedClaim[] {
  return [deriveGrowthLeaderClaim(workspace)]
}

export function getClaimLineage(workspace: WorkspaceState, claim: DerivedClaim): ClaimLineage {
  return {
    claim,
    sources: claim.sourceIds.flatMap((id) => workspace.sources.find((source) => source.id === id) ?? []),
    evidence: claim.evidenceObjectIds.flatMap((id) => workspace.graph.objects.find((object) => object.id === id) ?? []),
  }
}
