import assert from 'node:assert/strict'
import test from 'node:test'
import { planWorkspaceAutomation } from '../src/automationPlan.ts'
import { exportRegionsCsv, exportStrategyMarkdown } from '../src/compatibilityExports.ts'
import { planRegionsCsvImport } from '../src/csvImportPlanner.ts'
import { executeGovernedAutomation, planGovernedAutomation } from '../src/governedAutomation.ts'
import { cloneSeedWorkspace } from '../src/model.ts'
import { inspectAllRelationships } from '../src/relationshipDiagnostics.ts'
import { assessWorkspaceReadiness } from '../src/workspaceDiagnostics.ts'
import { locateWorkspaceObject } from '../src/workspaceNavigation.ts'
import { resolveUniversalQuery } from '../src/universalQuery.ts'
import { createVersionedWorkspaceSession, executeVersionedWorkspaceCommand } from '../src/versioning.ts'

test('universal query falls back to semantic search and navigation resolves the matching surface', () => {
  const workspace = createVersionedWorkspaceSession(cloneSeedWorkspace()).present
  const result = resolveUniversalQuery('APAC growth', workspace)
  assert.equal(result.kind, 'search')
  assert.equal(result.results.some((item) => item.id === 'region:apac'), true)
  const location = locateWorkspaceObject(workspace, 'region:apac')
  assert.equal(location.surface, 'data')
})

test('exported actuals can round-trip through a staged semantic import plan', () => {
  const session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  const exported = exportRegionsCsv(session.present)
  const changed = exported.replace('APAC,8.7,31,68.8', 'APAC,10,31,68.8')
  const commands = planRegionsCsvImport(session.present, changed)
  assert.equal(commands.length, 1)
  const plan = planWorkspaceAutomation(session, 'owner', commands)
  assert.equal(plan.steps.length, 1)
  assert.equal(plan.diffs.some((diff) => diff.objectId === 'region:apac' && diff.field === 'revenue'), true)
  assert.equal(plan.diffs.some((diff) => diff.objectId === 'metric:revenue' && diff.field === 'value'), true)
  assert.equal(plan.diffs.some((diff) => diff.objectId === 'metric:attainment' && diff.field === 'value'), true)
  assert.equal(plan.resultingSession.present.metrics.find((metric) => metric.id === 'revenue').value, 44.1)
})

test('governed CSV previews reject execution after the workspace changes', () => {
  const session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  const csv = exportRegionsCsv(session.present).replace('APAC,8.7,31,68.8', 'APAC,10,31,68.8')
  const governed = planGovernedAutomation(session, 'owner', planRegionsCsvImport(session.present, csv))
  const changed = executeVersionedWorkspaceCommand(session, { type:'decision.status', decisionId:'launch', status:'approved' })
  assert.throws(() => executeGovernedAutomation(changed, governed), /plan is stale/i)
})

test('review actions can move the seed workspace to review-ready state', () => {
  let session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  assert.equal(assessWorkspaceReadiness(session.present).readyForReview, false)
  session = executeVersionedWorkspaceCommand(session, { type:'annotation.update', annotationId:'annotation:growth-margin-review', field:'status', value:'resolved' })
  session = executeVersionedWorkspaceCommand(session, { type:'annotation.update', annotationId:'annotation:launch-approval', field:'status', value:'approved' })
  const readiness = assessWorkspaceReadiness(session.present)
  assert.equal(readiness.readyForReview, true)
  assert.equal(readiness.openApprovals, 0)
  assert.equal(readiness.openTasks, 0)
})

test('relationship diagnostics detect duplicate semantic join keys and block readiness', () => {
  const workspace = createVersionedWorkspaceSession(cloneSeedWorkspace()).present
  const healthy = inspectAllRelationships(workspace)[0]
  assert.equal(healthy.valid, true)
  assert.equal(healthy.issues.length, 0)
  workspace.plans.find((row) => row.id === 'eu').region = 'North America'
  const broken = inspectAllRelationships(workspace)[0]
  assert.equal(broken.valid, false)
  assert.equal(broken.issues.some((issue) => issue.kind === 'duplicate-to-key'), true)
  const readiness = assessWorkspaceReadiness(workspace)
  assert.equal(readiness.readyForReview, false)
  assert.equal(readiness.diagnostics.some((item) => item.area === 'relationships' && item.severity === 'error'), true)
})

test('strategy Markdown preserves semantic evidence review metadata and shared attainment', () => {
  const workspace = createVersionedWorkspaceSession(cloneSeedWorkspace()).present
  const markdown = exportStrategyMarkdown(workspace)
  assert.match(markdown, /fastest-growing region/i)
  assert.match(markdown, /Source: \*\*Finance model\*\*/)
  assert.match(markdown, /\*\*task\*\* · Strategy · open/)
  assert.match(markdown, /\*\*approval\*\* · Strategy · pending/)
  assert.match(markdown, /Revenue attainment/)
  assert.match(markdown, /95\.1%/)
})
