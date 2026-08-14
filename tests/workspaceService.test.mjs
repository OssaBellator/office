import assert from 'node:assert/strict'
import test from 'node:test'
import { cloneSeedWorkspace } from '../src/model.ts'
import { createVersionedWorkspaceSession } from '../src/versioning.ts'
import { InMemoryWorkspaceRepository, WorkspaceVersionConflictError } from '../src/workspaceRepository.ts'
import { WorkspaceService } from '../src/workspaceService.ts'

test('workspace service previews authorized commands against stored state', async () => {
  const service = new WorkspaceService(new InMemoryWorkspaceRepository())
  await service.create('fy27', createVersionedWorkspaceSession(cloneSeedWorkspace()))
  const preview = await service.preview('fy27', 'reviewer', { type:'decision.status', decisionId:'launch', status:'approved' })
  assert.equal(preview.diffs.some((diff) => diff.objectId === 'decision:launch' && diff.after === 'approved'), true)
})

test('workspace service rejects unauthorized commands before save', async () => {
  const service = new WorkspaceService(new InMemoryWorkspaceRepository())
  const created = await service.create('fy27', createVersionedWorkspaceSession(cloneSeedWorkspace()))
  await assert.rejects(() => service.execute({ workspaceId:'fy27', expectedVersion:created.version, role:'reviewer', command:{ type:'region.update', regionId:'apac', field:'revenue', value:10 } }), /reviewer role cannot execute data/)
  assert.equal((await service.load('fy27')).version, 1)
})

test('workspace service executes and saves through optimistic concurrency', async () => {
  const service = new WorkspaceService(new InMemoryWorkspaceRepository())
  const created = await service.create('fy27', createVersionedWorkspaceSession(cloneSeedWorkspace()))
  const result = await service.execute({ workspaceId:'fy27', expectedVersion:created.version, role:'editor', command:{ type:'region.update', regionId:'apac', field:'revenue', value:10 } })
  assert.equal(result.record.version, 2)
  assert.equal(result.record.session.past.length, 1)
  assert.equal(result.preview.diffs.some((diff) => diff.objectId === 'region:apac' && diff.field === 'revenue'), true)
})

test('workspace service rejects stale client versions before semantic execution', async () => {
  const service = new WorkspaceService(new InMemoryWorkspaceRepository())
  const created = await service.create('fy27', createVersionedWorkspaceSession(cloneSeedWorkspace()))
  await service.execute({ workspaceId:'fy27', expectedVersion:created.version, role:'reviewer', command:{ type:'decision.status', decisionId:'launch', status:'approved' } })
  await assert.rejects(() => service.execute({ workspaceId:'fy27', expectedVersion:created.version, role:'editor', command:{ type:'region.update', regionId:'eu', field:'growth', value:30 } }), WorkspaceVersionConflictError)
})

test('workspace service executes authorized command sequences against evolving state', async () => {
  const service = new WorkspaceService(new InMemoryWorkspaceRepository())
  const created = await service.create('fy27', createVersionedWorkspaceSession(cloneSeedWorkspace()))
  const result = await service.executeMany('fy27', created.version, 'reviewer', [
    { type:'annotation.update', annotationId:'annotation:growth-margin-review', field:'status', value:'resolved' },
    { type:'annotation.update', annotationId:'annotation:launch-approval', field:'status', value:'approved' },
    { type:'decision.status', decisionId:'launch', status:'approved' },
  ])
  assert.equal(result.previews.length, 3)
  assert.equal(result.record.version, 2)
  assert.equal(result.record.session.past.length, 3)
  assert.equal(result.record.session.present.decisions[0].status, 'approved')
})
