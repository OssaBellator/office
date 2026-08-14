import assert from 'node:assert/strict'
import test from 'node:test'
import { deserializeWorkspaceCommand, parseWorkspaceCommand, serializeWorkspaceCommand } from '../src/commandCodec.ts'

test('runtime command codec decodes valid data and chart commands', () => {
  assert.deepEqual(parseWorkspaceCommand({ type:'region.update', regionId:'apac', field:'revenue', value:10 }), { type:'region.update', regionId:'apac', field:'revenue', value:10, changedAt:undefined })
  assert.deepEqual(parseWorkspaceCommand({ type:'chart.kind', chartId:'revenue-vs-plan', kind:'line' }), { type:'chart.kind', chartId:'revenue-vs-plan', kind:'line', changedAt:undefined })
})

test('runtime command codec validates nested semantic block and review payloads', () => {
  const block = parseWorkspaceCommand({ type:'document.block.insert', block:{ id:'block:new', type:'metric-embed', label:'Snapshot', metricIds:['revenue','variance'] } })
  assert.deepEqual(block.block.metricIds, ['revenue','variance'])
  const review = parseWorkspaceCommand({ type:'annotation.insert', annotation:{ id:'annotation:new', blockId:'block:new', kind:'approval', body:'Approve', owner:'Strategy', status:'pending' } })
  assert.equal(review.annotation.kind, 'approval')
})

test('runtime command codec validates presentation state and speaker-note commands', () => {
  const replace = parseWorkspaceCommand({ type:'presentation.replace', value:{ order:['decision','thesis','performance','signal'], hiddenSceneIds:['signal'], notes:{decision:'Close clearly'} } })
  assert.equal(replace.value.order[0], 'decision')
  assert.deepEqual(parseWorkspaceCommand({ type:'presentation.note.update', sceneId:'performance', note:'Lead with variance' }).note, 'Lead with variance')
})

test('runtime command codec rejects unknown commands and invalid enum values', () => {
  assert.throws(() => parseWorkspaceCommand({ type:'workspace.nuke' }), /Unknown workspace command type/)
  assert.throws(() => parseWorkspaceCommand({ type:'chart.kind', chartId:'c', kind:'pie' }), /kind must be one of/)
  assert.throws(() => parseWorkspaceCommand({ type:'decision.status', decisionId:'launch', status:'deleted' }), /status must be one of/)
})

test('runtime command codec rejects non-finite numeric and malformed nested values', () => {
  assert.throws(() => parseWorkspaceCommand({ type:'region.update', regionId:'apac', field:'revenue', value:Infinity }), /finite number/)
  assert.throws(() => parseWorkspaceCommand({ type:'presentation.scene.visibility', sceneId:'signal', visible:'no' }), /visible must be a boolean/)
  assert.throws(() => parseWorkspaceCommand({ type:'document.block.insert', block:{ id:'x', type:'metric-embed', label:'x', metricIds:'revenue' } }), /metricIds must be an array/)
})

test('semantic replacement decoding validates complete claim citation and review collections', () => {
  const command = parseWorkspaceCommand({ type:'document.semantic.replace', value:{ blocks:[{id:'b',type:'claim',claimId:'c'}], claims:[{id:'c',statement:'Claim',rationale:'Why',confidence:'high',predicate:{type:'manual'},citationIds:['cite']}], citations:[{id:'cite',label:'Source',sourceId:'source:finance',evidenceObjectId:'region:apac',locator:'APAC'}], annotations:[{id:'a',blockId:'b',kind:'comment',body:'Review',owner:'Ossa',status:'open'}] } })
  assert.equal(command.value.claims[0].predicate.type, 'manual')
  assert.equal(command.value.annotations[0].status, 'open')
})

test('workspace command serialization roundtrips through runtime validation', () => {
  const command = { type:'source.status', sourceId:'source:finance', status:'stale' }
  assert.deepEqual(deserializeWorkspaceCommand(serializeWorkspaceCommand(command)), { ...command, changedAt:undefined })
  assert.throws(() => deserializeWorkspaceCommand('{bad json'), /not valid JSON/)
})
