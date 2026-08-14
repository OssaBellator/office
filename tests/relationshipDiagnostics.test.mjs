import assert from 'node:assert/strict'
import test from 'node:test'
import { cloneSeedWorkspace } from '../src/model.ts'
import { inspectAllRelationships, inspectRelationship } from '../src/relationshipDiagnostics.ts'

test('seed Actual-to-Plan relationship is valid with four matched keys', () => {
  const workspace = cloneSeedWorkspace()
  const report = inspectRelationship(workspace, 'relationship:regions-plan')
  assert.equal(report.valid, true)
  assert.deepEqual(report.matchedKeys, ['APAC','Europe','Latin America','North America'])
  assert.deepEqual(report.issues, [])
})

test('one-to-one relationships reject duplicate keys on either side', () => {
  const workspace = cloneSeedWorkspace()
  workspace.regions[1].region = 'APAC'
  workspace.plans[1].region = 'APAC'
  const report = inspectRelationship(workspace, 'relationship:regions-plan')
  assert.equal(report.valid, false)
  assert.equal(report.issues.some((item) => item.kind === 'duplicate-from-key' && item.keys.includes('APAC')), true)
  assert.equal(report.issues.some((item) => item.kind === 'duplicate-to-key' && item.keys.includes('APAC')), true)
})

test('relationship diagnostics report unmatched keys as warnings without invalidating unique joins', () => {
  const workspace = cloneSeedWorkspace()
  workspace.plans[3].region = 'Middle East'
  const report = inspectRelationship(workspace, 'relationship:regions-plan')
  assert.equal(report.valid, true)
  assert.equal(report.issues.some((item) => item.kind === 'unmatched-from-key' && item.keys.includes('Latin America')), true)
  assert.equal(report.issues.some((item) => item.kind === 'unmatched-to-key' && item.keys.includes('Middle East')), true)
})

test('many-to-one relationship allows repeated source keys but still requires unique target keys', () => {
  const workspace = cloneSeedWorkspace()
  workspace.relationships[0].cardinality = 'many-to-one'
  workspace.regions[1].region = 'APAC'
  let report = inspectRelationship(workspace, 'relationship:regions-plan')
  assert.equal(report.issues.some((item) => item.kind === 'duplicate-from-key'), false)
  workspace.plans[1].region = 'APAC'
  report = inspectRelationship(workspace, 'relationship:regions-plan')
  assert.equal(report.issues.some((item) => item.kind === 'duplicate-to-key'), true)
})

test('relationship diagnostics reject missing field definitions', () => {
  const workspace = cloneSeedWorkspace()
  workspace.relationships[0].fromField = 'Missing'
  const report = inspectRelationship(workspace, 'relationship:regions-plan')
  assert.equal(report.valid, false)
  assert.equal(report.issues.some((item) => item.kind === 'missing-field'), true)
})

test('all-relationship inspection evaluates every saved relationship definition', () => {
  const workspace = cloneSeedWorkspace()
  assert.equal(inspectAllRelationships(workspace).length, workspace.relationships.length)
})
