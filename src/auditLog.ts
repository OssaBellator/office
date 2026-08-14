import type { VersionedWorkspaceCommand } from './semanticCommands.ts'
import type { WorkspaceRole } from './permissions.ts'
import type { WorkspaceService } from './workspaceService.ts'

export type AuditActorSource = 'human' | 'automation'
export type AuditActor = { actorId: string; role: WorkspaceRole; source: AuditActorSource }

export type SemanticAuditEntry = {
  id: string
  workspaceId: string
  actor: AuditActor
  commandType: VersionedWorkspaceCommand['type']
  repositoryVersion: number
  semanticRevision: number
  summary: string
  diffCount: number
  impactObjectIds: string[]
  createdAt: string
}

export interface SemanticAuditLog {
  append(entry: SemanticAuditEntry): Promise<void>
  list(workspaceId: string): Promise<SemanticAuditEntry[]>
}

export class InMemorySemanticAuditLog implements SemanticAuditLog {
  private entries: SemanticAuditEntry[] = []
  async append(entry: SemanticAuditEntry) { this.entries.push(structuredClone(entry)) }
  async list(workspaceId: string) { return this.entries.filter((entry) => entry.workspaceId === workspaceId).map((entry) => structuredClone(entry)) }
}

function auditId() {
  return `audit:${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`
}

export async function executeAuditedWorkspaceCommand(
  service: WorkspaceService,
  log: SemanticAuditLog,
  actor: AuditActor,
  request: { workspaceId: string; expectedVersion: number; command: VersionedWorkspaceCommand },
) {
  const result = await service.execute({ ...request, role:actor.role })
  const transaction = result.record.session.past.at(-1)
  if (!transaction) return result
  await log.append({
    id:auditId(),
    workspaceId:request.workspaceId,
    actor:structuredClone(actor),
    commandType:request.command.type,
    repositoryVersion:result.record.version,
    semanticRevision:transaction.revision,
    summary:transaction.summary,
    diffCount:result.preview.diffs.length,
    impactObjectIds:result.preview.impacts.map((impact) => impact.id),
    createdAt:new Date().toISOString(),
  })
  return result
}
