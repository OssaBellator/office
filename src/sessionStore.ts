import {
  createWorkspaceSession,
  hydrateWorkspace,
  type WorkspaceSession,
  type WorkspaceState,
  type WorkspaceTransaction,
} from './model.ts'

export const SESSION_STORAGE_KEY = 'frame-workspace-session-v1'
export const LEGACY_WORKSPACE_STORAGE_KEY = 'frame-workspace-v1'

function hydrateTransaction(transaction: WorkspaceTransaction): WorkspaceTransaction {
  return {
    ...transaction,
    before: hydrateWorkspace(transaction.before),
    after: hydrateWorkspace(transaction.after),
  }
}

export function hydrateWorkspaceSession(
  value: Partial<WorkspaceSession> | null | undefined,
  fallbackWorkspace?: WorkspaceState,
): WorkspaceSession {
  const present = hydrateWorkspace(value?.present ?? fallbackWorkspace)
  const base = createWorkspaceSession(present)

  return {
    ...base,
    ...value,
    present,
    past: (value?.past ?? []).map(hydrateTransaction).slice(-50),
    future: (value?.future ?? []).map(hydrateTransaction).slice(0, 50),
  }
}

export function serializeWorkspaceSession(session: WorkspaceSession) {
  return JSON.stringify(session)
}
