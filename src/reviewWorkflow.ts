import type { WorkspaceState } from './model.ts'
import { getSemanticDocument, resolveSemanticClaim, type BlockAnnotationKind, type BlockAnnotationStatus } from './semanticDocument.ts'
import { getWorkspaceReviews } from './workspaceReviews.ts'

export type ReviewFilter = {
  owner?: string
  kind?: BlockAnnotationKind
  status?: BlockAnnotationStatus
}

export type ReviewInboxItem = {
  id: string
  blockId: string
  blockLabel: string
  kind: BlockAnnotationKind
  body: string
  owner: string
  status: BlockAnnotationStatus
}

export type DocumentReviewGate = {
  ready: boolean
  blockers: string[]
  warnings: string[]
  pendingApprovals: number
  openTasks: number
  unresolvedComments: number
}

function blockLabel(workspace: WorkspaceState, blockId: string) {
  return workspace.graph.objects.find((object) => object.id === blockId)?.label ?? blockId
}

function statusPriority(status: BlockAnnotationStatus) {
  if (status === 'pending') return 0
  if (status === 'open') return 1
  if (status === 'approved') return 2
  return 3
}

export function listReviewInbox(workspace: WorkspaceState, filter: ReviewFilter = {}): ReviewInboxItem[] {
  return getSemanticDocument(workspace).annotations
    .filter((annotation) => filter.owner === undefined || annotation.owner === filter.owner)
    .filter((annotation) => filter.kind === undefined || annotation.kind === filter.kind)
    .filter((annotation) => filter.status === undefined || annotation.status === filter.status)
    .map((annotation) => ({ ...annotation, blockLabel:blockLabel(workspace, annotation.blockId) }))
    .sort((left,right) => statusPriority(left.status) - statusPriority(right.status) || left.owner.localeCompare(right.owner) || left.id.localeCompare(right.id))
}

export function getReviewInboxSummary(workspace: WorkspaceState, owner?: string) {
  const items = listReviewInbox(workspace, owner ? { owner } : {})
  return {
    total:items.length,
    open:items.filter((item) => item.status === 'open').length,
    pending:items.filter((item) => item.status === 'pending').length,
    approved:items.filter((item) => item.status === 'approved').length,
    resolved:items.filter((item) => item.status === 'resolved').length,
    byKind:{
      comment:items.filter((item) => item.kind === 'comment').length,
      task:items.filter((item) => item.kind === 'task').length,
      approval:items.filter((item) => item.kind === 'approval').length,
    },
  }
}

export function getDocumentReviewGate(workspace: WorkspaceState): DocumentReviewGate {
  const semantic = getSemanticDocument(workspace),crossSurface=getWorkspaceReviews(workspace)
  const pendingApprovals = semantic.annotations.filter((annotation) => annotation.kind === 'approval' && annotation.status !== 'approved').length + crossSurface.filter((review)=>review.kind==='approval'&&review.status!=='approved').length
  const openTasks = semantic.annotations.filter((annotation) => annotation.kind === 'task' && annotation.status !== 'resolved').length + crossSurface.filter((review)=>review.kind==='task'&&review.status!=='resolved').length
  const unresolvedComments = semantic.annotations.filter((annotation) => annotation.kind === 'comment' && annotation.status !== 'resolved').length + crossSurface.filter((review)=>review.kind==='comment'&&review.status!=='resolved').length
  const blockers: string[] = []
  const warnings: string[] = []

  for (const claim of semantic.claims) {
    const resolved = resolveSemanticClaim(workspace, claim.id)
    if (resolved.status === 'contradicted') blockers.push(`Contradicted claim: ${claim.statement}`)
    if (resolved.status === 'stale') blockers.push(`Stale evidence for claim: ${claim.statement}`)
  }
  if (pendingApprovals) blockers.push(`${pendingApprovals} approval${pendingApprovals === 1 ? '' : 's'} pending`)
  if (openTasks) warnings.push(`${openTasks} task${openTasks === 1 ? '' : 's'} still open`)
  if (unresolvedComments) warnings.push(`${unresolvedComments} comment${unresolvedComments === 1 ? '' : 's'} unresolved`)

  return { ready:blockers.length === 0, blockers, warnings, pendingApprovals, openTasks, unresolvedComments }
}
