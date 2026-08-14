import type { VersionedWorkspaceCommand } from './semanticCommands.ts'

export type WorkspaceRole = 'owner' | 'editor' | 'reviewer' | 'viewer'
export type CommandCapability = 'data' | 'content' | 'review' | 'decision' | 'presentation' | 'provenance'

const roleCapabilities: Record<WorkspaceRole, ReadonlySet<CommandCapability>> = {
  owner: new Set(['data','content','review','decision','presentation','provenance']),
  editor: new Set(['data','content','review','decision','presentation']),
  reviewer: new Set(['review','decision']),
  viewer: new Set(),
}

export function getCommandCapability(command: VersionedWorkspaceCommand): CommandCapability {
  switch (command.type) {
    case 'region.update':
    case 'plan.update':
    case 'data.imported.replace':
    case 'metric.create':
    case 'metric.remove':
    case 'metric.formula':
    case 'chart.kind':
      return 'data'
    case 'document.append':
    case 'document.update':
    case 'document.semantic.replace':
    case 'document.block.update':
    case 'document.block.insert':
    case 'document.block.remove':
    case 'document.block.move':
    case 'claim.update':
    case 'citation.update':
      return 'content'
    case 'annotation.insert':
    case 'annotation.update':
    case 'annotation.remove':
      return 'review'
    case 'decision.status':
      return 'decision'
    case 'presentation.replace':
    case 'presentation.scene.move':
    case 'presentation.scene.visibility':
    case 'presentation.note.update':
      return 'presentation'
    case 'source.status':
      return 'provenance'
  }
}

export function roleCan(role: WorkspaceRole, capability: CommandCapability) {
  return roleCapabilities[role].has(capability)
}

export function canExecuteWorkspaceCommand(role: WorkspaceRole, command: VersionedWorkspaceCommand) {
  return roleCan(role, getCommandCapability(command))
}

export function assertWorkspaceCommandPermission(role: WorkspaceRole, command: VersionedWorkspaceCommand) {
  const capability = getCommandCapability(command)
  if (!roleCan(role, capability)) throw new Error(`${role} role cannot execute ${capability} workspace commands`)
}

export function filterAllowedWorkspaceCommands(role: WorkspaceRole, commands: VersionedWorkspaceCommand[]) {
  return commands.filter((command) => canExecuteWorkspaceCommand(role, command))
}

export function getRoleCapabilities(role: WorkspaceRole) {
  return [...roleCapabilities[role]]
}
