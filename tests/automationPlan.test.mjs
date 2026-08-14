import assert from 'node:assert/strict'
import test from 'node:test'
import { cloneSeedWorkspace } from '../src/model.ts'
import { createVersionedWorkspaceSession } from '../src/versioning.ts'
import { executeWorkspaceAutomation, planWorkspaceAutomation } from '../src/automationPlan.ts'

test('automation planning simulates multiple commands without mutating the supplied session', () => {
  const session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  const plan = planWorkspaceAutomation(session, 'editor', [
    { type:'region.update', regionId:'apac', field:'revenue', value:10 },
    { type:'presentation.note.update', sceneId:'performance', note:'Lead with the revenue change.' },
  ])
  assert.equal(session.past.length, 0)
  assert.equal(session.present.regions.find((row) => row.id === 'apac').revenue, 8.7)
  assert.equal(plan.resultingSession.past.length, 2)
  assert.equal(plan.steps.length, 2)
})

test('automation plan exposes cumulative semantic diffs and deduplicated downstream impacts', () => {
  const session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  const plan = planWorkspaceAutomation(session, 'editor', [
    { type:'region.update', regionId:'apac', field:'revenue', value:10 },
    { type:'chart.kind', chartId:'revenue-vs-plan', kind:'line' },
  ])
  assert.equal(plan.diffs.some((diff) => diff.objectId === 'region:apac' && diff.field === 'revenue'), true)
  assert.equal(plan.diffs.some((diff) => diff.objectId === 'chart:revenue-vs-plan' && diff.field === 'kind'), true)
  assert.equal(new Set(plan.impacts.map((impact) => impact.id)).size, plan.impacts.length)
  assert.equal(plan.impacts.some((impact) => impact.id === 'scene:performance'), true)
})

test('automation planning evaluates readiness before and after review actions', () => {
  const session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  const plan = planWorkspaceAutomation(session, 'reviewer', [
    { type:'annotation.update', annotationId:'annotation:launch-approval', field:'status', value:'approved' },
  ])
  assert.equal(plan.readinessBefore.readyForReview, false)
  assert.equal(plan.readinessAfter.readyForReview, true)
})

test('automation plan rejects any unauthorized step before returning a plan', () => {
  const session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  assert.throws(() => planWorkspaceAutomation(session, 'reviewer', [
    { type:'decision.status', decisionId:'launch', status:'approved' },
    { type:'region.update', regionId:'apac', field:'revenue', value:10 },
  ]), /reviewer role cannot execute data/)
})

test('executing an accepted automation preserves one semantic revision per step', () => {
  const session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  const commands = [
    { type:'annotation.update', annotationId:'annotation:growth-margin-review', field:'status', value:'resolved' },
    { type:'annotation.update', annotationId:'annotation:launch-approval', field:'status', value:'approved' },
    { type:'decision.status', decisionId:'launch', status:'approved' },
  ]
  const next = executeWorkspaceAutomation(session, 'reviewer', commands)
  assert.equal(next.past.length, 3)
  assert.deepEqual(next.past.map((transaction) => transaction.revision), [1,2,3])
  assert.equal(next.present.decisions[0].status, 'approved')
})
