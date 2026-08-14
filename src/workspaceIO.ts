import type { WorkspaceState } from './model.ts'
import { hydrateWorkspaceSession } from './sessionStore.ts'
import type { VersionedWorkspaceSession } from './versioning.ts'

export type WorkspaceExportEnvelope = {
  format: 'frame-workspace'
  version: 1
  exportedAt: string
  session: VersionedWorkspaceSession
}

export function exportWorkspaceSession(session: VersionedWorkspaceSession, exportedAt = new Date().toISOString()) {
  const envelope: WorkspaceExportEnvelope = { format: 'frame-workspace', version: 1, exportedAt, session }
  return JSON.stringify(envelope, null, 2)
}

export function importWorkspaceSession(text: string): VersionedWorkspaceSession {
  let parsed: unknown
  try { parsed = JSON.parse(text) }
  catch { throw new Error('Workspace file is not valid JSON') }
  if (!parsed || typeof parsed !== 'object') throw new Error('Workspace file has no object payload')
  const candidate = parsed as Record<string, unknown>
  if (candidate.format === 'frame-workspace') {
    if (candidate.version !== 1) throw new Error(`Unsupported Frame workspace version: ${String(candidate.version)}`)
    return hydrateWorkspaceSession(candidate.session as Partial<VersionedWorkspaceSession>)
  }
  if ('present' in candidate || 'past' in candidate || 'future' in candidate) return hydrateWorkspaceSession(candidate as Partial<VersionedWorkspaceSession>)
  if ('document' in candidate || 'regions' in candidate || 'metrics' in candidate) return hydrateWorkspaceSession(null, candidate as Partial<WorkspaceState> as WorkspaceState)
  throw new Error('Unrecognized Frame workspace file')
}
