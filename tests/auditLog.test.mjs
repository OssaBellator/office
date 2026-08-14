import assert from 'node:assert/strict'
import test from 'node:test'
import { cloneSeedWorkspace } from '../src/model.ts'
import { createVersionedWorkspaceSession } from '../src/versioning.ts'
import { InMemoryWorkspaceRepository } from '../src/workspaceRepository.ts'
import { WorkspaceService } from '../src/workspaceService.ts'
import { InMemorySemanticAuditLog, executeAuditedWorkspaceCommand } from '../src/auditLog.ts'

test('audited execution records actor role source revision and repository version', async () => {
  const service = new WorkspaceService(new InMemoryWorkspaceRepository())
  const log = new InMemorySemanticAuditLog()
  const created = await service.create('fy27', createVersionedWorkspaceSession(cloneSeedWorkspace()))
  await executeAuditedWorkspaceCommand(service, log, { actorId:'ossa', role:'reviewer', source:'human' }, { workspaceId:'fy27', expectedVersion:created.version, command:{ type:'decision.status', decisionId:'launch', status:'approved' } })
  const entries = await log.list('fy27')
  assert.equal(entries.length, 1)
  assert.equal(entries[0].actor.actorId, 'ossa')
  assert.equal(entries[0].actor.role, 'reviewer')
  assert.equal(entries[0].repositoryVersion, 2)
  assert.equal(entries[0].semanticRevision, 1)
  assert.equal(entries[0].commandType, 'decision.status')
})

test('audit entry captures semantic diff and downstream impact metadata', async () => {
  const service = new WorkspaceService(new InMemoryWorkspaceRepository())
  const log = new InMemorySemanticAuditLog()
  const created = await service.create('fy27', createVersionedWorkspaceSession(cloneSeedWorkspace()))
  await executeAuditedWorkspaceCommand(service, log, { actorId:'frame-agent', role:'editor', source:'automation' }, { workspaceId:'fy27', expectedVersion:created.version, command:{ type:'region.update', regionId:'apac', field:'revenue', value:10 } })
  const entry = (await log.list('fy27'))[0]
  assert.equal(entry.actor.source, 'automation')
  assert.equal(entry.diffCount > 0, true)
  assert.equal(entry.impactObjectIds.includes('scene:performance'), true)
})

test('unauthorized execution does not append an audit entry', async () => {
  const service = new WorkspaceService(new InMemoryWorkspaceRepository())
  const log = new InMemorySemanticAuditLog()
  const created = await service.create('fy27', createVersionedWorkspaceSession(cloneSeedWorkspace()))
  await assert.rejects(() => executeAuditedWorkspaceCommand(service, log, { actorId:'reviewer', role:'reviewer', source:'human' }, { workspaceId:'fy27', expectedVersion:created.version, command:{ type:'region.update', regionId:'apac', field:'revenue', value:10 } }), /reviewer role cannot execute data/)
  assert.deepEqual(await log.list('fy27'), [])
})

test('audit log returns defensive copies', async () => {
  const service = new WorkspaceService(new InMemoryWorkspaceRepository())
  const log = new InMemorySemanticAuditLog()
  const created = await service.create('fy27', createVersionedWorkspaceSession(cloneSeedWorkspace()))
  await executeAuditedWorkspaceCommand(service, log, { actorId:'ossa', role:'reviewer', source:'human' }, { workspaceId:'fy27', expectedVersion:created.version, command:{ type:'decision.status', decisionId:'launch', status:'approved' } })
  const entries = await log.list('fy27')
  entries[0].summary = 'Mutated copy'
  assert.notEqual((await log.list('fy27'))[0].summary, 'Mutated copy')
})
