import assert from 'node:assert/strict'
import test from 'node:test'
import { cloneSeedWorkspace } from '../src/model.ts'
import { previewVersionedCommand } from '../src/semanticPreview.ts'

test('versioned preview supports document edits without mutating source state', () => {
  const workspace = cloneSeedWorkspace()
  const preview = previewVersionedCommand(workspace, { type: 'document.update', field: 'title', value: 'Connected workspace' })
  assert.equal(workspace.document.title.includes('Connected workspace'), false)
  assert.equal(preview.diffs.some((diff) => diff.objectId === 'document:strategy' && diff.field === 'title'), true)
})

test('versioned preview supports formula changes and derived metric values', () => {
  const workspace = cloneSeedWorkspace()
  const preview = previewVersionedCommand(workspace, { type: 'metric.formula', metricId: 'revenue', formula: 'SUM(Regions.Revenue WHERE Region = "APAC")' })
  assert.equal(preview.workspace.metrics.find((metric) => metric.id === 'revenue').value, 8.7)
  assert.equal(preview.diffs.some((diff) => diff.objectId === 'metric:revenue' && diff.field === 'formula'), true)
  assert.equal(preview.diffs.some((diff) => diff.objectId === 'metric:revenue' && diff.field === 'value'), true)
})
