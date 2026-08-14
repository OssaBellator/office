import assert from 'node:assert/strict'
import test from 'node:test'
import { cloneSeedWorkspace } from '../src/model.ts'
import { createVersionedWorkspaceSession, executeVersionedWorkspaceCommand } from '../src/versioning.ts'
import { buildWorkspaceSearchIndex, searchWorkspace } from '../src/searchIndex.ts'

test('semantic search index includes cross-surface workspace object types', () => {
  const workspace = createVersionedWorkspaceSession(cloneSeedWorkspace()).present
  const kinds = new Set(buildWorkspaceSearchIndex(workspace).map((record) => record.kind))
  for (const kind of ['document','block','claim','citation','metric','region','plan','decision','chart','source','scene','review']) assert.equal(kinds.has(kind), true)
})

test('workspace search ranks exact semantic titles above body-text matches', () => {
  const workspace = createVersionedWorkspaceSession(cloneSeedWorkspace()).present
  const results = searchWorkspace(workspace, 'APAC')
  assert.equal(results[0].id, 'region:apac')
  assert.equal(results.some((result) => result.kind === 'decision'), true)
})

test('workspace search can find formulas and source/provenance text', () => {
  const workspace = createVersionedWorkspaceSession(cloneSeedWorkspace()).present
  assert.equal(searchWorkspace(workspace, 'Regions Revenue', { kinds:['metric'] }).some((result) => result.id === 'metric:revenue'), true)
  assert.equal(searchWorkspace(workspace, 'Finance model live', { kinds:['source'] })[0].id, 'source:finance')
})

test('workspace search respects surface and kind filters', () => {
  const workspace = createVersionedWorkspaceSession(cloneSeedWorkspace()).present
  const presentResults = searchWorkspace(workspace, 'revenue', { surface:'present' })
  assert.equal(presentResults.every((result) => result.surfaces.includes('present')), true)
  assert.equal(searchWorkspace(workspace, 'APAC', { kinds:['region'] }).every((result) => result.kind === 'region'), true)
})

test('workspace search reflects live semantic state changes', () => {
  let session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  session = executeVersionedWorkspaceCommand(session, { type:'presentation.note.update', sceneId:'performance', note:'Lead with enterprise retention risk.' })
  assert.equal(searchWorkspace(session.present, 'enterprise retention', { kinds:['scene'] })[0].id, 'scene:performance')
  session = executeVersionedWorkspaceCommand(session, { type:'source.status', sourceId:'source:finance', status:'stale' })
  assert.equal(searchWorkspace(session.present, 'stale', { kinds:['source'] })[0].id, 'source:finance')
})

test('empty queries return no semantic search results', () => {
  const workspace = createVersionedWorkspaceSession(cloneSeedWorkspace()).present
  assert.deepEqual(searchWorkspace(workspace, '   '), [])
})
