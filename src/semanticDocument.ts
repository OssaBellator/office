import type { WorkspaceState, WorkspaceGraph, WorkspaceObject, DependencyEdge } from './model.ts'

export type ClaimConfidence = 'low' | 'medium' | 'high'
export type SemanticClaimPredicate =
  | { type: 'growth-leader'; subjectObjectId: string }
  | { type: 'manual' }

export type SemanticClaim = {
  id: string
  statement: string
  rationale: string
  confidence: ClaimConfidence
  predicate: SemanticClaimPredicate
  citationIds: string[]
}

export type SemanticCitation = {
  id: string
  label: string
  sourceId: string
  evidenceObjectId: string
  locator: string
}

export type SemanticDocumentBlock =
  | { id: string; type: 'paragraph'; text: string }
  | { id: string; type: 'claim'; claimId: string }
  | { id: string; type: 'metric-embed'; metricIds: string[]; label: string }
  | { id: string; type: 'decision-embed'; decisionId: string }

export type SemanticDocumentState = {
  blocks: SemanticDocumentBlock[]
  claims: SemanticClaim[]
  citations: SemanticCitation[]
}

export type ResolvedSemanticClaim = SemanticClaim & {
  status: 'supported' | 'stale' | 'contradicted'
  sourceLabels: string[]
  evidenceLabels: string[]
  liveRationale: string
}

type ExtendedWorkspaceState = WorkspaceState & { semanticDocument?: SemanticDocumentState }

function defaultSemanticDocument(workspace: WorkspaceState): SemanticDocumentState {
  const leader = workspace.regions.reduce((best, row) => row.growth > best.growth ? row : best)
  return {
    blocks: [
      { id: 'block:opportunity', type: 'paragraph', text: workspace.document.body },
      { id: 'block:growth-claim', type: 'claim', claimId: 'claim:growth-leader' },
      { id: 'block:business-snapshot', type: 'metric-embed', metricIds: ['revenue', 'growth', 'margin', 'planRevenue', 'variance'], label: 'Business snapshot' },
      { id: 'block:launch-decision', type: 'decision-embed', decisionId: 'launch' },
    ],
    claims: [{
      id: 'claim:growth-leader',
      statement: `${leader.region} is the fastest-growing region in the current model.`,
      rationale: `${leader.region} has the highest regional growth rate and should be evaluated alongside margin before scaling.`,
      confidence: 'high',
      predicate: { type: 'growth-leader', subjectObjectId: `region:${leader.id}` },
      citationIds: ['citation:growth-leader-finance'],
    }],
    citations: [{
      id: 'citation:growth-leader-finance',
      label: `${leader.region} regional performance`,
      sourceId: 'source:finance',
      evidenceObjectId: `region:${leader.id}`,
      locator: `Regions.${leader.region} · Growth`,
    }],
  }
}

export function getSemanticDocument(workspace: WorkspaceState): SemanticDocumentState {
  const persisted = (workspace as ExtendedWorkspaceState).semanticDocument
  return persisted ? structuredClone(persisted) : defaultSemanticDocument(workspace)
}

function objectFor(id: string, label: string): WorkspaceObject {
  return { id, kind: 'document', label, surfaces: ['docs'] }
}

function edge(from: string, to: string, description: string): DependencyEdge {
  return { from, to, relation: 'renders', description }
}

function isSemanticObjectId(id: string) {
  return id.startsWith('block:') || id.startsWith('claim:') || id.startsWith('citation:')
}

function ensureSemanticGraph(graph: WorkspaceGraph, semantic: SemanticDocumentState): WorkspaceGraph {
  const objects = graph.objects.filter((object) => !isSemanticObjectId(object.id))
  const edges = graph.edges.filter((item) => !isSemanticObjectId(item.from) && !isSemanticObjectId(item.to))
  const objectIds = new Set(objects.map((object) => object.id))
  const edgeKeys = new Set(edges.map((item) => `${item.from}|${item.to}|${item.relation}`))
  const addObject = (object: WorkspaceObject) => { if (!objectIds.has(object.id)) { objectIds.add(object.id); objects.push(object) } }
  const addEdge = (item: DependencyEdge) => { const key = `${item.from}|${item.to}|${item.relation}`; if (!edgeKeys.has(key)) { edgeKeys.add(key); edges.push(item) } }

  for (const claim of semantic.claims) addObject(objectFor(claim.id, claim.statement))
  for (const citation of semantic.citations) addObject(objectFor(citation.id, citation.label))
  for (const block of semantic.blocks) {
    const label = block.type === 'paragraph' ? 'Document paragraph' : block.type === 'claim' ? 'Claim block' : block.type === 'metric-embed' ? block.label : 'Decision block'
    addObject(objectFor(block.id, label))
    addEdge(edge(block.id, 'document:strategy', `${label} renders in the strategy document`))
    if (block.type === 'claim') addEdge(edge(block.claimId, block.id, 'Claim renders through this document block'))
    if (block.type === 'metric-embed') block.metricIds.forEach((metricId) => addEdge(edge(`metric:${metricId}`, block.id, `${metricId} renders through the live metric block`)))
    if (block.type === 'decision-embed') addEdge(edge(`decision:${block.decisionId}`, block.id, 'Decision renders through this document block'))
  }
  for (const claim of semantic.claims) {
    for (const citationId of claim.citationIds) addEdge(edge(citationId, claim.id, 'Citation supports this claim'))
  }
  for (const citation of semantic.citations) {
    addEdge({ from: citation.evidenceObjectId, to: citation.id, relation: 'supports', description: 'Evidence object supports this citation' })
  }
  return { objects, edges }
}

