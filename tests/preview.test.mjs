import assert from 'node:assert/strict'
import test from 'node:test'
import { previewWorkspaceCommand } from '../src/commandPreview.ts'
import { cloneSeedWorkspace } from '../src/model.ts'

test('revenue preview exposes direct and derived semantic diffs without mutating source state', () => {
  const workspace = cloneSeedWorkspace()
  const preview = previewWorkspaceCommand(workspace, {
    type: 'region.update',
    regionId: 'apac',
    field: 'revenue',
    value: 10,
    changedAt: 'now',
  })

  assert.equal(workspace.regions.find((row) => row.id === 'apac').revenue, 8.7)
  assert.equal(workspace.metrics.find((metric) => metric.id === 'revenue').value, 42.8)
  assert.deepEqual(preview.diffs.map((diff) => [diff.objectId, diff.field, diff.before, diff.after]), [
    ['region:apac', 'revenue', 8.7, 10],
    ['metric:revenue', 'value', 42.8, 44.1],
  ])
  assert.equal(preview.impacts.some((impact) => impact.id === 'document:strategy'), true)
  assert.equal(preview.impacts.some((impact) => impact.id === 'scene:performance'), true)
})

test('decision preview reports status diff and downstream surfaces', () => {
  const preview = previewWorkspaceCommand(cloneSeedWorkspace(), {
    type: 'decision.status',
    decisionId: 'launch',
    status: 'approved',
  })

  assert.deepEqual(preview.diffs.map((diff) => [diff.objectId, diff.field, diff.before, diff.after]), [
    ['decision:launch', 'status', 'pending', 'approved'],
  ])
  assert.equal(preview.impacts.some((impact) => impact.id === 'document:strategy'), true)
  assert.equal(preview.impacts.some((impact) => impact.id === 'scene:decision'), true)
})

test('document append preview reports the proposed addition as one semantic diff', () => {
  const workspace = cloneSeedWorkspace()
  const text = 'Evidence: APAC has the strongest regional growth rate.'
  const preview = previewWorkspaceCommand(workspace, { type: 'document.append', text })

  assert.equal(workspace.document.body.includes(text), false)
  assert.deepEqual(preview.diffs, [{
    objectId: 'document:strategy',
    label: 'Strategy document',
    field: 'append',
    before: null,
    after: text,
  }])
})
