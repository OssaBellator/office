import assert from 'node:assert/strict'
import test from 'node:test'
import { cloneSeedWorkspace } from '../src/model.ts'
import { validateMetricFormula } from '../src/semanticCommands.ts'

test('currency metrics reject dimensionless ratios even when both inputs are currency', () => {
  const workspace = cloneSeedWorkspace()
  assert.throws(
    () => validateMetricFormula(workspace, 'revenue', 'SUM(Regions.Revenue) / SUM(Plan.Revenue) * 100'),
    /currency but the formula produces number/,
  )
})

test('percent metrics can use a same-dimension ratio expressed as a dimensionless percentage value', () => {
  const workspace = cloneSeedWorkspace()
  const result = validateMetricFormula(workspace, 'growth', 'SUM(Regions.Revenue) / SUM(Plan.Revenue) * 100')
  assert.equal(result.dimension, 'number')
  assert.equal(result.value, 95.111111111111)
})

test('currency metrics accept scalar multiplication that preserves currency dimension', () => {
  const workspace = cloneSeedWorkspace()
  const result = validateMetricFormula(workspace, 'revenue', 'SUM(Regions.Revenue) * 2')
  assert.equal(result.dimension, 'currency')
  assert.equal(result.value, 85.6)
})
