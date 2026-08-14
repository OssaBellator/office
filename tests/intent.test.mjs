import assert from 'node:assert/strict'
import test from 'node:test'
import { parsePaletteIntent } from '../src/intent.ts'
import { cloneSeedWorkspace } from '../src/model.ts'

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

test('palette intent builds evidence and decision commands', () => {
  const workspace = cloneSeedWorkspace()
  const evidence = parsePaletteIntent('add evidence to strategy', workspace)
  assert.equal(evidence.kind, 'command')
  assert.match(evidence.command.text, /APAC is the fastest-growing region/)
  assert.equal(parsePaletteIntent('approve decision', workspace).command.status, 'approved')
})

test('palette intent validates semantic formulas and region names', () => {
  const workspace = cloneSeedWorkspace()
  const formula = parsePaletteIntent('set revenue formula to SUM(Regions.Revenue WHERE Region = "APAC")', workspace)
  assert.equal(formula.kind, 'command')
  assert.equal(formula.command.formula, 'SUM(Regions.Revenue WHERE Region = "APAC")')
  assert.equal(parsePaletteIntent('set revenue formula to SUM(Regions.Growth)', workspace).kind, 'error')
  assert.equal(parsePaletteIntent('set Moon revenue to 1', workspace).kind, 'error')
})

test('palette intent supports document title and append commands', () => {
  const workspace = cloneSeedWorkspace()
  assert.deepEqual(parsePaletteIntent('set strategy title to One connected workspace', workspace), {
    kind: 'command', label: 'Update strategy title', command: { type: 'document.update', field: 'title', value: 'One connected workspace' },
  })
  const append = parsePaletteIntent('append to strategy: Validate margin before launch.', workspace)
  assert.equal(append.kind, 'command')
  assert.equal(append.command.text, 'Validate margin before launch.')
})
