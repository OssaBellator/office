import assert from 'node:assert/strict'
import test from 'node:test'
import { parsePaletteIntent } from '../src/intent.ts'
import { cloneSeedWorkspace } from '../src/model.ts'
import { revertVersionedTransaction } from '../src/revert.ts'
import { createVersionedWorkspaceSession, executeVersionedWorkspaceCommand } from '../src/versioning.ts'

test('source freshness changes are versioned and revertible', () => {
  let session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  session = executeVersionedWorkspaceCommand(session, { type: 'source.status', sourceId: 'source:finance', status: 'stale' })
  assert.equal(session.present.sources.find((source) => source.id === 'source:finance').status, 'stale')
  const target = session.past.at(-1)
  const reverted = revertVersionedTransaction(session, target.id)
  assert.equal(reverted.plan.canRevert, true)
  assert.equal(reverted.session.present.sources.find((source) => source.id === 'source:finance').status, 'live')
})

test('palette intent can change source freshness', () => {
  const workspace = cloneSeedWorkspace()
  const intent = parsePaletteIntent('mark finance source stale', workspace)
  assert.deepEqual(intent, { kind: 'command', label: 'Mark Finance model stale', command: { type: 'source.status', sourceId: 'source:finance', status: 'stale' } })
})
