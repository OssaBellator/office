import assert from 'node:assert/strict'
import test from 'node:test'
import { getMetricFormulaSuggestions, getRelationshipReferenceSummary, listFormulaReferences } from '../src/formulaCatalog.ts'
import { cloneSeedWorkspace } from '../src/model.ts'

test('formula reference catalog exposes typed semantic table fields', () => {
  const references = listFormulaReferences()
  assert.equal(references.some((reference) => reference.tableId === 'Regions' && reference.fieldId === 'Revenue' && reference.type === 'currency'), true)
  assert.equal(references.some((reference) => reference.tableId === 'Plan' && reference.fieldId === 'Revenue' && reference.type === 'currency'), true)
})

test('formula suggestions respect metric semantic format', () => {
  const workspace = cloneSeedWorkspace()
  const revenue = getMetricFormulaSuggestions(workspace, 'revenue')
  assert.equal(revenue.some((suggestion) => suggestion.expression === 'SUM(Regions.Revenue)'), false)
  assert.equal(revenue.some((suggestion) => suggestion.expression === 'AVERAGE(Plan.Revenue)'), true)
  assert.equal(revenue.some((suggestion) => suggestion.expression.includes('Regions.Growth') && !suggestion.expression.includes('WHERE Growth')), false)
})

test('formula catalog surfaces reusable cross-table relationships', () => {
  const relationships = getRelationshipReferenceSummary(cloneSeedWorkspace())
  assert.deepEqual(relationships[0], {
    id: 'relationship:regions-plan',
    label: 'Actuals to plan by region',
    expression: 'Regions.Region ↔ Plan.Region',
    cardinality: 'one-to-one',
  })
})
