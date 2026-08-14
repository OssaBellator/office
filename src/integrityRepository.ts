import { assertVersionedSessionIntegrity } from './sessionIntegrity.ts'
import type { VersionedWorkspaceSession } from './versioning.ts'
import type { StoredWorkspace, WorkspaceRepository } from './workspaceRepository.ts'

export class IntegrityCheckedWorkspaceRepository implements WorkspaceRepository {
  private inner: WorkspaceRepository

  constructor(inner: WorkspaceRepository) {
    this.inner = inner
  }

  async create(workspaceId: string, session: VersionedWorkspaceSession): Promise<StoredWorkspace> {
    assertVersionedSessionIntegrity(session)
    return this.inner.create(workspaceId, session)
  }

  async load(workspaceId: string): Promise<StoredWorkspace | null> {
    const record = await this.inner.load(workspaceId)
    if (record) assertVersionedSessionIntegrity(record.session)
    return record
  }

  async save(workspaceId: string, expectedVersion: number, session: VersionedWorkspaceSession): Promise<StoredWorkspace> {
    assertVersionedSessionIntegrity(session)
    return this.inner.save(workspaceId, expectedVersion, session)
  }

  async delete(workspaceId: string, expectedVersion: number): Promise<void> {
    return this.inner.delete(workspaceId, expectedVersion)
  }
}
