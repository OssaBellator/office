import assert from 'node:assert/strict'
import test from 'node:test'
import { cloneSeedWorkspace } from '../src/model.ts'
import { getSemanticDocument, makeGrowthEvidenceInsertion, resolveSemanticClaim } from '../src/semanticDocument.ts'
import { previewVersionedCommand } from '../src/semanticPreview.ts'
import { createVersionedWorkspaceSession, executeVersionedWorkspaceCommand, hydrateVersionedWorkspaceSession } from '../src/versioning.ts'
import { revertVersionedTransaction } from '../src/revert.ts'

test('legacy workspaces materialize deterministic semantic document blocks', () => {
  const session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  const semantic = getSemanticDocument(session.present)
  assert.deepEqual(semantic.blocks.map((block) => block.type), ['paragraph', 'claim', 'metric-embed', 'decision-embed'])
  assert.equal(semantic.blocks[0].text, session.present.document.body)
  assert.equal(semantic.claims[0].predicate.subjectObjectId, 'region:apac')
  assert.equal(semantic.annotations.length, 2)
  assert.equal(session.present.graph.objects.some((object) => object.id === 'claim:growth-leader'), true)
})

test('paragraph block edits mirror the legacy document body and produce semantic diffs', () => {
  const session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  const preview = previewVersionedCommand(session.present, { type: 'document.block.update', blockId: 'block:opportunity', text: 'A semantic paragraph.' })
  assert.equal(preview.workspace.document.body, 'A semantic paragraph.')
  assert.equal(preview.diffs.some((diff) => diff.objectId === 'block:opportunity' && diff.field === 'text'), true)
  assert.equal(preview.impacts.some((impact) => impact.id === 'document:strategy'), true)
})

test('claims become stale with stale sources and contradicted when their evidence no longer leads', () => {
  let session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  assert.equal(resolveSemanticClaim(session.present, 'claim:growth-leader').status, 'supported')
  session = executeVersionedWorkspaceCommand(session, { type: 'source.status', sourceId: 'source:finance', status: 'stale' })
  assert.equal(resolveSemanticClaim(session.present, 'claim:growth-leader').status, 'stale')

  session = executeVersionedWorkspaceCommand(session, { type: 'source.status', sourceId: 'source:finance', status: 'live' })
  session = executeVersionedWorkspaceCommand(session, { type: 'region.update', regionId: 'eu', field: 'growth', value: 40 })
  assert.equal(resolveSemanticClaim(session.present, 'claim:growth-leader').status, 'contradicted')
})

test('evidence insertion creates explicit block, claim and citation objects', () => {
  let session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  const insertion = makeGrowthEvidenceInsertion(session.present, 'test-evidence')
  session = executeVersionedWorkspaceCommand(session, { type: 'document.block.insert', ...insertion })
  const semantic = getSemanticDocument(session.present)
  assert.equal(semantic.blocks.some((block) => block.id === 'block:test-evidence'), true)
  assert.equal(semantic.claims.some((claim) => claim.id === 'claim:test-evidence'), true)
  assert.equal(semantic.citations.some((citation) => citation.id === 'citation:test-evidence'), true)
  assert.equal(session.present.graph.edges.some((edge) => edge.from === 'citation:test-evidence' && edge.to === 'claim:test-evidence'), true)
})

test('semantic blocks can be reordered as one versioned transaction', () => {
  let session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  session = executeVersionedWorkspaceCommand(session, { type: 'document.block.move', blockId: 'block:launch-decision', toIndex: 0 })
  assert.equal(getSemanticDocument(session.present).blocks[0].id, 'block:launch-decision')
  assert.equal(session.past.at(-1).summary, 'Moved decision-embed block')
})

test('comments tasks and approvals are block-attached semantic revisions', () => {
  let session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  session = executeVersionedWorkspaceCommand(session, { type: 'annotation.insert', annotation: { id: 'annotation:test', blockId: 'block:opportunity', kind: 'comment', body: 'Clarify the thesis.', owner: 'Ossa', status: 'open' } })
  assert.equal(getSemanticDocument(session.present).annotations.some((annotation) => annotation.id === 'annotation:test'), true)
  const preview = previewVersionedCommand(session.present, { type: 'annotation.update', annotationId: 'annotation:test', field: 'status', value: 'resolved' })
  assert.equal(preview.diffs.some((diff) => diff.objectId === 'annotation:test' && diff.field === 'status' && diff.after === 'resolved'), true)
  session = executeVersionedWorkspaceCommand(session, { type: 'annotation.update', annotationId: 'annotation:test', field: 'status', value: 'resolved' })
  assert.equal(getSemanticDocument(session.present).annotations.find((annotation) => annotation.id === 'annotation:test').status, 'resolved')
})

test('removing a block prunes orphan claim citation and review state plus graph objects', () => {
  let session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  session = executeVersionedWorkspaceCommand(session, { type: 'document.block.remove', blockId: 'block:growth-claim' })
  const semantic = getSemanticDocument(session.present)
  assert.equal(semantic.claims.some((claim) => claim.id === 'claim:growth-leader'), false)
  assert.equal(semantic.citations.some((citation) => citation.id === 'citation:growth-leader-finance'), false)
  assert.equal(semantic.annotations.some((annotation) => annotation.blockId === 'block:growth-claim'), false)
  assert.equal(session.present.graph.objects.some((object) => object.id === 'claim:growth-leader'), false)
  assert.equal(session.present.graph.objects.some((object) => object.id === 'annotation:growth-margin-review'), false)
})

test('older persisted semantic documents hydrate review annotations compatibly', () => {
  const workspace = createVersionedWorkspaceSession(cloneSeedWorkspace()).present
  const legacy = structuredClone(workspace)
  delete legacy.semanticDocument.annotations
  const hydrated = hydrateVersionedWorkspaceSession({ present: legacy, past: [], future: [], ledger: [], nextRevision: 1 })
  assert.deepEqual(getSemanticDocument(hydrated.present).annotations, [])
})

test('semantic document transactions revert as new revisions', () => {
  let session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  session = executeVersionedWorkspaceCommand(session, { type: 'claim.update', claimId: 'claim:growth-leader', field: 'confidence', value: 'medium' })
  const target = session.past.at(-1)
  const reverted = revertVersionedTransaction(session, target.id)
  assert.equal(reverted.plan.canRevert, true)
  assert.equal(getSemanticDocument(reverted.session.present).claims[0].confidence, 'high')
  assert.equal(reverted.session.past.at(-1).kind, 'revert')
})
