import assert from 'node:assert/strict'
import test from 'node:test'
import { cloneSeedWorkspace } from '../src/model.ts'
import { createVersionedWorkspaceSession, executeVersionedWorkspaceCommand } from '../src/versioning.ts'
import { assessWorkspaceReadiness, buildWorkspaceDiagnostics } from '../src/workspaceDiagnostics.ts'

test('seed workspace reports review work without false semantic errors', () => {
  const session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  const readiness = assessWorkspaceReadiness(session.present)
  assert.equal(readiness.errors, 0)
  assert.equal(readiness.openApprovals, 1)
  assert.equal(readiness.openTasks, 1)
  assert.equal(readiness.readyForReview, false)
})

test('approving the default block approval can make a healthy workspace review-ready', () => {
  let session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  session = executeVersionedWorkspaceCommand(session, { type:'annotation.update', annotationId:'annotation:launch-approval', field:'status', value:'approved' })
  const readiness = assessWorkspaceReadiness(session.present)
  assert.equal(readiness.errors, 0)
  assert.equal(readiness.openApprovals, 0)
  assert.equal(readiness.readyForReview, true)
})

test('stale finance source yields both source and grounded-claim warnings', () => {
  let session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  session = executeVersionedWorkspaceCommand(session, { type:'source.status', sourceId:'source:finance', status:'stale' })
  const ids = buildWorkspaceDiagnostics(session.present).map((item) => item.id)
  assert.equal(ids.includes('source-stale:source:finance'), true)
  assert.equal(ids.includes('claim-stale:claim:growth-leader'), true)
})

test('contradicted growth-leader claim is a readiness error', () => {
  let session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  session = executeVersionedWorkspaceCommand(session, { type:'region.update', regionId:'eu', field:'growth', value:40 })
  const readiness = assessWorkspaceReadiness(session.present)
  assert.equal(readiness.diagnostics.some((item) => item.id === 'claim-contradicted:claim:growth-leader' && item.severity === 'error'), true)
  assert.equal(readiness.readyForReview, false)
})

test('dangling graph references are diagnosed deterministically', () => {
  const workspace = createVersionedWorkspaceSession(cloneSeedWorkspace()).present
  workspace.graph.edges.push({ from:'missing:object', to:'document:strategy', relation:'renders', description:'Broken test edge' })
  const diagnostics = buildWorkspaceDiagnostics(workspace)
  assert.equal(diagnostics.some((item) => item.area === 'graph' && item.objectIds.includes('missing:object')), true)
})

test('malformed presentation state with no visible scenes is diagnosed', () => {
  const workspace = createVersionedWorkspaceSession(cloneSeedWorkspace()).present
  workspace.presentationState = { order:['thesis','performance','signal','decision'], hiddenSceneIds:['thesis','performance','signal','decision'], notes:{} }
  const diagnostics = buildWorkspaceDiagnostics(workspace)
  assert.equal(diagnostics.some((item) => item.id === 'presentation-empty' && item.severity === 'error'), true)
})
