import assert from 'node:assert/strict'
import test from 'node:test'
import { assertWorkspaceCommandPermission, canExecuteWorkspaceCommand, filterAllowedWorkspaceCommands, getCommandCapability, getRoleCapabilities } from '../src/permissions.ts'

test('command capabilities classify semantic mutations by domain', () => {
  assert.equal(getCommandCapability({ type:'region.update', regionId:'apac', field:'revenue', value:10 }), 'data')
  assert.equal(getCommandCapability({ type:'document.block.update', blockId:'block:opportunity', text:'x' }), 'content')
  assert.equal(getCommandCapability({ type:'annotation.update', annotationId:'a', field:'status', value:'resolved' }), 'review')
  assert.equal(getCommandCapability({ type:'presentation.scene.move', sceneId:'decision', toIndex:0 }), 'presentation')
  assert.equal(getCommandCapability({ type:'source.status', sourceId:'source:finance', status:'stale' }), 'provenance')
})

test('owners can execute every semantic command capability', () => {
  assert.deepEqual(new Set(getRoleCapabilities('owner')), new Set(['data','content','review','decision','presentation','provenance']))
})

test('editors can author workspace content but cannot alter provenance freshness', () => {
  assert.equal(canExecuteWorkspaceCommand('editor', { type:'metric.formula', metricId:'revenue', formula:'SUM(Regions.Revenue)' }), true)
  assert.equal(canExecuteWorkspaceCommand('editor', { type:'presentation.note.update', sceneId:'performance', note:'Lead with variance' }), true)
  assert.equal(canExecuteWorkspaceCommand('editor', { type:'source.status', sourceId:'source:finance', status:'stale' }), false)
})

test('reviewers can review and decide without editing data or prose', () => {
  assert.equal(canExecuteWorkspaceCommand('reviewer', { type:'annotation.insert', annotation:{ id:'a', blockId:'block:opportunity', kind:'comment', body:'Review', owner:'R', status:'open' } }), true)
  assert.equal(canExecuteWorkspaceCommand('reviewer', { type:'decision.status', decisionId:'launch', status:'approved' }), true)
  assert.equal(canExecuteWorkspaceCommand('reviewer', { type:'region.update', regionId:'apac', field:'growth', value:40 }), false)
  assert.equal(canExecuteWorkspaceCommand('reviewer', { type:'document.update', field:'title', value:'No' }), false)
})

test('viewers cannot execute semantic mutations', () => {
  assert.equal(canExecuteWorkspaceCommand('viewer', { type:'presentation.scene.visibility', sceneId:'signal', visible:false }), false)
  assert.throws(() => assertWorkspaceCommandPermission('viewer', { type:'decision.status', decisionId:'launch', status:'approved' }), /viewer role cannot execute decision/)
})

test('allowed-command filtering can gate automation plans before execution', () => {
  const commands = [
    { type:'annotation.update', annotationId:'a', field:'status', value:'resolved' },
    { type:'decision.status', decisionId:'launch', status:'approved' },
    { type:'region.update', regionId:'apac', field:'revenue', value:10 },
  ]
  assert.deepEqual(filterAllowedWorkspaceCommands('reviewer', commands).map((command) => command.type), ['annotation.update','decision.status'])
})
