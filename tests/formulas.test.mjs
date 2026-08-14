import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluateSemanticFormula, parseSemanticFormula } from '../src/formulas.ts'
import { cloneSeedWorkspace, evaluateMetric, regionsTable } from '../src/model.ts'

test('parses semantic formulas without cell coordinates', () => {
  assert.deepEqual(parseSemanticFormula('SUM(Regions.Revenue)'), {
    fn: 'SUM',
    tableId: 'Regions',
    fieldId: 'Revenue',
  })
})

test('evaluates sum, average, min, max and count over typed table fields', () => {
  const table = regionsTable(cloneSeedWorkspace())
  assert.equal(evaluateSemanticFormula('SUM(Regions.Revenue)', [table]).value, 42.8)
  assert.equal(evaluateSemanticFormula('AVERAGE(Regions.Growth)', [table]).value, 21)
  assert.equal(evaluateSemanticFormula('MIN(Regions.Margin)', [table]).value, 66.7)
  assert.equal(evaluateSemanticFormula('MAX(Regions.Growth)', [table]).value, 31)
  assert.equal(evaluateSemanticFormula('COUNT(Regions.Region)', [table]).value, 4)
})

test('workspace revenue is defined by a semantic formula', () => {
  const workspace = cloneSeedWorkspace()
  const result = evaluateMetric(workspace, 'revenue')
  assert.equal(workspace.metrics.find((metric) => metric.id === 'revenue').formula, 'SUM(Regions.Revenue)')
  assert.equal(result.value, 42.8)
  assert.deepEqual(result.dependencies, ['table:Regions', 'field:Regions.Revenue'])
})

test('formula errors identify invalid semantic references', () => {
  const table = regionsTable(cloneSeedWorkspace())
  assert.throws(() => evaluateSemanticFormula('SUM(Missing.Revenue)', [table]), /Unknown table/)
  assert.throws(() => evaluateSemanticFormula('SUM(Regions.Missing)', [table]), /Unknown field/)
  assert.throws(() => evaluateSemanticFormula('SUM(Regions.Region)', [table]), /numeric field/)
  assert.throws(() => parseSemanticFormula('=SUM(B2:B5)'), /Unsupported formula/)
})

test('semantic formulas support string and numeric WHERE filters', () => {
  const table = regionsTable(cloneSeedWorkspace())
  assert.equal(evaluateSemanticFormula('SUM(Regions.Revenue WHERE Region = "APAC")', [table]).value, 8.7)
  assert.equal(evaluateSemanticFormula('AVERAGE(Regions.Margin WHERE Growth >= 20)', [table]).value, 69.5)
  assert.equal(evaluateSemanticFormula('COUNT(Regions.Region WHERE Margin < 70)', [table]).value, 2)
})

test('semantic filters support AND and expose filter dependencies', () => {
  const table = regionsTable(cloneSeedWorkspace())
  const result = evaluateSemanticFormula('SUM(Regions.Revenue WHERE Growth >= 18 AND Margin < 71)', [table])
  assert.equal(result.value, 24.2)
  assert.equal(result.matchedRows, 3)
  assert.deepEqual(result.dependencies, [
    'table:Regions',
    'field:Regions.Revenue',
    'field:Regions.Growth',
    'field:Regions.Margin',
  ])
})

test('invalid semantic filter references fail loudly', () => {
  const table = regionsTable(cloneSeedWorkspace())
  assert.throws(() => evaluateSemanticFormula('SUM(Regions.Revenue WHERE Missing = 1)', [table]), /Unknown filter field/)
  assert.throws(() => evaluateSemanticFormula('SUM(Regions.Revenue WHERE Region > 1)', [table]), /Numeric filter requires a numeric field/)
})
