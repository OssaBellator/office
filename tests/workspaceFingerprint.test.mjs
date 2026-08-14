import assert from 'node:assert/strict'
import test from 'node:test'
import { cloneSeedWorkspace } from '../src/model.ts'
import { createVersionedWorkspaceSession, executeVersionedWorkspaceCommand } from '../src/versioning.ts'
import { semanticWorkspaceFingerprint } from '../src/workspaceFingerprint.ts'

test('semantic workspace fingerprint is deterministic for equivalent state', () => {
  const left = createVersionedWorkspaceSession(cloneSeedWorkspace()).present
  const right = structuredClone(left)
  assert.equal(semanticWorkspaceFingerprint(left), semanticWorkspaceFingerprint(right))
})

test('semantic workspace fingerprint changes when meaningful workspace state changes', () => {
  const base = createVersionedWorkspaceSession(cloneSeedWorkspace())
  const changed = executeVersionedWorkspaceCommand(base, { type:'region.update', regionId:'apac', field:'revenue', value:10 })
  assert.notEqual(semanticWorkspaceFingerprint(base.present), semanticWorkspaceFingerprint(changed.present))
})

test('semantic workspace fingerprint ignores transient change-event history', () => {
  const left = createVersionedWorkspaceSession(cloneSeedWorkspace()).present
  const right = structuredClone(left)
  right.history.push({ id:'event:test', changedAt:'later', summary:'Only history', changedObjectIds:[], affectedObjectIds:[] })
  assert.equal(semanticWorkspaceFingerprint(left), semanticWorkspaceFingerprint(right))
})

test('semantic workspace fingerprint includes authored document and presentation state', () => {
  let session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  const before = semanticWorkspaceFingerprint(session.present)
  session = executeVersionedWorkspaceCommand(session, { type:'presentation.note.update', sceneId:'performance', note:'Authored note' })
  assert.notEqual(semanticWorkspaceFingerprint(session.present), before)
})
