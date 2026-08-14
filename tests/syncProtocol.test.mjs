import assert from 'node:assert/strict'
import test from 'node:test'
import { cloneSeedWorkspace } from '../src/model.ts'
import { createVersionedWorkspaceSession, executeVersionedWorkspaceCommand } from '../src/versioning.ts'
import { buildWorkspaceSyncEnvelope, getChangesSinceRevision, hasCompleteHistorySince } from '../src/syncProtocol.ts'

test('sync protocol returns semantic ledger changes after a client revision', () => {
  let session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  session = executeVersionedWorkspaceCommand(session, { type:'decision.status', decisionId:'launch', status:'approved' })
  session = executeVersionedWorkspaceCommand(session, { type:'region.update', regionId:'apac', field:'revenue', value:10 })
  assert.deepEqual(getChangesSinceRevision(session, 1).map((transaction) => transaction.revision), [2])
  assert.equal(hasCompleteHistorySince(session, 1), true)
})

test('sync envelope carries repository and semantic revision cursors separately', () => {
  let session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  session = executeVersionedWorkspaceCommand(session, { type:'decision.status', decisionId:'launch', status:'approved' })
  const envelope = buildWorkspaceSyncEnvelope({ workspaceId:'fy27', version:7, updatedAt:'now', session }, 0)
  assert.equal(envelope.repositoryVersion, 7)
  assert.equal(envelope.currentRevision, 1)
  assert.deepEqual(envelope.changes.map((transaction) => transaction.revision), [1])
  assert.equal(envelope.snapshot, undefined)
})

test('up-to-date clients receive an empty complete delta', () => {
  let session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  session = executeVersionedWorkspaceCommand(session, { type:'decision.status', decisionId:'launch', status:'approved' })
  const envelope = buildWorkspaceSyncEnvelope({ workspaceId:'fy27', version:2, updatedAt:'now', session }, 1)
  assert.equal(envelope.complete, true)
  assert.deepEqual(envelope.changes, [])
})

test('clients older than the retained ledger receive a full semantic snapshot instead of an incomplete delta', () => {
  let session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  session = executeVersionedWorkspaceCommand(session, { type:'decision.status', decisionId:'launch', status:'approved' })
  session = executeVersionedWorkspaceCommand(session, { type:'region.update', regionId:'apac', field:'revenue', value:10 })
  session = { ...session, ledger:session.ledger.slice(1) }
  assert.equal(hasCompleteHistorySince(session, 0), false)
  const envelope = buildWorkspaceSyncEnvelope({ workspaceId:'fy27', version:3, updatedAt:'now', session }, 0)
  assert.equal(envelope.complete, false)
  assert.deepEqual(envelope.changes, [])
  assert.equal(envelope.snapshot.regions.find((row) => row.id === 'apac').revenue, 10)
})
