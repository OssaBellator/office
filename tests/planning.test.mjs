import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluateSemanticFormula } from '../src/formulas.ts'
import { cloneSeedWorkspace, evaluateMetric, planTable, workspaceTables } from '../src/model.ts'
import { parsePaletteIntent } from '../src/intent.ts'
import { revertVersionedTransaction } from '../src/revert.ts'
import { createVersionedWorkspaceSession, executeVersionedWorkspaceCommand } from '../src/versioning.ts'

test('workspace exposes a second typed Plan table and computed plan metric', () => {
  const workspace = cloneSeedWorkspace()
  assert.equal(planTable(workspace).schema.id, 'Plan')
  assert.deepEqual(workspaceTables(workspace).map((table) => table.schema.id), ['Regions', 'Plan'])
  assert.equal(evaluateMetric(workspace, 'planRevenue').value, 45)
  assert.equal(evaluateMetric(workspace, 'variance').value, -2.2)
  assert.equal(evaluateSemanticFormula('SUM(Plan.Revenue WHERE Region = "APAC")', workspaceTables(workspace)).value, 9.5)
})

test('plan edits recalculate the shared plan metric as one versioned transaction', () => {
  let session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  session = executeVersionedWorkspaceCommand(session, { type: 'plan.update', planId: 'apac', field: 'revenue', value: 10.5 })
  assert.equal(session.present.metrics.find((metric) => metric.id === 'planRevenue').value, 46)
  assert.equal(session.present.metrics.find((metric) => metric.id === 'variance').value, -3.2)
  assert.deepEqual(session.present.history[0].changedObjectIds, ['plan:apac', 'metric:planRevenue', 'metric:variance', 'metric:attainment'])
  assert.equal(session.past.at(-1).revision, 1)
})

test('plan edit can be reverted without disturbing actual revenue', () => {
  let session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  const actual = session.present.metrics.find((metric) => metric.id === 'revenue').value
  session = executeVersionedWorkspaceCommand(session, { type: 'plan.update', planId: 'eu', field: 'revenue', value: 14 })
  const target = session.past.at(-1)
  const reverted = revertVersionedTransaction(session, target.id)
  assert.equal(reverted.plan.canRevert, true)
  assert.equal(reverted.session.present.metrics.find((metric) => metric.id === 'planRevenue').value, 45)
  assert.equal(reverted.session.present.metrics.find((metric) => metric.id === 'revenue').value, actual)
})

test('typed command surface can update a regional revenue plan', () => {
  const workspace = cloneSeedWorkspace()
  assert.deepEqual(parsePaletteIntent('set APAC plan to 10.5', workspace), { kind: 'command', label: 'Update APAC revenue plan', command: { type: 'plan.update', planId: 'apac', field: 'revenue', value: 10.5 } })
})
