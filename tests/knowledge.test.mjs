import assert from 'node:assert/strict'
import test from 'node:test'
import { cloneSeedWorkspace } from '../src/model.ts'
import { deriveGrowthLeaderClaim, getClaimLineage } from '../src/knowledge.ts'

test('growth leader claim is derived from live regional data with evidence lineage', () => {
  const workspace = cloneSeedWorkspace()
  const claim = deriveGrowthLeaderClaim(workspace)
  assert.equal(claim.statement, 'APAC is the fastest-growing region at 31%.')
  assert.equal(claim.confidence, 'high')
  assert.equal(claim.status, 'supported')
  assert.deepEqual(claim.evidenceObjectIds, ['region:apac'])
  const lineage = getClaimLineage(workspace, claim)
  assert.deepEqual(lineage.sources.map((source) => source.id), ['source:finance'])
  assert.deepEqual(lineage.evidence.map((object) => object.id), ['region:apac'])
})

test('derived claims change when the underlying model changes', () => {
  const workspace = cloneSeedWorkspace()
  workspace.regions.find((row) => row.id === 'eu').growth = 35
  const claim = deriveGrowthLeaderClaim(workspace)
  assert.match(claim.statement, /^Europe is the fastest-growing region at 35%/)
  assert.deepEqual(claim.evidenceObjectIds, ['region:eu'])
})

test('claim freshness reflects source freshness', () => {
  const workspace = cloneSeedWorkspace()
  workspace.sources.find((source) => source.id === 'source:finance').status = 'stale'
  assert.equal(deriveGrowthLeaderClaim(workspace).status, 'stale')
})
