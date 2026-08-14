import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluateWorkspaceFormula, cloneSeedWorkspace, updateRegionField } from '../src/model.ts'
import { getObjectLineage } from '../src/model.ts'
import { createVersionedWorkspaceSession, executeVersionedWorkspaceCommand } from '../src/versioning.ts'
import { REVENUE_ATTAINMENT_FORMULA } from '../src/workspaceKpis.ts'

function metric(id, label, format, formula) {
  return { id, label, value:0, previous:0, format, source:'Semantic model · test', updatedAt:'just now', formula }
}

test('semantic expressions resolve canonical metric references with dimensions', () => {
  const workspace = createVersionedWorkspaceSession(cloneSeedWorkspace()).present
  const result = evaluateWorkspaceFormula(workspace, 'METRIC(revenue) - METRIC(planRevenue)')
  assert.equal(result.value, -2.2)
  assert.equal(result.dimension, 'currency')
  assert.deepEqual(result.metricDependencies, ['revenue','planRevenue'])
  assert.equal(result.dependencies.includes('metric:revenue'), true)
  assert.equal(result.dependencies.includes('metric:planRevenue'), true)
})

test('revenue attainment is migrated to canonical metric composition and lineage', () => {
  const workspace = createVersionedWorkspaceSession(cloneSeedWorkspace()).present
  const attainment = workspace.metrics.find((item) => item.id === 'attainment')
  assert.equal(attainment.formula, REVENUE_ATTAINMENT_FORMULA)
  const lineage = getObjectLineage(workspace, 'metric:attainment')
  assert.equal(lineage.incoming.some((edge) => edge.from === 'metric:revenue'), true)
  assert.equal(lineage.incoming.some((edge) => edge.from === 'metric:planRevenue'), true)
  assert.equal(lineage.incoming.some((edge) => edge.from.startsWith('region:')), false)
})

test('custom metrics can compose canonical metrics and create metric dependency edges', () => {
  let session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  session = executeVersionedWorkspaceCommand(session, { type:'metric.create', metric:metric('custom-gap','Revenue gap','currency','METRIC(revenue) - METRIC(planRevenue)') })
  const gap = session.present.metrics.find((item) => item.id === 'custom-gap')
  assert.equal(gap.value, -2.2)
  const incoming = session.present.graph.edges.filter((edge) => edge.to === 'metric:custom-gap' && edge.relation === 'derives')
  assert.deepEqual(new Set(incoming.map((edge) => edge.from)), new Set(['metric:revenue','metric:planRevenue']))
})

test('row edits recursively recompute metric dependency chains', () => {
  let session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  session = executeVersionedWorkspaceCommand(session, { type:'metric.create', metric:metric('custom-gap','Revenue gap','currency','METRIC(revenue) - METRIC(planRevenue)') })
  session = executeVersionedWorkspaceCommand(session, { type:'metric.create', metric:metric('custom-gap-abs','Scaled gap','currency','METRIC(custom-gap) * 2') })
  session = executeVersionedWorkspaceCommand(session, { type:'region.update', regionId:'apac', field:'revenue', value:10 })
  assert.equal(session.present.metrics.find((item) => item.id === 'revenue').value, 44.1)
  assert.equal(session.present.metrics.find((item) => item.id === 'custom-gap').value, -0.9)
  assert.equal(session.present.metrics.find((item) => item.id === 'custom-gap-abs').value, -1.8)
})

test('legacy model row mutation also recomputes metric-reference formulas', () => {
  let workspace = createVersionedWorkspaceSession(cloneSeedWorkspace()).present
  workspace = updateRegionField(workspace, 'apac', 'revenue', 10).workspace
  assert.equal(workspace.metrics.find((metric) => metric.id === 'attainment').value, 98)
})

test('metric dependency cycles are rejected during formula preview', () => {
  let session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  session = executeVersionedWorkspaceCommand(session, { type:'metric.create', metric:metric('custom-a','Metric A','currency','METRIC(revenue)') })
  session = executeVersionedWorkspaceCommand(session, { type:'metric.create', metric:metric('custom-b','Metric B','currency','METRIC(custom-a)') })
  assert.throws(
    () => executeVersionedWorkspaceCommand(session, { type:'metric.formula', metricId:'custom-a', formula:'METRIC(custom-b)' }),
    /Circular metric dependency: custom-a -> custom-b -> custom-a/,
  )
})

test('a metric cannot be removed while another metric depends on it', () => {
  let session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  session = executeVersionedWorkspaceCommand(session, { type:'metric.create', metric:metric('custom-a','Metric A','currency','METRIC(revenue)') })
  session = executeVersionedWorkspaceCommand(session, { type:'metric.create', metric:metric('custom-b','Metric B','currency','METRIC(custom-a)') })
  assert.throws(() => executeVersionedWorkspaceCommand(session, { type:'metric.remove', metricId:'custom-a' }), /still used by metric:custom-b/)
})
