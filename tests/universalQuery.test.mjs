import assert from 'node:assert/strict'
import test from 'node:test'
import { cloneSeedWorkspace } from '../src/model.ts'
import { createVersionedWorkspaceSession } from '../src/versioning.ts'
import { resolveUniversalQuery } from '../src/universalQuery.ts'

test('universal query preserves executable command intents', () => {
  const workspace = createVersionedWorkspaceSession(cloneSeedWorkspace()).present
  const result = resolveUniversalQuery('set APAC revenue to 10', workspace)
  assert.equal(result.kind, 'intent')
  assert.equal(result.intent.kind, 'command')
  assert.equal(result.intent.command.type, 'region.update')
})

test('universal query falls back to semantic search for non-command text', () => {
  const workspace = createVersionedWorkspaceSession(cloneSeedWorkspace()).present
  const result = resolveUniversalQuery('APAC margin', workspace)
  assert.equal(result.kind, 'search')
  assert.equal(result.results.some((item) => item.id === 'region:apac'), true)
})

test('universal query keeps navigation and history intents executable', () => {
  const workspace = createVersionedWorkspaceSession(cloneSeedWorkspace()).present
  assert.equal(resolveUniversalQuery('open slides', workspace).kind, 'intent')
  assert.equal(resolveUniversalQuery('show history', workspace).kind, 'intent')
})

test('universal query reports no results without inventing workspace objects', () => {
  const workspace = createVersionedWorkspaceSession(cloneSeedWorkspace()).present
  const result = resolveUniversalQuery('quantum submarine procurement', workspace)
  assert.equal(result.kind, 'search')
  assert.deepEqual(result.results, [])
  assert.match(result.message, /I can insert semantic document blocks/)
})
