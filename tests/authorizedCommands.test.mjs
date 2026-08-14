import assert from 'node:assert/strict'
import test from 'node:test'
import { cloneSeedWorkspace } from '../src/model.ts'
import { createVersionedWorkspaceSession } from '../src/versioning.ts'
import { executeAuthorizedWorkspaceCommand, executeAuthorizedWorkspaceCommands, previewAuthorizedWorkspaceCommand } from '../src/authorizedCommands.ts'

test('authorized preview enforces role before exposing a semantic mutation plan', () => {
  const session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  const preview = previewAuthorizedWorkspaceCommand('reviewer', session, { type:'decision.status', decisionId:'launch', status:'approved' })
  assert.equal(preview.diffs.some((diff) => diff.objectId === 'decision:launch' && diff.field === 'status'), true)
  assert.throws(() => previewAuthorizedWorkspaceCommand('viewer', session, { type:'decision.status', decisionId:'launch', status:'approved' }), /viewer role cannot execute decision/)
})

test('authorized execution preserves the normal version ledger', () => {
  const session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  const next = executeAuthorizedWorkspaceCommand('editor', session, { type:'region.update', regionId:'apac', field:'revenue', value:10 })
  assert.equal(next.past.length, 1)
  assert.equal(next.past[0].revision, 1)
  assert.equal(next.present.regions.find((row) => row.id === 'apac').revenue, 10)
})

test('unauthorized execution fails before mutating the supplied session', () => {
  const session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  assert.throws(() => executeAuthorizedWorkspaceCommand('reviewer', session, { type:'region.update', regionId:'apac', field:'revenue', value:10 }), /reviewer role cannot execute data/)
  assert.equal(session.past.length, 0)
  assert.equal(session.present.regions.find((row) => row.id === 'apac').revenue, 8.7)
})

test('authorized command sequences apply through normal semantic revisions', () => {
  const session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  const next = executeAuthorizedWorkspaceCommands('reviewer', session, [
    { type:'annotation.update', annotationId:'annotation:growth-margin-review', field:'status', value:'resolved' },
    { type:'decision.status', decisionId:'launch', status:'approved' },
  ])
  assert.equal(next.past.length, 2)
  assert.equal(next.present.decisions[0].status, 'approved')
})
