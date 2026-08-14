import assert from 'node:assert/strict'
import test from 'node:test'
import {
  cloneSeedWorkspace,
  createWorkspaceSession,
  executeWorkspaceCommand,
  redoWorkspaceSession,
  undoWorkspaceSession,
} from '../src/model.ts'
import { hydrateWorkspaceSession, serializeWorkspaceSession } from '../src/sessionStore.ts'

test('semantic session roundtrip preserves undo history across reloads', () => {
  let session = createWorkspaceSession(cloneSeedWorkspace())
  session = executeWorkspaceCommand(session, {
    type: 'region.update',
    regionId: 'apac',
    field: 'revenue',
    value: 10,
  })

  const restored = hydrateWorkspaceSession(JSON.parse(serializeWorkspaceSession(session)))
  assert.equal(restored.present.metrics.find((metric) => metric.id === 'revenue').value, 44.1)
  assert.equal(restored.past.length, 1)

  const undone = undoWorkspaceSession(restored)
  assert.equal(undone.present.metrics.find((metric) => metric.id === 'revenue').value, 42.8)
})

test('redo branch survives session persistence', () => {
  let session = createWorkspaceSession(cloneSeedWorkspace())
  session = executeWorkspaceCommand(session, {
    type: 'decision.status',
    decisionId: 'launch',
    status: 'approved',
  })
  session = undoWorkspaceSession(session)

  const restored = hydrateWorkspaceSession(JSON.parse(serializeWorkspaceSession(session)))
  assert.equal(restored.future.length, 1)
  assert.equal(redoWorkspaceSession(restored).present.decisions[0].status, 'approved')
})

test('session hydration upgrades workspace snapshots with current schema defaults', () => {
  const workspace = cloneSeedWorkspace()
  const revenue = workspace.metrics.find((metric) => metric.id === 'revenue')
  delete revenue.formula

  const restored = hydrateWorkspaceSession({ present: workspace })
  assert.equal(restored.present.metrics.find((metric) => metric.id === 'revenue').formula, 'SUM(Regions.Revenue)')
})
