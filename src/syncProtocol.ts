import type { WorkspaceState } from './model.ts'
import type { StoredWorkspace } from './workspaceRepository.ts'
import type { VersionedWorkspaceSession, VersionedWorkspaceTransaction } from './versioning.ts'

export type WorkspaceSyncEnvelope = {
  workspaceId: string
  repositoryVersion: number
  currentRevision: number
  fromRevision: number
  complete: boolean
  changes: VersionedWorkspaceTransaction[]
  snapshot?: WorkspaceState
}

function currentRevision(session: VersionedWorkspaceSession) {
  return Math.max(0, ...session.ledger.map((transaction) => transaction.revision))
}

export function getChangesSinceRevision(session: VersionedWorkspaceSession, revision: number) {
  return [...session.ledger].filter((transaction) => transaction.revision > revision).sort((a,b) => a.revision - b.revision)
}

export function hasCompleteHistorySince(session: VersionedWorkspaceSession, revision: number) {
  if (revision <= 0) return session.ledger.length === 0 || Math.min(...session.ledger.map((transaction) => transaction.revision)) <= 1
  const current = currentRevision(session)
  if (revision >= current) return true
  if (session.ledger.length === 0) return false
  const earliest = Math.min(...session.ledger.map((transaction) => transaction.revision))
  return revision >= earliest - 1
}

export function buildWorkspaceSyncEnvelope(record: StoredWorkspace, fromRevision: number): WorkspaceSyncEnvelope {
  const complete = hasCompleteHistorySince(record.session, fromRevision)
  return {
    workspaceId:record.workspaceId,
    repositoryVersion:record.version,
    currentRevision:currentRevision(record.session),
    fromRevision,
    complete,
    changes:complete ? getChangesSinceRevision(record.session, fromRevision) : [],
    snapshot:complete ? undefined : structuredClone(record.session.present),
  }
}
