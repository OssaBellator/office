import assert from 'node:assert/strict'
import test from 'node:test'
import { cloneSeedWorkspace } from '../src/model.ts'
import { createVersionedWorkspaceSession, executeVersionedWorkspaceCommand } from '../src/versioning.ts'
import { IntegrityCheckedWorkspaceRepository } from '../src/integrityRepository.ts'
import { InMemoryWorkspaceRepository } from '../src/workspaceRepository.ts'

test('integrity repository accepts valid semantic sessions', async () => {
  const repository = new IntegrityCheckedWorkspaceRepository(new InMemoryWorkspaceRepository())
  const created = await repository.create('fy27', createVersionedWorkspaceSession(cloneSeedWorkspace()))
  assert.equal(created.version, 1)
})

test('integrity repository rejects corrupted sessions before create', async () => {
  const repository = new IntegrityCheckedWorkspaceRepository(new InMemoryWorkspaceRepository())
  let session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  session = executeVersionedWorkspaceCommand(session, { type:'decision.status', decisionId:'launch', status:'approved' })
  session.ledger[0].after.history[0].id = 'event:corrupt'
  await assert.rejects(() => repository.create('fy27', session), /Invalid semantic workspace session/)
})

test('integrity repository rejects corrupted sessions before save', async () => {
  const repository = new IntegrityCheckedWorkspaceRepository(new InMemoryWorkspaceRepository())
  let session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  const created = await repository.create('fy27', session)
  session = executeVersionedWorkspaceCommand(session, { type:'region.update', regionId:'apac', field:'revenue', value:10 })
  session.nextRevision = 1
  await assert.rejects(() => repository.save('fy27', created.version, session), /nextRevision 1 must be greater/)
})
