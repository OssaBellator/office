import assert from 'node:assert/strict'
import test from 'node:test'
import { cloneSeedWorkspace } from '../src/model.ts'
import { createVersionedWorkspaceSession } from '../src/versioning.ts'
import { planWorkspaceAutomation } from '../src/automationPlan.ts'
import { assessAutomationGovernance } from '../src/automationGovernance.ts'

test('small non-destructive editor automation can remain low risk', () => {
  const session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  const plan = planWorkspaceAutomation(session, 'editor', [
    { type:'region.update', regionId:'apac', field:'revenue', value:10 },
  ])
  assert.deepEqual(assessAutomationGovernance(plan), { risk:'low', requiresApproval:false, reasons:[] })
})

test('formula and provenance changes are high-risk approval-required automation', () => {
  const session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  const formulaPlan = planWorkspaceAutomation(session, 'editor', [{ type:'metric.formula', metricId:'revenue', formula:'SUM(Regions.Revenue) * 2' }])
  const formulaDecision = assessAutomationGovernance(formulaPlan)
  assert.equal(formulaDecision.risk, 'high')
  assert.equal(formulaDecision.requiresApproval, true)

  const provenancePlan = planWorkspaceAutomation(session, 'owner', [{ type:'source.status', sourceId:'source:finance', status:'stale' }])
  const provenanceDecision = assessAutomationGovernance(provenancePlan)
  assert.equal(provenanceDecision.risk, 'high')
  assert.equal(provenanceDecision.reasons.some((reason) => /Provenance/.test(reason)), true)
})

test('decision chart and scene visibility changes are medium-risk', () => {
  const session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  const plan = planWorkspaceAutomation(session, 'editor', [
    { type:'chart.kind', chartId:'revenue-vs-plan', kind:'line' },
    { type:'presentation.scene.visibility', sceneId:'signal', visible:false },
  ])
  const decision = assessAutomationGovernance(plan)
  assert.equal(decision.risk, 'medium')
  assert.equal(decision.requiresApproval, true)
})

test('plans that worsen semantic readiness become high risk regardless of command type', () => {
  const session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  const plan = planWorkspaceAutomation(session, 'editor', [
    { type:'region.update', regionId:'eu', field:'growth', value:40 },
  ])
  const decision = assessAutomationGovernance(plan)
  assert.equal(plan.readinessAfter.errors > plan.readinessBefore.errors, true)
  assert.equal(decision.risk, 'high')
  assert.equal(decision.requiresApproval, true)
})

test('large multi-step plans are escalated even when individual commands are low risk', () => {
  const session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  const plan = planWorkspaceAutomation(session, 'editor', [
    { type:'region.update', regionId:'na', field:'revenue', value:19 },
    { type:'region.update', regionId:'eu', field:'revenue', value:12 },
    { type:'region.update', regionId:'apac', field:'revenue', value:9 },
    { type:'region.update', regionId:'latam', field:'revenue', value:4 },
    { type:'plan.update', planId:'na', field:'revenue', value:19.5 },
    { type:'plan.update', planId:'eu', field:'revenue', value:12.8 },
  ])
  const decision = assessAutomationGovernance(plan)
  assert.equal(decision.risk, 'medium')
  assert.equal(decision.reasons.some((reason) => /6 semantic steps/.test(reason)), true)
})
