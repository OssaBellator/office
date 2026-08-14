import assert from 'node:assert/strict'
import test from 'node:test'
import { cloneSeedWorkspace } from '../src/model.ts'
import { createVersionedWorkspaceSession, executeVersionedWorkspaceCommand } from '../src/versioning.ts'
import { exportPlanCsv, exportPresentationMarkdown, exportRegionsCsv, exportStrategyMarkdown, exportWorkspaceBundle } from '../src/compatibilityExports.ts'

test('actual and plan tables export as portable CSV', () => {
  const workspace = createVersionedWorkspaceSession(cloneSeedWorkspace()).present
  assert.match(exportRegionsCsv(workspace), /^Region,Revenue,Growth,Margin\nNorth America,18\.6,12,74\.1/m)
  assert.match(exportPlanCsv(workspace), /^Region,Revenue\nNorth America,19/m)
})

test('CSV export escapes semantic text safely', () => {
  const workspace = createVersionedWorkspaceSession(cloneSeedWorkspace()).present
  workspace.regions[0].region = 'North, "Enterprise"'
  assert.match(exportRegionsCsv(workspace), /"North, ""Enterprise"""/)
})

test('strategy Markdown exports semantic claims metrics decisions and reviews', () => {
  const workspace = createVersionedWorkspaceSession(cloneSeedWorkspace()).present
  const markdown = exportStrategyMarkdown(workspace)
  assert.match(markdown, /^# Build the operating layer/m)
  assert.match(markdown, /SUPPORTED · high confidence/)
  assert.match(markdown, /Finance model/)
  assert.match(markdown, /\| Q2 revenue \| \$42\.8M \| SUM\(Regions\.Revenue\) \|/)
  assert.match(markdown, /## Decision/)
  assert.match(markdown, /\*\*approval\*\* · Strategy · pending/)
})

test('presentation Markdown respects authored order visibility and speaker notes', () => {
  let session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  session = executeVersionedWorkspaceCommand(session, { type:'presentation.scene.move', sceneId:'decision', toIndex:0 })
  session = executeVersionedWorkspaceCommand(session, { type:'presentation.scene.visibility', sceneId:'signal', visible:false })
  session = executeVersionedWorkspaceCommand(session, { type:'presentation.note.update', sceneId:'decision', note:'Close with the approved direction.' })
  const markdown = exportPresentationMarkdown(session.present)
  assert.equal(markdown.indexOf('Decision') < markdown.indexOf('Thesis'), true)
  assert.equal(markdown.includes('Signal'), false)
  assert.match(markdown, /Speaker note: Close with the approved direction\./)
})

test('workspace bundle returns semantic Markdown and CSV artifacts together', () => {
  const workspace = createVersionedWorkspaceSession(cloneSeedWorkspace()).present
  assert.deepEqual(Object.keys(exportWorkspaceBundle(workspace)).sort(), ['board-narrative.md','plan.csv','regions.csv','strategy.md'])
})
