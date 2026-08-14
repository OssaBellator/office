import assert from 'node:assert/strict'
import test from 'node:test'
import { materializeChart } from '../src/charts.ts'
import { cloneSeedWorkspace } from '../src/model.ts'

test('shared chart definition materializes actual and plan series by relationship', () => {
  const chart = materializeChart(cloneSeedWorkspace(), 'revenue-vs-plan')
  assert.equal(chart.definition.label, 'Actual vs plan by region')
  assert.equal(chart.rows.length, 4)
  assert.deepEqual(chart.rows.find((row) => row.category === 'APAC').values, { actual: 8.7, plan: 9.5 })
  assert.equal(chart.maxValue, 19)
})

test('shared chart follows workspace edits without changing its definition', () => {
  const workspace = cloneSeedWorkspace()
  workspace.regions.find((row) => row.id === 'apac').revenue = 11
  workspace.plans.find((row) => row.id === 'apac').revenue = 10
  const chart = materializeChart(workspace, 'revenue-vs-plan')
  assert.deepEqual(chart.rows.find((row) => row.category === 'APAC').values, { actual: 11, plan: 10 })
  assert.equal(chart.definition.id, 'revenue-vs-plan')
})
