import assert from 'node:assert/strict'
import test from 'node:test'
import { cloneSeedWorkspace } from '../src/model.ts'
import { createVersionedWorkspaceSession } from '../src/versioning.ts'
import { evaluateRelationshipExpression, resolveRelationshipLookup } from '../src/relationshipLookup.ts'

test('relationship lookup resolves target values through the declared key', () => {
  const workspace = createVersionedWorkspaceSession(cloneSeedWorkspace()).present
  const result = resolveRelationshipLookup(workspace, 'relationship:regions-plan', 'APAC', 'Plan', 'Revenue')
  assert.equal(result.value, 9.5)
  assert.equal(result.dimension, 'currency')
  assert.equal(result.objectDependencies.includes('relationship:regions-plan'), true)
  assert.equal(result.objectDependencies.includes('plan:apac'), true)
})

test('relationship lookup works from either relationship endpoint', () => {
  const workspace = createVersionedWorkspaceSession(cloneSeedWorkspace()).present
  const result = resolveRelationshipLookup(workspace, 'relationship:regions-plan', 'APAC', 'Regions', 'Margin')
  assert.equal(result.value, 68.8)
  assert.equal(result.dimension, 'percent')
  assert.equal(result.objectDependencies.includes('region:apac'), true)
})

test('relationship lookup expressions compose with canonical metrics', () => {
  const workspace = createVersionedWorkspaceSession(cloneSeedWorkspace()).present
  const result = evaluateRelationshipExpression(workspace, 'METRIC(revenue) - LOOKUP(relationship:regions-plan, "APAC", Plan.Revenue)')
  assert.equal(result.value, 33.3)
  assert.equal(result.dimension, 'currency')
  assert.equal(result.metricDependencies.includes('revenue'), true)
  assert.equal(result.objectDependencies.includes('plan:apac'), true)
})

test('relationship lookup rejects missing ambiguous and invalid targets', () => {
  const workspace = createVersionedWorkspaceSession(cloneSeedWorkspace()).present
  assert.throws(() => resolveRelationshipLookup(workspace, 'relationship:regions-plan', 'Moon', 'Plan', 'Revenue'), /No Plan row matches/)
  assert.throws(() => resolveRelationshipLookup(workspace, 'relationship:regions-plan', 'APAC', 'Plan', 'Region'), /numeric target field/)
  assert.throws(() => resolveRelationshipLookup(workspace, 'relationship:regions-plan', 'APAC', 'Unknown', 'Revenue'), /not an endpoint/)
  workspace.plans.find((row) => row.id === 'eu').region = 'APAC'
  assert.throws(() => resolveRelationshipLookup(workspace, 'relationship:regions-plan', 'APAC', 'Plan', 'Revenue'), /Ambiguous/)
})
