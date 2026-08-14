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

test('semantic command sessions undo and redo a connected revenue edit atomically', async () => {
  const { createWorkspaceSession, executeWorkspaceCommand, redoWorkspaceSession, undoWorkspaceSession } = await import('../src/model.ts')
  const initial = cloneSeedWorkspace()
  let session = createWorkspaceSession(initial)

  session = executeWorkspaceCommand(session, {
    type: 'region.update',
    regionId: 'apac',
    field: 'revenue',
    value: 10,
    changedAt: 'now',
  })

  assert.equal(session.present.regions.find((row) => row.id === 'apac').revenue, 10)
  assert.equal(session.present.metrics.find((metric) => metric.id === 'revenue').value, 44.1)
  assert.equal(session.past.length, 1)

  session = undoWorkspaceSession(session)
  assert.equal(session.present.regions.find((row) => row.id === 'apac').revenue, 8.7)
  assert.equal(session.present.metrics.find((metric) => metric.id === 'revenue').value, 42.8)
  assert.equal(session.present.history.length, 0)
  assert.equal(session.future.length, 1)

  session = redoWorkspaceSession(session)
  assert.equal(session.present.regions.find((row) => row.id === 'apac').revenue, 10)
  assert.equal(session.present.metrics.find((metric) => metric.id === 'revenue').value, 44.1)
  assert.equal(session.present.history[0].summary, 'APAC revenue updated')
})

test('a new semantic command after undo clears the redo branch', async () => {
  const { createWorkspaceSession, executeWorkspaceCommand, redoWorkspaceSession, undoWorkspaceSession } = await import('../src/model.ts')
  let session = createWorkspaceSession(cloneSeedWorkspace())
  session = executeWorkspaceCommand(session, {
    type: 'decision.status',
    decisionId: 'launch',
    status: 'approved',
  })
  session = undoWorkspaceSession(session)
  assert.equal(session.future.length, 1)

  session = executeWorkspaceCommand(session, {
    type: 'region.update',
    regionId: 'eu',
    field: 'growth',
    value: 25,
  })
  assert.equal(session.future.length, 0)
  assert.equal(redoWorkspaceSession(session), session)
})

test('AI-style document append is a reversible semantic transaction', async () => {
  const { createWorkspaceSession, executeWorkspaceCommand, undoWorkspaceSession } = await import('../src/model.ts')
  const original = cloneSeedWorkspace()
  let session = createWorkspaceSession(original)

  session = executeWorkspaceCommand(session, {
    type: 'document.append',
    text: 'Evidence: APAC has the strongest regional growth rate.',
  })
  assert.match(session.present.document.body, /Evidence: APAC/)
  assert.equal(session.present.history[0].summary, 'Strategy evidence appended')

  session = undoWorkspaceSession(session)
  assert.equal(session.present.document.body, original.document.body)
})

test('lineage queries expose semantic upstream and downstream objects', async () => {
  const { getObjectLineage, getUpstreamObjectIds } = await import('../src/model.ts')
  const workspace = cloneSeedWorkspace()
  const revenue = getObjectLineage(workspace, 'metric:revenue')

  assert.deepEqual(new Set(revenue.upstream.map((object) => object.id)), new Set([
    'region:na',
    'region:eu',
    'region:apac',
    'region:latam',
  ]))
  assert.equal(revenue.downstream.some((object) => object.id === 'document:strategy'), true)
  assert.equal(revenue.downstream.some((object) => object.id === 'scene:performance'), true)
  assert.equal(getUpstreamObjectIds(workspace.graph, ['scene:decision']).includes('region:apac'), true)
})

test('lineage queries fail for unknown objects', async () => {
  const { getObjectLineage } = await import('../src/model.ts')
  assert.throws(() => getObjectLineage(cloneSeedWorkspace(), 'metric:missing'), /Unknown workspace object/)
})
