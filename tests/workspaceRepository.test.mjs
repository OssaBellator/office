import assert from 'node:assert/strict'
import test from 'node:test'
import { cloneSeedWorkspace } from '../src/model.ts'
import { createVersionedWorkspaceSession, executeVersionedWorkspaceCommand } from '../src/versioning.ts'
import { InMemoryWorkspaceRepository, WorkspaceAlreadyExistsError, WorkspaceVersionConflictError } from '../src/workspaceRepository.ts'

test('workspace repository creates and loads isolated semantic sessions', async () => {
  const repository = new InMemoryWorkspaceRepository()
  const session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  const created = await repository.create('fy27', session)
  created.session.present.document.title = 'Mutated client copy'
  const loaded = await repository.load('fy27')
  assert.equal(loaded.version, 1)
  assert.notEqual(loaded.session.present.document.title, 'Mutated client copy')
})

test('workspace repository rejects duplicate creates', async () => {
  const repository = new InMemoryWorkspaceRepository()
  const session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  await repository.create('fy27', session)
  await assert.rejects(() => repository.create('fy27', session), WorkspaceAlreadyExistsError)
})

test('optimistic save increments repository version while preserving semantic revision history', async () => {
  const repository = new InMemoryWorkspaceRepository()
  let session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  const created = await repository.create('fy27', session)
  session = executeVersionedWorkspaceCommand(session, { type:'region.update', regionId:'apac', field:'revenue', value:10 })
  const saved = await repository.save('fy27', created.version, session)
  assert.equal(saved.version, 2)
  assert.equal(saved.session.past.length, 1)
  assert.equal(saved.session.present.regions.find((row) => row.id === 'apac').revenue, 10)
})

test('concurrent stale saves fail with explicit version conflict metadata', async () => {
  const repository = new InMemoryWorkspaceRepository()
  const session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  const created = await repository.create('fy27', session)
  const first = executeVersionedWorkspaceCommand(session, { type:'decision.status', decisionId:'launch', status:'approved' })
  const second = executeVersionedWorkspaceCommand(session, { type:'region.update', regionId:'eu', field:'growth', value:30 })
  await repository.save('fy27', created.version, first)
  await assert.rejects(async () => {
    await repository.save('fy27', created.version, second)
  }, (error) => {
    assert.equal(error instanceof WorkspaceVersionConflictError, true)
    assert.equal(error.expectedVersion, 1)
    assert.equal(error.actualVersion, 2)
    return true
  })
})

test('delete also uses optimistic concurrency and removes the workspace', async () => {
  const repository = new InMemoryWorkspaceRepository()
  const created = await repository.create('fy27', createVersionedWorkspaceSession(cloneSeedWorkspace()))
  await assert.rejects(() => repository.delete('fy27', created.version + 1), WorkspaceVersionConflictError)
  await repository.delete('fy27', created.version)
  assert.equal(await repository.load('fy27'), null)
})
