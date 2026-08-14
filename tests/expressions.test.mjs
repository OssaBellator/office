import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluateSemanticExpression } from '../src/expressions.ts'
import { cloneSeedWorkspace, workspaceTables } from '../src/model.ts'

test('semantic expressions compose aggregates across typed tables', () => {
  const workspace = cloneSeedWorkspace()
  const result = evaluateSemanticExpression('SUM(Regions.Revenue) - SUM(Plan.Revenue)', workspaceTables(workspace))
  assert.equal(result.value, -2.2)
  assert.equal(result.dimension, 'currency')
  assert.deepEqual(result.dependencies, ['table:Regions', 'field:Regions.Revenue', 'table:Plan', 'field:Plan.Revenue'])
  assert.deepEqual(result.terms.map((term) => term.tableId), ['Regions', 'Plan'])
})

test('semantic expressions support grouping, constants and unary signs', () => {
  const tables = workspaceTables(cloneSeedWorkspace())
  assert.equal(evaluateSemanticExpression('(SUM(Regions.Revenue) - SUM(Plan.Revenue)) + (SUM(Plan.Revenue) - SUM(Regions.Revenue))', tables).value, 0)
  assert.equal(evaluateSemanticExpression('-SUM(Plan.Revenue) + SUM(Regions.Revenue)', tables).value, -2.2)
})

test('semantic expressions support multiplication with precedence and scaling', () => {
  const tables = workspaceTables(cloneSeedWorkspace())
  const scaled = evaluateSemanticExpression('SUM(Regions.Revenue) * 2', tables)
  assert.equal(scaled.value, 85.6)
  assert.equal(scaled.dimension, 'currency')
  assert.equal(evaluateSemanticExpression('2 + 3 * 4', tables).value, 14)
})

test('semantic expressions support same-dimension ratios', () => {
  const tables = workspaceTables(cloneSeedWorkspace())
  const result = evaluateSemanticExpression('SUM(Regions.Revenue) / SUM(Plan.Revenue) * 100', tables)
  assert.equal(result.value, 95.111111111111)
  assert.equal(result.dimension, 'number')
})

test('semantic expressions reject invalid dimensions and division by zero', () => {
  const tables = workspaceTables(cloneSeedWorkspace())
  assert.throws(() => evaluateSemanticExpression('SUM(Regions.Revenue) + AVERAGE(Regions.Growth)', tables), /Cannot add currency and percent/)
  assert.throws(() => evaluateSemanticExpression('SUM(Regions.Revenue) * SUM(Plan.Revenue)', tables), /Cannot multiply currency by currency/)
  assert.throws(() => evaluateSemanticExpression('1 / SUM(Regions.Revenue)', tables), /Cannot divide number by currency/)
  assert.throws(() => evaluateSemanticExpression('SUM(Regions.Revenue) / 0', tables), /Division by zero/)
})
