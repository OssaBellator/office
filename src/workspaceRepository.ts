import { hydrateVersionedWorkspaceSession, type VersionedWorkspaceSession } from './versioning.ts'

export type StoredWorkspace = {
  workspaceId: string
  version: number
  updatedAt: string
  session: VersionedWorkspaceSession
}

export interface WorkspaceRepository {
  create(workspaceId: string, session: VersionedWorkspaceSession): Promise<StoredWorkspace>
  load(workspaceId: string): Promise<StoredWorkspace | null>
  save(workspaceId: string, expectedVersion: number, session: VersionedWorkspaceSession): Promise<StoredWorkspace>
  delete(workspaceId: string, expectedVersion: number): Promise<void>
}

export class WorkspaceVersionConflictError extends Error {
  workspaceId: string
  expectedVersion: number
  actualVersion: number
  constructor(workspaceId: string, expectedVersion: number, actualVersion: number) {
    super(`Workspace ${workspaceId} version conflict: expected ${expectedVersion}, actual ${actualVersion}`)
    this.name = 'WorkspaceVersionConflictError'
    this.workspaceId = workspaceId
    this.expectedVersion = expectedVersion
    this.actualVersion = actualVersion
  }
}

export class WorkspaceAlreadyExistsError extends Error {
  constructor(workspaceId: string) {
    super(`Workspace already exists: ${workspaceId}`)
    this.name = 'WorkspaceAlreadyExistsError'
  }
}

function cloneSession(session: VersionedWorkspaceSession) {
  return hydrateVersionedWorkspaceSession(structuredClone(session))
}

function cloneRecord(record: StoredWorkspace): StoredWorkspace {
  return { ...record, session: cloneSession(record.session) }
}

export class InMemoryWorkspaceRepository implements WorkspaceRepository {
  private records = new Map<string, StoredWorkspace>()

  async create(workspaceId: string, session: VersionedWorkspaceSession): Promise<StoredWorkspace> {
    if (this.records.has(workspaceId)) throw new WorkspaceAlreadyExistsError(workspaceId)
    const record: StoredWorkspace = { workspaceId, version:1, updatedAt:new Date().toISOString(), session:cloneSession(session) }
    this.records.set(workspaceId, record)
    return cloneRecord(record)
  }

  async load(workspaceId: string): Promise<StoredWorkspace | null> {
    const record = this.records.get(workspaceId)
    return record ? cloneRecord(record) : null
  }

  async save(workspaceId: string, expectedVersion: number, session: VersionedWorkspaceSession): Promise<StoredWorkspace> {
    const current = this.records.get(workspaceId)
    if (!current) throw new Error(`Unknown workspace: ${workspaceId}`)
    if (current.version !== expectedVersion) throw new WorkspaceVersionConflictError(workspaceId, expectedVersion, current.version)
    const record: StoredWorkspace = { workspaceId, version:current.version + 1, updatedAt:new Date().toISOString(), session:cloneSession(session) }
    this.records.set(workspaceId, record)
    return cloneRecord(record)
  }

  async delete(workspaceId: string, expectedVersion: number): Promise<void> {
    const current = this.records.get(workspaceId)
    if (!current) return
    if (current.version !== expectedVersion) throw new WorkspaceVersionConflictError(workspaceId, expectedVersion, current.version)
    this.records.delete(workspaceId)
  }
}
