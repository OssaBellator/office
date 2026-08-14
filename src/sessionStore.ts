import { type WorkspaceState } from './model.ts'
import {
  hydrateVersionedWorkspaceSession,
  type VersionedWorkspaceSession,
} from './versioning.ts'

export const SESSION_STORAGE_KEY = 'frame-workspace-session-v1'
export const LEGACY_WORKSPACE_STORAGE_KEY = 'frame-workspace-v1'

export function hydrateWorkspaceSession(
  value: Partial<VersionedWorkspaceSession> | null | undefined,
  fallbackWorkspace?: WorkspaceState,
): VersionedWorkspaceSession {
  return hydrateVersionedWorkspaceSession(value, fallbackWorkspace)
}

export function serializeWorkspaceSession(session: VersionedWorkspaceSession) {
  return JSON.stringify(session)
}
