import assert from 'node:assert/strict'
import test from 'node:test'
import { cloneSeedWorkspace } from '../src/model.ts'
import { createVersionedWorkspaceSession } from '../src/versioning.ts'
import { buildWorkspaceDeepLink, locateWorkspaceObject, resolveWorkspaceDeepLink } from '../src/workspaceNavigation.ts'

test('semantic object locator chooses purpose-built surfaces by object identity', () => {
  const workspace = createVersionedWorkspaceSession(cloneSeedWorkspace()).present
  assert.equal(locateWorkspaceObject(workspace, 'block:growth-claim').surface, 'docs')
  assert.equal(locateWorkspaceObject(workspace, 'metric:revenue').surface, 'data')
  assert.equal(locateWorkspaceObject(workspace, 'scene:performance').surface, 'present')
  assert.equal(locateWorkspaceObject(workspace, 'decision:launch').surface, 'docs')
})

test('semantic object locator preserves secondary surfaces for shared objects', () => {
  const workspace = createVersionedWorkspaceSession(cloneSeedWorkspace()).present
  const metric = locateWorkspaceObject(workspace, 'metric:revenue')
  assert.equal(metric.secondarySurfaces.includes('docs'), true)
  assert.equal(metric.secondarySurfaces.includes('present'), true)
})

test('source records without graph nodes still resolve to a useful workspace location', () => {
  const workspace = createVersionedWorkspaceSession(cloneSeedWorkspace()).present
  const source = locateWorkspaceObject(workspace, 'source:finance')
  assert.equal(source.surface, 'docs')
  assert.equal(source.label, 'Finance model')
})

test('Frame deep links roundtrip workspace surface and semantic object identity', () => {
  const workspace = createVersionedWorkspaceSession(cloneSeedWorkspace()).present
  const location = locateWorkspaceObject(workspace, 'chart:revenue-vs-plan')
  const link = buildWorkspaceDeepLink('FY27 Product Strategy', location)
  assert.deepEqual(resolveWorkspaceDeepLink(link), { workspaceId:'FY27 Product Strategy', surface:'data', objectId:'chart:revenue-vs-plan' })
})

test('invalid deep links and unknown semantic objects are rejected', () => {
  const workspace = createVersionedWorkspaceSession(cloneSeedWorkspace()).present
  assert.throws(() => locateWorkspaceObject(workspace, 'missing:object'), /Unknown workspace object/)
  assert.throws(() => resolveWorkspaceDeepLink('https://example.com'), /Not a Frame workspace deep link/)
  assert.throws(() => resolveWorkspaceDeepLink('frame://workspace/fy27?surface=nope&object=x'), /Invalid Frame workspace deep link/)
})
