import assert from 'node:assert/strict'
import test from 'node:test'
import { cloneSeedWorkspace } from '../src/model.ts'
import { createVersionedWorkspaceSession, executeVersionedWorkspaceCommand } from '../src/versioning.ts'
import { approveAutomation, executeGovernedAutomation, planGovernedAutomation } from '../src/governedAutomation.ts'

test('low-risk governed automation can execute without explicit approval', () => {
  const session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  const governed = planGovernedAutomation(session, 'editor', [{ type:'region.update', regionId:'apac', field:'revenue', value:10 }])
  assert.equal(governed.governance.requiresApproval, false)
  const next = executeGovernedAutomation(session, governed)
  assert.equal(next.present.regions.find((row) => row.id === 'apac').revenue, 10)
})

test('medium/high-risk governed automation requires matching approval', () => {
  const session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  const governed = planGovernedAutomation(session, 'editor', [{ type:'chart.kind', chartId:'revenue-vs-plan', kind:'line' }])
  assert.equal(governed.governance.requiresApproval, true)
  assert.throws(() => executeGovernedAutomation(session, governed), /requires matching human approval/)
  const approval = approveAutomation(governed, 'ossa')
  const next = executeGovernedAutomation(session, governed, approval)
  assert.equal(next.charts ?? undefined, undefined)
  assert.equal(next.present.charts.find((chart) => chart.id === 'revenue-vs-plan').kind, 'line')
})

test('approval tokens are bound to one automation plan', () => {
  const session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  const first = planGovernedAutomation(session, 'editor', [{ type:'chart.kind', chartId:'revenue-vs-plan', kind:'line' }])
  const second = planGovernedAutomation(session, 'editor', [{ type:'presentation.scene.visibility', sceneId:'signal', visible:false }])
  const approval = approveAutomation(first, 'ossa')
  assert.throws(() => executeGovernedAutomation(session, second, approval), /requires matching human approval/)
})

test('approved plan refuses to execute after workspace state changes', () => {
  const session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  const governed = planGovernedAutomation(session, 'editor', [{ type:'chart.kind', chartId:'revenue-vs-plan', kind:'line' }])
  const approval = approveAutomation(governed, 'ossa')
  const changed = executeVersionedWorkspaceCommand(session, { type:'region.update', regionId:'apac', field:'revenue', value:10 })
  assert.throws(() => executeGovernedAutomation(changed, governed, approval), /plan is stale/)
})

test('automation approval requires an approver identity', () => {
  const session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  const governed = planGovernedAutomation(session, 'editor', [{ type:'chart.kind', chartId:'revenue-vs-plan', kind:'line' }])
  assert.throws(() => approveAutomation(governed, '   '), /approver identity/)
})

test('governed import plans preserve fidelity warnings for preview without changing execution', () => {
  const session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  const warnings = ['Images are not imported yet.', 'Formula values use cached results.']
  const governed = planGovernedAutomation(session, 'owner', [{ type:'region.update', regionId:'apac', field:'revenue', value:10 }], warnings)
  assert.deepEqual(governed.warnings, warnings)
  assert.notEqual(governed.warnings, warnings)
  const next = executeGovernedAutomation(session, governed)
  assert.equal(next.present.regions.find((row) => row.id === 'apac').revenue, 10)
})
