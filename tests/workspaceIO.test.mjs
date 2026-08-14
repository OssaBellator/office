import assert from 'node:assert/strict'
import test from 'node:test'
import { cloneSeedWorkspace } from '../src/model.ts'
import { createVersionedWorkspaceSession, executeVersionedWorkspaceCommand } from '../src/versioning.ts'
import { exportWorkspaceSession, importWorkspaceSession } from '../src/workspaceIO.ts'

test('workspace export/import preserves version ledger and current state', () => {
  let session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  session = executeVersionedWorkspaceCommand(session, { type: 'region.update', regionId: 'apac', field: 'revenue', value: 10 })
  const text = exportWorkspaceSession(session, '2026-08-14T00:00:00.000Z')
  const restored = importWorkspaceSession(text)
  assert.equal(restored.present.metrics.find((metric) => metric.id === 'revenue').value, 44.1)
  assert.equal(restored.ledger.length, 1)
  assert.equal(restored.nextRevision, 2)
})

test('workspace import accepts legacy workspace-only JSON', () => {
  const workspace = cloneSeedWorkspace()
  delete workspace.metrics.find((metric) => metric.id === 'revenue').formula
  const restored = importWorkspaceSession(JSON.stringify(workspace))
  assert.equal(restored.present.metrics.find((metric) => metric.id === 'revenue').formula, 'SUM(Regions.Revenue)')
})

test('workspace import rejects malformed and unknown payloads', () => {
  assert.throws(() => importWorkspaceSession('{bad'), /valid JSON/)
  assert.throws(() => importWorkspaceSession(JSON.stringify({ hello: 'world' })), /Unrecognized/)
  assert.throws(() => importWorkspaceSession(JSON.stringify({ format: 'frame-workspace', version: 99, session: {} })), /Unsupported/)
})
