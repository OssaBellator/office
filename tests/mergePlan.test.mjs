import assert from 'node:assert/strict'
import test from 'node:test'
import { cloneSeedWorkspace } from '../src/model.ts'
import { createVersionedWorkspaceSession, executeVersionedWorkspaceCommand } from '../src/versioning.ts'
import { planSemanticMerge } from '../src/mergePlan.ts'

function changed(workspace, command) {
  let session = createVersionedWorkspaceSession(structuredClone(workspace))
  session = executeVersionedWorkspaceCommand(session, command)
  return session.present
}

test('three-way merge auto-merges edits to different semantic fields', () => {
  const base = createVersionedWorkspaceSession(cloneSeedWorkspace()).present
  const ours = changed(base, { type:'region.update', regionId:'apac', field:'revenue', value:10 })
  const theirs = changed(base, { type:'document.update', field:'title', value:'Connected operating layer' })
  const plan = planSemanticMerge(base, ours, theirs)
  assert.equal(plan.canAutoMerge, true)
  assert.equal(plan.autoChanges.some((change) => change.objectId === 'region:apac' && change.side === 'ours'), true)
  assert.equal(plan.autoChanges.some((change) => change.objectId === 'document:strategy' && change.side === 'theirs'), true)
})

test('same semantic change on both branches is not a conflict', () => {
  const base = createVersionedWorkspaceSession(cloneSeedWorkspace()).present
  const command = { type:'decision.status', decisionId:'launch', status:'approved' }
  const plan = planSemanticMerge(base, changed(base, command), changed(base, command))
  assert.equal(plan.canAutoMerge, true)
  assert.equal(plan.sameChanges.some((change) => change.objectId === 'decision:launch' && change.field === 'status'), true)
  assert.equal(plan.conflicts.length, 0)
})

test('different edits to the same semantic field produce a conflict', () => {
  const base = createVersionedWorkspaceSession(cloneSeedWorkspace()).present
  const ours = changed(base, { type:'region.update', regionId:'apac', field:'growth', value:35 })
  const theirs = changed(base, { type:'region.update', regionId:'apac', field:'growth', value:40 })
  const plan = planSemanticMerge(base, ours, theirs)
  assert.equal(plan.canAutoMerge, false)
  assert.deepEqual(plan.conflicts.find((conflict) => conflict.objectId === 'region:apac' && conflict.field === 'growth'), {
    objectId:'region:apac', field:'growth', label:'APAC', base:31, ours:35, theirs:40,
  })
})

test('semantic document review conflicts are detected by annotation identity', () => {
  const base = createVersionedWorkspaceSession(cloneSeedWorkspace()).present
  const ours = changed(base, { type:'annotation.update', annotationId:'annotation:growth-margin-review', field:'owner', value:'Finance' })
  const theirs = changed(base, { type:'annotation.update', annotationId:'annotation:growth-margin-review', field:'owner', value:'Product' })
  const plan = planSemanticMerge(base, ours, theirs)
  assert.equal(plan.conflicts.some((conflict) => conflict.objectId === 'annotation:growth-margin-review' && conflict.field === 'owner'), true)
})

test('chart and story changes can merge when they touch independent semantic objects', () => {
  const base = createVersionedWorkspaceSession(cloneSeedWorkspace()).present
  const ours = changed(base, { type:'chart.kind', chartId:'revenue-vs-plan', kind:'line' })
  const theirs = changed(base, { type:'presentation.scene.visibility', sceneId:'signal', visible:false })
  const plan = planSemanticMerge(base, ours, theirs)
  assert.equal(plan.canAutoMerge, true)
  assert.equal(plan.autoChanges.some((change) => change.objectId === 'chart:revenue-vs-plan'), true)
  assert.equal(plan.autoChanges.some((change) => change.objectId === 'presentation:story'), true)
})
