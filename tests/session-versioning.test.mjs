import assert from 'node:assert/strict'
import test from 'node:test'
import { cloneSeedWorkspace } from '../src/model.ts'
import { hydrateWorkspaceSession, serializeWorkspaceSession } from '../src/sessionStore.ts'
import {
  createVersionedWorkspaceSession,
  executeVersionedWorkspaceCommand,
  redoVersionedWorkspaceSession,
  undoVersionedWorkspaceSession,
} from '../src/versioning.ts'

test('versioned semantic sessions roundtrip with revision counter', () => {
  let session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  session = executeVersionedWorkspaceCommand(session, { type: 'decision.status', decisionId: 'launch', status: 'approved' })
  const restored = hydrateWorkspaceSession(JSON.parse(serializeWorkspaceSession(session)))

  assert.match(restored.past[0].id, /^transaction:/)
  assert.equal(restored.past[0].revision, 1)
  assert.equal(restored.nextRevision, 2)
  assert.match(restored.present.history[0].id, /^event:/)
})

test('redo branches and stable next revision survive persistence', () => {
  let session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  session = executeVersionedWorkspaceCommand(session, { type: 'region.update', regionId: 'apac', field: 'revenue', value: 10 })
  session = undoVersionedWorkspaceSession(session)
  const restored = hydrateWorkspaceSession(JSON.parse(serializeWorkspaceSession(session)))

  assert.equal(restored.future.length, 1)
  assert.equal(restored.nextRevision, 2)
  const redone = redoVersionedWorkspaceSession(restored)
  assert.equal(redone.present.metrics.find((metric) => metric.id === 'revenue').value, 44.1)
})

test('old workspace-session shape hydrates into versioned session', () => {
  const workspace = cloneSeedWorkspace()
  const oldSession = {
    present: workspace,
    past: [{
      id: 'transaction:1',
      command: { type: 'decision.status', decisionId: 'launch', status: 'approved' },
      summary: 'legacy',
      before: workspace,
      after: workspace,
    }],
    future: [],
  }
  const restored = hydrateWorkspaceSession(oldSession)
  assert.equal(restored.past[0].revision, 1)
  assert.match(restored.past[0].eventId, /^event:/)
  assert.equal(restored.nextRevision, 2)
})
