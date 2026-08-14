import assert from 'node:assert/strict'
import test from 'node:test'
import { getMetricFormulaSuggestions } from '../src/formulaCatalog.ts'
import { cloneSeedWorkspace } from '../src/model.ts'
import { buildPresentationScenes } from '../src/presentationModel.ts'
import { getSemanticDocument } from '../src/semanticDocument.ts'
import { createVersionedWorkspaceSession, executeVersionedWorkspaceCommand, hydrateVersionedWorkspaceSession } from '../src/versioning.ts'
import { REVENUE_ATTAINMENT_FORMULA, REVENUE_ATTAINMENT_METRIC_ID } from '../src/workspaceKpis.ts'

test('versioned sessions materialize revenue attainment as a shared semantic KPI', () => {
  const session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  const metric = session.present.metrics.find((item) => item.id === REVENUE_ATTAINMENT_METRIC_ID)
  assert.ok(metric)
  assert.equal(metric.formula, REVENUE_ATTAINMENT_FORMULA)
  assert.equal(metric.value, 95.111111111111)
  assert.equal(metric.format, 'percent')
  assert.equal(session.present.graph.objects.some((object) => object.id === 'metric:attainment'), true)
  assert.equal(session.present.graph.edges.some((edge) => edge.from === 'metric:attainment' && edge.to === 'scene:performance'), true)
})

test('default semantic business snapshot includes revenue attainment after session materialization', () => {
  const session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  const snapshot = getSemanticDocument(session.present).blocks.find((block) => block.id === 'block:business-snapshot')
  assert.equal(snapshot.type, 'metric-embed')
  assert.equal(snapshot.metricIds.includes('attainment'), true)
})

test('actual and plan edits recompute revenue attainment through the generic formula engine', () => {
  let session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  session = executeVersionedWorkspaceCommand(session, { type:'region.update', regionId:'apac', field:'revenue', value:10 })
  assert.equal(session.present.metrics.find((metric) => metric.id === 'attainment').value, 98)
  session = executeVersionedWorkspaceCommand(session, { type:'plan.update', planId:'apac', field:'revenue', value:10.5 })
  assert.equal(session.present.metrics.find((metric) => metric.id === 'attainment').value, 95.869565217391)
})

test('legacy session hydration gains attainment without dropping existing workspace state', () => {
  const legacy = cloneSeedWorkspace()
  legacy.document.title = 'Legacy strategy'
  const hydrated = hydrateVersionedWorkspaceSession({ present:legacy, past:[], future:[], ledger:[], nextRevision:1 })
  assert.equal(hydrated.present.document.title, 'Legacy strategy')
  assert.equal(hydrated.present.metrics.some((metric) => metric.id === 'attainment'), true)
})

test('performance narrative consumes the same live attainment KPI', () => {
  const session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  const performance = buildPresentationScenes(session.present).find((scene) => scene.id === 'performance')
  assert.match(performance.title, /95\.1% of plan/)
  assert.match(performance.note, /95\.1% attainment/)
})

test('percent metric formula catalog includes ratio-based attainment expressions', () => {
  const session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  const suggestions = getMetricFormulaSuggestions(session.present, 'growth')
  assert.equal(suggestions.some((item) => item.expression === REVENUE_ATTAINMENT_FORMULA), true)
})
