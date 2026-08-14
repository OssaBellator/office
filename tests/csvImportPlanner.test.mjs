import assert from 'node:assert/strict'
import test from 'node:test'
import { cloneSeedWorkspace } from '../src/model.ts'
import { exportPlanCsv, exportRegionsCsv } from '../src/compatibilityExports.ts'
import { planPlanCsvImport, planRegionsCsvImport, planWorkspaceCsvImport } from '../src/csvImportPlanner.ts'

test('round-tripping exported actual and plan CSV produces no semantic updates', () => {
  const workspace = cloneSeedWorkspace()
  assert.deepEqual(planRegionsCsvImport(workspace, exportRegionsCsv(workspace)), [])
  assert.deepEqual(planPlanCsvImport(workspace, exportPlanCsv(workspace)), [])
})

test('regions CSV plans only changed semantic fields', () => {
  const workspace = cloneSeedWorkspace()
  const csv = exportRegionsCsv(workspace).replace('APAC,8.7,31,68.8', 'APAC,10.2,35,68.8')
  assert.deepEqual(planRegionsCsvImport(workspace, csv), [
    { type:'region.update', regionId:'apac', field:'revenue', value:10.2 },
    { type:'region.update', regionId:'apac', field:'growth', value:35 },
  ])
})

test('plan CSV understands quoted region fields', () => {
  const workspace = cloneSeedWorkspace()
  workspace.plans[0].region = 'North, Enterprise'
  const csv = exportPlanCsv(workspace).replace('19\n', '20\n')
  assert.deepEqual(planPlanCsvImport(workspace, csv), [{ type:'plan.update', planId:'na', field:'revenue', value:20 }])
})

test('CSV planner rejects missing columns duplicate regions and unknown regions', () => {
  const workspace = cloneSeedWorkspace()
  assert.throws(() => planRegionsCsvImport(workspace, 'Region,Revenue\nAPAC,10\n'), /missing required column: Growth/)
  assert.throws(() => planPlanCsvImport(workspace, 'Region,Revenue\nAPAC,10\nAPAC,11\n'), /duplicate region: APAC/)
  assert.throws(() => planPlanCsvImport(workspace, 'Region,Revenue\nMoon,10\n'), /Unknown plan region/)
})

test('CSV planner rejects invalid numbers and malformed quotes', () => {
  const workspace = cloneSeedWorkspace()
  assert.throws(() => planPlanCsvImport(workspace, 'Region,Revenue\nAPAC,nope\n'), /must be a finite number/)
  assert.throws(() => planPlanCsvImport(workspace, 'Region,Revenue\n"APAC,10\n'), /unclosed quoted field/)
})

test('workspace CSV planner composes Actual and Plan commands without applying them', () => {
  const workspace = cloneSeedWorkspace()
  const commands = planWorkspaceCsvImport(workspace, {
    regions: exportRegionsCsv(workspace).replace('Europe,11.9,23,70.2', 'Europe,12.4,23,70.2'),
    plan: exportPlanCsv(workspace).replace('APAC,9.5', 'APAC,10.0'),
  })
  assert.deepEqual(commands, [
    { type:'region.update', regionId:'eu', field:'revenue', value:12.4 },
    { type:'plan.update', planId:'apac', field:'revenue', value:10 },
  ])
})
