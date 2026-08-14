import assert from 'node:assert/strict'
import test from 'node:test'
import { cloneSeedWorkspace } from '../src/model.ts'
import { buildAllPresentationScenes, buildPresentationScenes } from '../src/presentationModel.ts'
import { getPresentationState } from '../src/presentationState.ts'
import { parsePaletteIntent } from '../src/intent.ts'
import { previewVersionedCommand } from '../src/semanticPreview.ts'
import { revertVersionedTransaction } from '../src/revert.ts'
import { createVersionedWorkspaceSession, executeVersionedWorkspaceCommand, hydrateVersionedWorkspaceSession } from '../src/versioning.ts'

test('legacy sessions materialize complete presentation authoring state and scene graph', () => {
  const session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  assert.deepEqual(getPresentationState(session.present).order, ['thesis','performance','signal','decision'])
  assert.equal(session.present.graph.objects.some((object) => object.id === 'scene:thesis'), true)
  assert.equal(session.present.graph.objects.some((object) => object.id === 'scene:signal'), true)
})

test('scene order and visibility drive the live presentation sequence', () => {
  let session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  session = executeVersionedWorkspaceCommand(session, { type:'presentation.scene.move', sceneId:'decision', toIndex:0 })
  session = executeVersionedWorkspaceCommand(session, { type:'presentation.scene.visibility', sceneId:'signal', visible:false })
  assert.deepEqual(buildPresentationScenes(session.present).map((scene) => scene.id), ['decision','thesis','performance'])
  assert.equal(buildAllPresentationScenes(session.present).map((scene) => scene.id).includes('signal'), true)
})

test('speaker note override remains live while scene data keeps updating', () => {
  let session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  session = executeVersionedWorkspaceCommand(session, { type:'presentation.note.update', sceneId:'performance', note:'Lead with plan attainment.' })
  session = executeVersionedWorkspaceCommand(session, { type:'region.update', regionId:'apac', field:'revenue', value:10 })
  const performance = buildPresentationScenes(session.present).find((scene) => scene.id === 'performance')
  assert.equal(performance.note, 'Lead with plan attainment.')
  assert.match(performance.title, /44\.1/)
})

test('presentation commands are previewable and cannot hide the final visible scene', () => {
  let session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  const preview = previewVersionedCommand(session.present, { type:'presentation.scene.move', sceneId:'decision', toIndex:0 })
  assert.equal(preview.diffs.some((diff) => diff.objectId === 'presentation:story' && diff.field === 'order'), true)
  for (const id of ['performance','signal','decision']) session = executeVersionedWorkspaceCommand(session, { type:'presentation.scene.visibility', sceneId:id, visible:false })
  assert.throws(() => executeVersionedWorkspaceCommand(session, { type:'presentation.scene.visibility', sceneId:'thesis', visible:false }), /at least one visible scene/)
})

test('presentation authoring reverts as a new semantic revision', () => {
  let session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  session = executeVersionedWorkspaceCommand(session, { type:'presentation.scene.move', sceneId:'decision', toIndex:0 })
  const target = session.past.at(-1)
  const reverted = revertVersionedTransaction(session, target.id)
  assert.equal(reverted.plan.canRevert, true)
  assert.deepEqual(getPresentationState(reverted.session.present).order, ['thesis','performance','signal','decision'])
  assert.equal(reverted.session.past.at(-1).kind, 'revert')
})

test('older persisted presentation state normalizes missing and duplicate scenes', () => {
  const workspace = cloneSeedWorkspace()
  workspace.presentationState = { order:['decision','decision'], hiddenSceneIds:['signal'], notes:{decision:'Close clearly.'} }
  const hydrated = hydrateVersionedWorkspaceSession({ present:workspace, past:[], future:[], ledger:[], nextRevision:1 })
  assert.deepEqual(getPresentationState(hydrated.present).order, ['decision','thesis','performance','signal'])
  assert.equal(buildPresentationScenes(hydrated.present).some((scene) => scene.id === 'signal'), false)
})

test('command palette can author story visibility order and speaker notes', () => {
  const workspace = cloneSeedWorkspace()
  assert.deepEqual(parsePaletteIntent('hide signal scene', workspace), { kind:'command', label:'Hide signal scene', command:{ type:'presentation.scene.visibility', sceneId:'signal', visible:false } })
  assert.equal(parsePaletteIntent('move decision scene first', workspace).command.toIndex, 0)
  assert.deepEqual(parsePaletteIntent('set performance speaker note to Lead with variance', workspace), { kind:'command', label:'Update performance speaker note', command:{ type:'presentation.note.update', sceneId:'performance', note:'Lead with variance' } })
})
