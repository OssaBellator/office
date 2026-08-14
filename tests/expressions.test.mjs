import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluateSemanticExpression } from '../src/expressions.ts'
import { cloneSeedWorkspace, workspaceTables } from '../src/model.ts'

test('semantic expressions compose aggregates across typed tables', () => {
  const workspace = cloneSeedWorkspace()
  const result = evaluateSemanticExpression('SUM(Regions.Revenue) - SUM(Plan.Revenue)', workspaceTables(workspace))
  assert.equal(result.value, -2.2)
  assert.deepEqual(result.dependencies, ['table:Regions', 'field:Regions.Revenue', 'table:Plan', 'field:Plan.Revenue'])
  assert.deepEqual(result.terms.map((term) => term.tableId), ['Regions', 'Plan'])
})

test('semantic expressions support grouping, constants and unary signs', () => {
  const tables = workspaceTables(cloneSeedWorkspace())
  assert.equal(evaluateSemanticExpression('(SUM(Regions.Revenue) - SUM(Plan.Revenue)) + 2.2', tables).value, 0)
  assert.equal(evaluateSemanticExpression('-SUM(Plan.Revenue) + SUM(Regions.Revenue)', tables).value, -2.2)
})

test('semantic expressions reject unsupported multiplicative syntax', () => {
  const tables = workspaceTables(cloneSeedWorkspace())
  assert.throws(() => evaluateSemanticExpression('SUM(Regions.Revenue) * 2', tables), /Unsupported expression/)
})
