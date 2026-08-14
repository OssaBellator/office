import assert from 'node:assert/strict'
import test from 'node:test'
import { cloneSeedWorkspace } from '../src/model.ts'
import {
  createVersionedWorkspaceSession,
  executeVersionedWorkspaceCommand,
  hydrateVersionedWorkspaceSession,
  redoVersionedWorkspaceSession,
  undoVersionedWorkspaceSession,
} from '../src/versioning.ts'
import { compareWorkspaceStates } from '../src/workspaceCompare.ts'
import { planTransactionRevert, revertVersionedTransaction } from '../src/revert.ts'

test('transaction and event IDs remain monotonic across undo branches', () => {
  let session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  session = executeVersionedWorkspaceCommand(session, { type: 'decision.status', decisionId: 'launch', status: 'approved' })
  const firstId = session.past[0].id
  assert.match(firstId, /^transaction:/)
  assert.match(session.present.history[0].id, /^event:/)
  assert.equal(session.past[0].revision, 1)

  session = undoVersionedWorkspaceSession(session)
  session = executeVersionedWorkspaceCommand(session, { type: 'region.update', regionId: 'eu', field: 'growth', value: 25 })
  assert.match(session.past[0].id, /^transaction:/)
  assert.notEqual(session.past[0].id, firstId)
  assert.equal(session.past[0].revision, 2)
  assert.equal(session.nextRevision, 3)
})

test('undo and redo preserve the next stable revision', () => {
  let session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  session = executeVersionedWorkspaceCommand(session, { type: 'region.update', regionId: 'apac', field: 'revenue', value: 10 })
  session = undoVersionedWorkspaceSession(session)
  assert.equal(session.nextRevision, 2)
  session = redoVersionedWorkspaceSession(session)
  assert.equal(session.nextRevision, 2)
})

test('no-op structured commands do not create history', () => {
  const session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  const unchanged = executeVersionedWorkspaceCommand(session, { type: 'region.update', regionId: 'apac', field: 'revenue', value: 8.7 })
  assert.equal(unchanged, session)
})

test('arbitrary workspace comparison reports semantic object changes', () => {
  const before = cloneSeedWorkspace()
  const after = cloneSeedWorkspace()
  after.document.title = 'A better strategy'
  after.regions.find((row) => row.id === 'apac').revenue = 10
  after.decisions[0].status = 'approved'
  const diffs = compareWorkspaceStates(before, after)

  assert.equal(diffs.some((diff) => diff.objectId === 'document:strategy' && diff.field === 'title'), true)
  assert.equal(diffs.some((diff) => diff.objectId === 'region:apac' && diff.field === 'revenue'), true)
  assert.equal(diffs.some((diff) => diff.objectId === 'decision:launch' && diff.field === 'status'), true)
})

test('an applied region transaction can be reverted as a new transaction', () => {
  let session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  session = executeVersionedWorkspaceCommand(session, { type: 'region.update', regionId: 'apac', field: 'revenue', value: 10 })
  const target = session.past[0]
  const reverted = revertVersionedTransaction(session, target.id)

  assert.equal(reverted.plan.canRevert, true)
  assert.equal(reverted.session.present.regions.find((row) => row.id === 'apac').revenue, 8.7)
  assert.equal(reverted.session.present.metrics.find((metric) => metric.id === 'revenue').value, 42.8)
  assert.equal(reverted.session.past.at(-1).kind, 'revert')
  assert.equal(reverted.session.past.at(-1).reverts, target.id)
  assert.equal(reverted.session.past.at(-1).revision, 2)
  assert.notEqual(reverted.session.past.at(-1).id, target.id)
})

test('revert detects field-level conflicts instead of overwriting later work', () => {
  let session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  session = executeVersionedWorkspaceCommand(session, { type: 'region.update', regionId: 'apac', field: 'growth', value: 35 })
  const first = session.past[0]
  session = executeVersionedWorkspaceCommand(session, { type: 'region.update', regionId: 'apac', field: 'growth', value: 40 })
  const plan = planTransactionRevert(session, first.id)

  assert.equal(plan.canRevert, false)
  assert.match(plan.conflicts[0].message, /changed again/)
  assert.equal(session.present.regions.find((row) => row.id === 'apac').growth, 40)
})

