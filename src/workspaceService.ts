import { previewVersionedCommand, type VersionedCommandPreview } from './semanticPreview.ts'
import type { VersionedWorkspaceCommand } from './semanticCommands.ts'
import { assertWorkspaceCommandPermission, type WorkspaceRole } from './permissions.ts'
import { executeVersionedWorkspaceCommand, type VersionedWorkspaceSession } from './versioning.ts'
import type { StoredWorkspace, WorkspaceRepository } from './workspaceRepository.ts'
import { WorkspaceVersionConflictError } from './workspaceRepository.ts'

export type WorkspaceCommandRequest = {
  workspaceId: string
  expectedVersion: number
  role: WorkspaceRole
  command: VersionedWorkspaceCommand
}

export type WorkspaceCommandResult = {
  preview: VersionedCommandPreview
  record: StoredWorkspace
}

export class WorkspaceService {
  private repository: WorkspaceRepository

  constructor(repository: WorkspaceRepository) {
    this.repository = repository
  }

  async create(workspaceId: string, session: VersionedWorkspaceSession) {
    return this.repository.create(workspaceId, session)
  }

  async load(workspaceId: string) {
    return this.repository.load(workspaceId)
  }

  async preview(workspaceId: string, role: WorkspaceRole, command: VersionedWorkspaceCommand): Promise<VersionedCommandPreview> {
    const record = await this.repository.load(workspaceId)
    if (!record) throw new Error(`Unknown workspace: ${workspaceId}`)
    assertWorkspaceCommandPermission(role, command)
    return previewVersionedCommand(record.session.present, command)
  }

  async execute(request: WorkspaceCommandRequest): Promise<WorkspaceCommandResult> {
    const record = await this.repository.load(request.workspaceId)
    if (!record) throw new Error(`Unknown workspace: ${request.workspaceId}`)
    if (record.version !== request.expectedVersion) throw new WorkspaceVersionConflictError(request.workspaceId, request.expectedVersion, record.version)
    assertWorkspaceCommandPermission(request.role, request.command)
    const preview = previewVersionedCommand(record.session.present, request.command)
    const session = executeVersionedWorkspaceCommand(record.session, request.command)
    const saved = await this.repository.save(request.workspaceId, record.version, session)
    return { preview, record:saved }
  }

  async executeMany(workspaceId: string, expectedVersion: number, role: WorkspaceRole, commands: VersionedWorkspaceCommand[]) {
    let record = await this.repository.load(workspaceId)
    if (!record) throw new Error(`Unknown workspace: ${workspaceId}`)
    if (record.version !== expectedVersion) throw new WorkspaceVersionConflictError(workspaceId, expectedVersion, record.version)
    const previews: VersionedCommandPreview[] = []
    let session = record.session
    for (const command of commands) {
      assertWorkspaceCommandPermission(role, command)
      previews.push(previewVersionedCommand(session.present, command))
      session = executeVersionedWorkspaceCommand(session, command)
    }
    record = await this.repository.save(workspaceId, record.version, session)
    return { previews, record }
  }
}
