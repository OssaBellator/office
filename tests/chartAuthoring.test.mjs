import assert from 'node:assert/strict'
import test from 'node:test'
import { getEditableChart } from '../src/chartModel.ts'
import { materializeChart } from '../src/charts.ts'
import { parsePaletteIntent } from '../src/intent.ts'
import { cloneSeedWorkspace } from '../src/model.ts'
import { previewVersionedCommand } from '../src/semanticPreview.ts'
import { planTransactionRevert, revertVersionedTransaction } from '../src/revert.ts'
import { createVersionedWorkspaceSession, executeVersionedWorkspaceCommand } from '../src/versioning.ts'

test('shared chart kind is a previewable semantic change with downstream impact', () => {
  const session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  const preview = previewVersionedCommand(session.present, { type: 'chart.kind', chartId: 'revenue-vs-plan', kind: 'line' })
  assert.equal(getEditableChart(preview.workspace, 'revenue-vs-plan').kind, 'line')
  assert.equal(preview.diffs.some((diff) => diff.objectId === 'chart:revenue-vs-plan' && diff.field === 'kind' && diff.after === 'line'), true)
  assert.equal(preview.impacts.some((impact) => impact.id === 'scene:performance'), true)
})

test('chart kind persists through the relationship materializer and can be reverted', () => {
  let session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  session = executeVersionedWorkspaceCommand(session, { type: 'chart.kind', chartId: 'revenue-vs-plan', kind: 'line' })
  const transaction = session.past.at(-1)
  assert.equal(String(materializeChart(session.present, 'revenue-vs-plan').definition.kind), 'line')
  const reverted = revertVersionedTransaction(session, transaction.id)
  assert.equal(reverted.plan.canRevert, true)
  assert.equal(getEditableChart(reverted.session.present, 'revenue-vs-plan').kind, 'grouped-bar')
  assert.equal(reverted.session.past.at(-1).kind, 'revert')
})

test('chart revert refuses to overwrite a later chart-kind edit', () => {
  let session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  session = executeVersionedWorkspaceCommand(session, { type: 'chart.kind', chartId: 'revenue-vs-plan', kind: 'line' })
  const first = session.past.at(-1)
  session = executeVersionedWorkspaceCommand(session, { type: 'chart.kind', chartId: 'revenue-vs-plan', kind: 'grouped-bar' })
  const plan = planTransactionRevert(session, first.id)
  assert.equal(plan.canRevert, false)
  assert.match(plan.conflicts[0].message, /changed again/)
})

test('command palette can author the shared chart representation', () => {
  const workspace = cloneSeedWorkspace()
  assert.deepEqual(parsePaletteIntent('set actual vs plan chart to line', workspace), {
    kind: 'command',
    label: 'Change Actual vs plan by region to line',
    command: { type: 'chart.kind', chartId: 'revenue-vs-plan', kind: 'line' },
  })
  assert.equal(parsePaletteIntent('/chart grouped bars', workspace).command.kind, 'grouped-bar')
})