export function withSemanticDocument(workspace: WorkspaceState, semanticDocument: SemanticDocumentState): WorkspaceState {
  const firstParagraph = semanticDocument.blocks.find((block): block is Extract<SemanticDocumentBlock, { type: 'paragraph' }> => block.type === 'paragraph')
  return {
    ...workspace,
    document: firstParagraph ? { ...workspace.document, body: firstParagraph.text } : workspace.document,
    graph: ensureSemanticGraph(workspace.graph, semanticDocument),
    semanticDocument: structuredClone(semanticDocument),
  } as WorkspaceState
}

export function updateSemanticLegacyBody(workspace: WorkspaceState, body: string): WorkspaceState {
  const semantic = getSemanticDocument(workspace)
  const index = semantic.blocks.findIndex((block) => block.type === 'paragraph')
  if (index >= 0) semantic.blocks[index] = { ...(semantic.blocks[index] as Extract<SemanticDocumentBlock, { type: 'paragraph' }>), text: body }
  else semantic.blocks.unshift({ id: 'block:opportunity', type: 'paragraph', text: body })
  return withSemanticDocument({ ...workspace, document: { ...workspace.document, body } }, semantic)
}

export function resolveSemanticClaim(workspace: WorkspaceState, claimId: string): ResolvedSemanticClaim {
  const semantic = getSemanticDocument(workspace)
  const claim = semantic.claims.find((item) => item.id === claimId)
  if (!claim) throw new Error(`Unknown semantic claim: ${claimId}`)
  const citations = claim.citationIds.map((id) => semantic.citations.find((item) => item.id === id)).filter(Boolean) as SemanticCitation[]
  const sources = citations.map((citation) => workspace.sources.find((source) => source.id === citation.sourceId)).filter(Boolean)
  const stale = sources.some((source) => source?.status === 'stale') || citations.some((citation) => !workspace.graph.objects.some((object) => object.id === citation.evidenceObjectId))
  let contradicted = false
  let liveRationale = claim.rationale
  if (claim.predicate.type === 'growth-leader') {
    const subjectId = claim.predicate.subjectObjectId.replace(/^region:/, '')
    const subject = workspace.regions.find((row) => row.id === subjectId)
    const leader = workspace.regions.reduce((best, row) => row.growth > best.growth ? row : best)
    contradicted = !subject || subject.id !== leader.id
    if (subject) liveRationale = `${subject.region} is growing ${subject.growth}% versus ${leader.growth}% for the current leader ${leader.region}. ${claim.rationale}`
  }
  return {
    ...claim,
    status: stale ? 'stale' : contradicted ? 'contradicted' : 'supported',
    sourceLabels: sources.map((source) => source!.label),
    evidenceLabels: citations.map((citation) => workspace.graph.objects.find((object) => object.id === citation.evidenceObjectId)?.label ?? citation.evidenceObjectId),
    liveRationale,
  }
}

export function makeGrowthEvidenceInsertion(workspace: WorkspaceState, idSuffix = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`) {
  const leader = workspace.regions.reduce((best, row) => row.growth > best.growth ? row : best)
  const claimId = `claim:${idSuffix}`
  const citationId = `citation:${idSuffix}`
  const blockId = `block:${idSuffix}`
  const claim: SemanticClaim = {
    id: claimId,
    statement: `${leader.region} is the fastest-growing region in the current model.`,
    rationale: `${leader.region} leads regional growth at ${leader.growth}% and should be evaluated alongside margin before scaling.`,
    confidence: 'high',
    predicate: { type: 'growth-leader', subjectObjectId: `region:${leader.id}` },
    citationIds: [citationId],
  }
  const citation: SemanticCitation = { id: citationId, label: `${leader.region} regional performance`, sourceId: 'source:finance', evidenceObjectId: `region:${leader.id}`, locator: `Regions.${leader.region} · Growth` }
  const block: SemanticDocumentBlock = { id: blockId, type: 'claim', claimId }
  return { block, claim, citation }
}
