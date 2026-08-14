import assert from 'node:assert/strict'
import test from 'node:test'
import { cloneSeedWorkspace, updateRegionField } from '../src/model.ts'
import { buildPresentationScenes } from '../src/presentationModel.ts'

test('presentation narrative is derived from shared workspace objects', () => {
  const workspace = cloneSeedWorkspace()
  const scenes = buildPresentationScenes(workspace)
  assert.deepEqual(scenes.map((scene) => scene.id), ['thesis', 'performance', 'signal', 'decision'])
  assert.match(scenes[1].title, /\$42\.8M/)
  assert.match(scenes[2].title, /APAC.*31%/)
  assert.equal(scenes[3].title, workspace.decisions[0].title)
})

test('presentation narrative follows live data and decisions', () => {
  let workspace = updateRegionField(cloneSeedWorkspace(), 'eu', 'growth', 36).workspace
  workspace.decisions[0].status = 'approved'
  const scenes = buildPresentationScenes(workspace)
  assert.match(scenes[2].title, /Europe.*36%/)
  assert.match(scenes[3].note, /approved direction/)
})
