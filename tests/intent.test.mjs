import assert from 'node:assert/strict'
import test from 'node:test'
import { parsePaletteIntent } from '../src/intent.ts'
import { cloneSeedWorkspace } from '../src/model.ts'
import { createVersionedWorkspaceSession, executeVersionedWorkspaceCommand } from '../src/versioning.ts'

test('palette intent parses regional metric edits', () => {
  const workspace = cloneSeedWorkspace()
  assert.deepEqual(parsePaletteIntent('set APAC revenue to 10', workspace), {
    kind: 'command', label: 'Update APAC revenue', command: { type: 'region.update', regionId: 'apac', field: 'revenue', value: 10 },
  })
  assert.equal(parsePaletteIntent('update Europe growth 25%', workspace).kind, 'command')
})

test('palette intent parses navigation and session actions', () => {
  const workspace = cloneSeedWorkspace()
  assert.deepEqual(parsePaletteIntent('open slides', workspace), { kind: 'navigate', surface: 'present', label: 'Open board narrative' })
  assert.equal(parsePaletteIntent('history', workspace).kind, 'history')
  assert.equal(parsePaletteIntent('undo', workspace).kind, 'undo')
  assert.equal(parsePaletteIntent('redo last change', workspace).kind, 'redo')
})

test('palette intent builds semantic evidence and decision commands', () => {
  const workspace = cloneSeedWorkspace()
  const evidence = parsePaletteIntent('add evidence to strategy', workspace)
  assert.equal(evidence.kind, 'command')
  assert.equal(evidence.command.type, 'document.block.insert')
  assert.equal(evidence.command.block.type, 'claim')
  assert.match(evidence.command.claim.statement, /APAC is the fastest-growing region/)
  assert.equal(evidence.command.citation.evidenceObjectId, 'region:apac')
  assert.equal(parsePaletteIntent('approve decision', workspace).command.status, 'approved')
})

test('palette intent supports semantic document slash insertion', () => {
  const workspace = cloneSeedWorkspace()
  const paragraph = parsePaletteIntent('/paragraph Validate margin before launch.', workspace)
  assert.equal(paragraph.kind, 'command')
  assert.equal(paragraph.command.type, 'document.block.insert')
  assert.equal(paragraph.command.block.type, 'paragraph')
  assert.equal(paragraph.command.block.text, 'Validate margin before launch.')
  assert.equal(parsePaletteIntent('/claim', workspace).command.block.type, 'claim')
  assert.equal(parsePaletteIntent('/metrics', workspace).command.block.type, 'metric-embed')
  assert.equal(parsePaletteIntent('/decision', workspace).command.block.type, 'decision-embed')
})

test('palette intent validates semantic formulas and region names', () => {
  const workspace = createVersionedWorkspaceSession(cloneSeedWorkspace()).present
  const formula = parsePaletteIntent('set revenue formula to SUM(Regions.Revenue WHERE Region = "APAC")', workspace)
  assert.equal(formula.kind, 'command')
  assert.equal(formula.command.formula, 'SUM(Regions.Revenue WHERE Region = "APAC")')
  assert.equal(parsePaletteIntent('set revenue formula to SUM(Regions.Growth)', workspace).kind, 'error')
  assert.equal(parsePaletteIntent('set Moon revenue to 1', workspace).kind, 'error')
})

test('palette intent supports computed metric creation and safe removal', () => {
  let workspace = createVersionedWorkspaceSession(cloneSeedWorkspace()).present
  const create = parsePaletteIntent('create metric High-growth revenue as currency = SUM(Regions.Revenue WHERE Growth >= 20)', workspace)
  assert.equal(create.kind, 'command')
  assert.equal(create.command.type, 'metric.create')
  assert.equal(create.command.metric.id, 'custom-high-growth-revenue')
  assert.equal(create.command.metric.formula, 'SUM(Regions.Revenue WHERE Growth >= 20)')
  assert.equal(parsePaletteIntent('create metric Broken KPI as currency = AVERAGE(Regions.Growth)', workspace).kind, 'error')
  workspace = executeVersionedWorkspaceCommand(createVersionedWorkspaceSession(workspace), create.command).present
  const remove = parsePaletteIntent('remove metric High-growth revenue', workspace)
  assert.equal(remove.kind, 'command')
  assert.equal(remove.command.type, 'metric.remove')
  assert.equal(remove.command.metricId, 'custom-high-growth-revenue')
  assert.equal(parsePaletteIntent('remove metric Q2 revenue', workspace).kind, 'error')
})

test('palette intent supports document title and legacy append commands', () => {
  const workspace = cloneSeedWorkspace()
  assert.deepEqual(parsePaletteIntent('set strategy title to One connected workspace', workspace), {
    kind: 'command', label: 'Update strategy title', command: { type: 'document.update', field: 'title', value: 'One connected workspace' },
  })
  const append = parsePaletteIntent('append to strategy: Validate margin before launch.', workspace)
  assert.equal(append.kind, 'command')
  assert.equal(append.command.text, 'Validate margin before launch.')
})