test('document updates and appends both participate in semantic versioning', () => {
  let session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  session = executeVersionedWorkspaceCommand(session, { type: 'document.update', field: 'title', value: 'Connected work' })
  session = executeVersionedWorkspaceCommand(session, { type: 'document.append', text: 'Evidence: linked work stays current.' })

  assert.equal(session.past.length, 2)
  assert.equal(session.present.document.title, 'Connected work')
  assert.match(session.present.document.body, /linked work stays current/)
})

test('metric formula edits recalculate values and synchronize derive edges', () => {
  let session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  session = executeVersionedWorkspaceCommand(session, { type: 'metric.formula', metricId: 'revenue', formula: 'AVERAGE(Regions.Revenue)' })
  const revenue = session.present.metrics.find((metric) => metric.id === 'revenue')

  assert.equal(revenue.value, 10.7)
  assert.equal(session.present.graph.edges.filter((edge) => edge.to === 'metric:revenue' && edge.relation === 'derives').length, 4)
  assert.match(session.present.graph.edges.find((edge) => edge.to === 'metric:revenue' && edge.relation === 'derives').description, /Regions.Revenue/)
})

test('legacy sessions migrate duplicate IDs and infer a safe next revision', () => {
  const workspace = cloneSeedWorkspace()
  const tx = {
    id: 'transaction:1',
    command: { type: 'decision.status', decisionId: 'launch', status: 'approved' },
    summary: 'approved',
    before: workspace,
    after: workspace,
  }
  const hydrated = hydrateVersionedWorkspaceSession({ present: workspace, past: [tx, { ...tx }], future: [] })

  assert.equal(new Set(hydrated.past.map((item) => item.id)).size, 2)
  assert.equal(new Set(hydrated.past.map((item) => item.revision)).size, 2)
  assert.equal(hydrated.nextRevision > 2, true)
})

test('revision ledger retains abandoned redo branches', async () => {
  const { getVersionedHistory } = await import('../src/versioning.ts')
  let session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  session = executeVersionedWorkspaceCommand(session, { type: 'decision.status', decisionId: 'launch', status: 'approved' })
  const abandonedId = session.past[0].id
  session = undoVersionedWorkspaceSession(session)
  session = executeVersionedWorkspaceCommand(session, { type: 'region.update', regionId: 'eu', field: 'growth', value: 25 })

  assert.equal(session.future.length, 0)
  assert.equal(session.ledger.length, 2)
  const abandoned = getVersionedHistory(session).find((entry) => entry.transaction.id === abandonedId)
  assert.equal(abandoned.status, 'branch')
})

test('version snapshots allow arbitrary revision comparison including abandoned branches', async () => {
  const { collectVersionSnapshots } = await import('../src/versioning.ts')
  let session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  session = executeVersionedWorkspaceCommand(session, { type: 'region.update', regionId: 'apac', field: 'revenue', value: 10 })
  session = executeVersionedWorkspaceCommand(session, { type: 'decision.status', decisionId: 'launch', status: 'approved' })
  const snapshots = collectVersionSnapshots(session)

  assert.deepEqual(snapshots.map((snapshot) => snapshot.revision), [0, 1, 2])
  const diffs = compareWorkspaceStates(snapshots[0].workspace, snapshots[2].workspace)
  assert.equal(diffs.some((diff) => diff.objectId === 'metric:revenue' && diff.field === 'value'), true)
  assert.equal(diffs.some((diff) => diff.objectId === 'decision:launch' && diff.field === 'status'), true)
})

test('metric formulas enforce semantic unit compatibility', async () => {
  const { validateMetricFormula } = await import('../src/semanticCommands.ts')
  const workspace = cloneSeedWorkspace()
  assert.throws(() => validateMetricFormula(workspace, 'revenue', 'SUM(Regions.Growth)'), /requires a currency field/)
  assert.equal(validateMetricFormula(workspace, 'revenue', 'AVERAGE(Regions.Revenue)').value, 10.7)
})
