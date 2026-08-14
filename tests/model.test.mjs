import assert from 'node:assert/strict'
import test from 'node:test'
import {
  cloneSeedWorkspace,
  formatMetric,
  getDownstreamObjectIds,
  hydrateWorkspace,
  setDecisionStatus,
  updateRegionField,
} from '../src/model.ts'

test('formats shared metrics for presentation surfaces', () => {
  const workspace = cloneSeedWorkspace()
  assert.equal(formatMetric(workspace.metrics.find((metric) => metric.id === 'revenue')), '$42.8M')
  assert.equal(formatMetric(workspace.metrics.find((metric) => metric.id === 'growth')), '17%')
})

test('changing regional revenue recalculates the shared revenue metric', () => {
  const workspace = cloneSeedWorkspace()
  const result = updateRegionField(workspace, 'apac', 'revenue', 10, 'now')
  const revenue = result.workspace.metrics.find((metric) => metric.id === 'revenue')

  assert.equal(revenue.value, 44.1)
  assert.equal(revenue.updatedAt, 'now')
  assert.deepEqual(result.event.changedObjectIds, ['region:apac', 'metric:revenue'])
})

test('revenue mutation reports affected Docs and Present objects', () => {
  const result = updateRegionField(cloneSeedWorkspace(), 'apac', 'revenue', 10)
  const affectedIds = new Set(result.impacts.map((impact) => impact.id))

  assert.equal(affectedIds.has('document:strategy'), true)
  assert.equal(affectedIds.has('scene:performance'), true)
  assert.equal(affectedIds.has('decision:launch'), true)
})

test('decision mutation propagates to strategy and decision scene', () => {
  const result = setDecisionStatus(cloneSeedWorkspace(), 'launch', 'approved', 'now')
  const decision = result.workspace.decisions.find((item) => item.id === 'launch')
  const affectedIds = result.impacts.map((impact) => impact.id)

  assert.equal(decision.status, 'approved')
  assert.equal(affectedIds.includes('document:strategy'), true)
  assert.equal(affectedIds.includes('scene:decision'), true)
  assert.equal(result.workspace.history[0].summary.endsWith('approved'), true)
})

test('dependency traversal is transitive and de-duplicated', () => {
  const workspace = cloneSeedWorkspace()
  const downstream = getDownstreamObjectIds(workspace.graph, ['region:apac'])

  assert.equal(downstream.filter((id) => id === 'document:strategy').length, 1)
  assert.equal(downstream.includes('metric:revenue'), true)
  assert.equal(downstream.includes('decision:launch'), true)
  assert.equal(downstream.includes('scene:performance'), true)
  assert.equal(downstream.includes('scene:decision'), true)
})

test('hydration upgrades legacy localStorage state with graph, provenance and metric definitions', () => {
  const legacyRevenue = cloneSeedWorkspace().metrics.find((metric) => metric.id === 'revenue')
  delete legacyRevenue.formula
  legacyRevenue.value = 99

  const legacy = {
    title: 'Legacy workspace',
    metrics: [legacyRevenue],
    regions: [{ id: 'apac', region: 'APAC', revenue: 5, growth: 10, margin: 50 }],
  }
  const hydrated = hydrateWorkspace(legacy)

  assert.equal(hydrated.title, 'Legacy workspace')
  assert.equal(hydrated.sources.length > 0, true)
  assert.equal(hydrated.graph.edges.length > 0, true)
  assert.deepEqual(hydrated.history, [])
  assert.equal(hydrated.regions[0].revenue, 5)
  assert.equal(hydrated.metrics.find((metric) => metric.id === 'revenue').value, 99)
  assert.equal(hydrated.metrics.find((metric) => metric.id === 'revenue').formula, 'SUM(Regions.Revenue)')
  assert.equal(updateRegionField(hydrated, 'apac', 'revenue', 6).workspace.metrics.find((metric) => metric.id === 'revenue').value, 6)
})

test('unknown object mutations fail loudly', () => {
  assert.throws(() => updateRegionField(cloneSeedWorkspace(), 'moon', 'revenue', 1), /Unknown region/)
  assert.throws(() => setDecisionStatus(cloneSeedWorkspace(), 'missing', 'approved'), /Unknown decision/)
})
