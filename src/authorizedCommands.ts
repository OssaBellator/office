import { assertWorkspaceCommandPermission, type WorkspaceRole } from './permissions.ts'
import { previewVersionedCommand, type VersionedCommandPreview } from './semanticPreview.ts'
import type { VersionedWorkspaceCommand } from './semanticCommands.ts'
import { executeVersionedWorkspaceCommand, type VersionedWorkspaceSession } from './versioning.ts'

export function previewAuthorizedWorkspaceCommand(role: WorkspaceRole, session: VersionedWorkspaceSession, command: VersionedWorkspaceCommand): VersionedCommandPreview {
  assertWorkspaceCommandPermission(role, command)
  return previewVersionedCommand(session.present, command)
}

export function executeAuthorizedWorkspaceCommand(role: WorkspaceRole, session: VersionedWorkspaceSession, command: VersionedWorkspaceCommand): VersionedWorkspaceSession {
  assertWorkspaceCommandPermission(role, command)
  return executeVersionedWorkspaceCommand(session, command)
}

export function executeAuthorizedWorkspaceCommands(role: WorkspaceRole, session: VersionedWorkspaceSession, commands: VersionedWorkspaceCommand[]) {
  return commands.reduce((current, command) => executeAuthorizedWorkspaceCommand(role, current, command), session)
}
