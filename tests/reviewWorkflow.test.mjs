import assert from 'node:assert/strict'
import test from 'node:test'
import { cloneSeedWorkspace } from '../src/model.ts'
import { createVersionedWorkspaceSession, executeVersionedWorkspaceCommand } from '../src/versioning.ts'
import { getDocumentReviewGate, getReviewInboxSummary, listReviewInbox } from '../src/reviewWorkflow.ts'

test('review inbox materializes block identity and prioritizes pending/open work', () => {
  const workspace = createVersionedWorkspaceSession(cloneSeedWorkspace()).present
  const items = listReviewInbox(workspace)
  assert.equal(items[0].status, 'pending')
  assert.equal(items[0].blockId, 'block:launch-decision')
  assert.match(items[0].blockLabel, /Decision block/)
  assert.equal(items[1].status, 'open')
})

test('review inbox filters by owner kind and status', () => {
  const workspace = createVersionedWorkspaceSession(cloneSeedWorkspace()).present
  assert.equal(listReviewInbox(workspace, { owner:'Strategy' }).length, 2)
  assert.equal(listReviewInbox(workspace, { kind:'approval' }).length, 1)
  assert.equal(listReviewInbox(workspace, { status:'pending' })[0].kind, 'approval')
})

test('review inbox summary counts review work by status and kind', () => {
  const workspace = createVersionedWorkspaceSession(cloneSeedWorkspace()).present
  assert.deepEqual(getReviewInboxSummary(workspace), {
    total:2, open:1, pending:1, approved:0, resolved:0,
    byKind:{ comment:0, task:1, approval:1 },
  })
})

test('document review gate separates blockers from follow-up warnings', () => {
  const workspace = createVersionedWorkspaceSession(cloneSeedWorkspace()).present
  const gate = getDocumentReviewGate(workspace)
  assert.equal(gate.ready, false)
  assert.equal(gate.pendingApprovals, 1)
  assert.equal(gate.openTasks, 1)
  assert.equal(gate.blockers.some((message) => /approval pending/.test(message)), true)
  assert.equal(gate.warnings.some((message) => /task still open/.test(message)), true)
})

test('approval completion clears approval blocker while stale or contradicted claims still block', () => {
  let session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  session = executeVersionedWorkspaceCommand(session, { type:'annotation.update', annotationId:'annotation:launch-approval', field:'status', value:'approved' })
  assert.equal(getDocumentReviewGate(session.present).ready, true)
  session = executeVersionedWorkspaceCommand(session, { type:'source.status', sourceId:'source:finance', status:'stale' })
  assert.equal(getDocumentReviewGate(session.present).blockers.some((message) => /Stale evidence/.test(message)), true)
  session = executeVersionedWorkspaceCommand(session, { type:'source.status', sourceId:'source:finance', status:'live' })
  session = executeVersionedWorkspaceCommand(session, { type:'region.update', regionId:'eu', field:'growth', value:40 })
  assert.equal(getDocumentReviewGate(session.present).blockers.some((message) => /Contradicted claim/.test(message)), true)
})
