import assert from 'node:assert/strict'
import test from 'node:test'
import { cloneSeedWorkspace } from '../src/model.ts'
import { resolveTableRelationship } from '../src/relationships.ts'

test('Regions and Plan resolve through an explicit one-to-one relationship', () => {
  const workspace = cloneSeedWorkspace()
  const resolved = resolveTableRelationship(workspace, 'relationship:regions-plan')
  assert.equal(resolved.relationship.cardinality, 'one-to-one')
  assert.equal(resolved.pairs.length, 4)
  assert.deepEqual(resolved.pairs.map((pair) => pair.key), ['North America', 'Europe', 'APAC', 'Latin America'])
  assert.deepEqual(resolved.unmatchedFrom, [])
  assert.deepEqual(resolved.unmatchedTo, [])
})

test('relationship resolution exposes unmatched keys without fabricating joins', () => {
  const workspace = cloneSeedWorkspace()
  workspace.plans = workspace.plans.filter((row) => row.id !== 'latam')
  const resolved = resolveTableRelationship(workspace, 'relationship:regions-plan')
  assert.equal(resolved.pairs.length, 3)
  assert.equal(resolved.unmatchedFrom[0].Region, 'Latin America')
})

test('one-to-one relationships reject duplicate semantic keys', () => {
  const workspace = cloneSeedWorkspace()
  workspace.plans.push({ id: 'apac-copy', region: 'APAC', revenue: 1 })
  assert.throws(() => resolveTableRelationship(workspace, 'relationship:regions-plan'), /expected unique target key/)
})
