import assert from 'node:assert/strict'
import test from 'node:test'
import { cloneSeedWorkspace } from '../src/model.ts'
import { createVersionedWorkspaceSession, executeVersionedWorkspaceCommand, undoVersionedWorkspaceSession } from '../src/versioning.ts'
import { assertVersionedSessionIntegrity, auditVersionedSession } from '../src/sessionIntegrity.ts'

test('fresh and normally edited sessions pass integrity auditing', () => {
  let session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  assert.equal(auditVersionedSession(session).valid, true)
  session = executeVersionedWorkspaceCommand(session, { type:'decision.status', decisionId:'launch', status:'approved' })
  session = executeVersionedWorkspaceCommand(session, { type:'region.update', regionId:'apac', field:'revenue', value:10 })
  assert.equal(auditVersionedSession(session).valid, true)
  assert.equal(assertVersionedSessionIntegrity(session), session)
})

test('valid undo state preserves integrity across present future and ledger', () => {
  let session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  session = executeVersionedWorkspaceCommand(session, { type:'decision.status', decisionId:'launch', status:'approved' })
  session = executeVersionedWorkspaceCommand(session, { type:'region.update', regionId:'apac', field:'revenue', value:10 })
  session = undoVersionedWorkspaceSession(session)
  assert.equal(auditVersionedSession(session).valid, true)
})

test('duplicate ledger IDs and revisions are diagnosed', () => {
  let session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  session = executeVersionedWorkspaceCommand(session, { type:'decision.status', decisionId:'launch', status:'approved' })
  const duplicate = structuredClone(session.ledger[0])
  session = { ...session, ledger:[...session.ledger, duplicate] }
  const ids = auditVersionedSession(session).issues.map((item) => item.id)
  assert.equal(ids.some((id) => id.startsWith('duplicate-id:')), true)
  assert.equal(ids.some((id) => id.startsWith('duplicate-revision:')), true)
})

test('stale nextRevision and missing ledger transactions are diagnosed', () => {
  let session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  session = executeVersionedWorkspaceCommand(session, { type:'decision.status', decisionId:'launch', status:'approved' })
  session = { ...session, ledger:[], nextRevision:1 }
  const ids = auditVersionedSession(session).issues.map((item) => item.id)
  assert.equal(ids.includes(`ledger-missing:${session.past[0].id}`), true)
})

test('broken applied-state chains and detached present workspace are diagnosed', () => {
  let session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  session = executeVersionedWorkspaceCommand(session, { type:'decision.status', decisionId:'launch', status:'approved' })
  session = executeVersionedWorkspaceCommand(session, { type:'region.update', regionId:'apac', field:'revenue', value:10 })
  session.past[1].before.document.title = 'Corrupted base'
  session.present.document.title = 'Detached present'
  const ids = auditVersionedSession(session).issues.map((item) => item.id)
  assert.equal(ids.some((id) => id.startsWith('past-chain:')), true)
  assert.equal(ids.includes('present-detached'), true)
})

test('transaction event identity drift is diagnosed', () => {
  let session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  session = executeVersionedWorkspaceCommand(session, { type:'decision.status', decisionId:'launch', status:'approved' })
  session.ledger[0].after.history[0].id = 'event:corrupted'
  const issues = auditVersionedSession(session).issues
  assert.equal(issues.some((item) => item.id.startsWith('event-mismatch:')), true)
  assert.throws(() => assertVersionedSessionIntegrity(session), /Invalid semantic workspace session/)
})
