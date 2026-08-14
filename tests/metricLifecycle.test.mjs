import assert from 'node:assert/strict'
import test from 'node:test'
import { deserializeWorkspaceCommand, serializeWorkspaceCommand } from '../src/commandCodec.ts'
import { cloneSeedWorkspace } from '../src/model.ts'
import { canExecuteWorkspaceCommand } from '../src/permissions.ts'
import { previewVersionedCommand } from '../src/semanticPreview.ts'
import { planTransactionRevert, revertVersionedTransaction } from '../src/revert.ts'
import { createVersionedWorkspaceSession, executeVersionedWorkspaceCommand } from '../src/versioning.ts'

function customMetric(overrides = {}) {
  return {
    id:'custom-high-growth-revenue',
    label:'High-growth revenue',
    value:0,
    previous:0,
    format:'currency',
    source:'Semantic model · User-defined metric',
    updatedAt:'just now',
    formula:'SUM(Regions.Revenue WHERE Growth >= 20)',
    ...overrides,
  }
}

test('metric creation previews calculated value and semantic object addition', () => {
  const session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  const preview = previewVersionedCommand(session.present, { type:'metric.create', metric:customMetric() })
  const metric = preview.workspace.metrics.find((item) => item.id === 'custom-high-growth-revenue')
  assert.ok(metric)
  assert.equal(metric.value, 20.6)
  assert.equal(preview.diffs.some((diff) => diff.objectId === 'metric:custom-high-growth-revenue' && diff.change === 'added'), true)
  assert.equal(preview.workspace.graph.objects.some((object) => object.id === 'metric:custom-high-growth-revenue'), true)
  assert.equal(preview.workspace.graph.edges.filter((edge) => edge.to === 'metric:custom-high-growth-revenue' && edge.relation === 'derives').length, 4)
})

test('custom formula metrics recompute after source fields change', () => {
  let session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  session = executeVersionedWorkspaceCommand(session, { type:'metric.create', metric:customMetric() })
  session = executeVersionedWorkspaceCommand(session, { type:'region.update', regionId:'na', field:'growth', value:24 })
  assert.equal(session.present.metrics.find((metric) => metric.id === 'custom-high-growth-revenue').value, 39.2)
})

test('metric creation rejects duplicate ids and incompatible dimensions', () => {
  const session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  assert.throws(() => executeVersionedWorkspaceCommand(session, { type:'metric.create', metric:customMetric({ id:'revenue' }) }), /Metric already exists/)
  assert.throws(() => executeVersionedWorkspaceCommand(session, { type:'metric.create', metric:customMetric({ id:'custom-bad', format:'currency', formula:'AVERAGE(Regions.Growth)' }) }), /currency but the formula produces percent/)
})

test('unused custom metrics can be removed while shared consumed metrics are protected', () => {
  let session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  session = executeVersionedWorkspaceCommand(session, { type:'metric.create', metric:customMetric() })
  session = executeVersionedWorkspaceCommand(session, { type:'metric.remove', metricId:'custom-high-growth-revenue' })
  assert.equal(session.present.metrics.some((metric) => metric.id === 'custom-high-growth-revenue'), false)
  assert.throws(() => executeVersionedWorkspaceCommand(session, { type:'metric.remove', metricId:'revenue' }), /still used by/)
})

test('metric creation reverts by removing an unchanged unused custom metric', () => {
  let session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  session = executeVersionedWorkspaceCommand(session, { type:'metric.create', metric:customMetric() })
  const created = session.past.at(-1)
  const plan = planTransactionRevert(session, created.id)
  assert.equal(plan.canRevert, true)
  assert.equal(plan.inverseCommand.type, 'metric.remove')
  session = revertVersionedTransaction(session, created.id).session
  assert.equal(session.present.metrics.some((metric) => metric.id === 'custom-high-growth-revenue'), false)
})

test('metric removal reverts by restoring the original definition', () => {
  let session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  session = executeVersionedWorkspaceCommand(session, { type:'metric.create', metric:customMetric() })
  session = executeVersionedWorkspaceCommand(session, { type:'metric.remove', metricId:'custom-high-growth-revenue' })
  const removed = session.past.at(-1)
  const reverted = revertVersionedTransaction(session, removed.id)
  assert.equal(reverted.plan.canRevert, true)
  const metric = reverted.session.present.metrics.find((item) => item.id === 'custom-high-growth-revenue')
  assert.equal(metric.formula, 'SUM(Regions.Revenue WHERE Growth >= 20)')
  assert.equal(metric.value, 20.6)
})

test('metric lifecycle commands round-trip through the runtime command codec', () => {
  const create = { type:'metric.create', metric:customMetric() }
  assert.deepEqual(deserializeWorkspaceCommand(serializeWorkspaceCommand(create)), create)
  const remove = { type:'metric.remove', metricId:'custom-high-growth-revenue' }
  assert.deepEqual(deserializeWorkspaceCommand(serializeWorkspaceCommand(remove)), remove)
})

test('metric lifecycle follows Data capability permissions', () => {
  const command = { type:'metric.create', metric:customMetric() }
  assert.equal(canExecuteWorkspaceCommand('owner', command), true)
  assert.equal(canExecuteWorkspaceCommand('editor', command), true)
  assert.equal(canExecuteWorkspaceCommand('reviewer', command), false)
  assert.equal(canExecuteWorkspaceCommand('viewer', command), false)
})
