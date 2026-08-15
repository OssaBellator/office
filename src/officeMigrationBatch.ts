import type { WorkspaceState } from './model.ts'
import { planSecureOfficeImportBundle } from './officeImportBundle.ts'
import { sha256OfficeInput } from './officeImportReceipt.ts'
import { appendSourceRevision, classifySourceRevision, createSourceRevisionLedger, type SourceRevisionClassification, type SourceRevisionLedger } from './sourceRevisionLedger.ts'
import type { VersionedWorkspaceCommand } from './semanticCommands.ts'
import { createVersionedWorkspaceSession, executeVersionedWorkspaceCommand } from './versioning.ts'

export type OfficeMigrationBatchInput={name:string;bytes:ArrayBuffer|Uint8Array}
export type OfficeMigrationBatchFile={
  name:string
  status:'planned'|'duplicate-skipped'|'failed'
  classification?:SourceRevisionClassification
  sourceIdentity?:string
  receiptSha256?:string
  commandStart?:number
  commandCount?:number
  warningCount?:number
  error?:string
}
export type OfficeMigrationBatchPlan={
  schema:'frame.office-migration-batch'
  version:1
  createdAt:string
  baseWorkspaceSha256:string
  projectedWorkspaceSha256:string
  commands:VersionedWorkspaceCommand[]
  files:OfficeMigrationBatchFile[]
  warnings:string[]
  ledger:SourceRevisionLedger
}

async function workspaceFingerprint(workspace:WorkspaceState){return sha256OfficeInput(new TextEncoder().encode(JSON.stringify(workspace)))}

export async function prepareOfficeMigrationBatch(initialWorkspace:WorkspaceState,inputs:OfficeMigrationBatchInput[],options:{ledger?:SourceRevisionLedger;skipDuplicateContent?:boolean;createdAt?:string}={}):Promise<OfficeMigrationBatchPlan>{
  const baseWorkspaceSha256=await workspaceFingerprint(initialWorkspace),createdAt=options.createdAt??new Date().toISOString(),skipDuplicateContent=options.skipDuplicateContent??true
  let session=createVersionedWorkspaceSession(structuredClone(initialWorkspace)),ledger=structuredClone(options.ledger??createSourceRevisionLedger())
  const commands:VersionedWorkspaceCommand[]=[],files:OfficeMigrationBatchFile[]=[],warnings:string[]=[]
  for(const input of inputs){
    try{
      const bundle=await planSecureOfficeImportBundle(session.present,input.bytes,input.name,createdAt),classification=classifySourceRevision(ledger,bundle.receipt)
      ledger=appendSourceRevision(ledger,bundle.receipt)
      if(classification==='duplicate-content'&&skipDuplicateContent){files.push({name:input.name,status:'duplicate-skipped',classification,sourceIdentity:bundle.receipt.sourceIdentity,receiptSha256:bundle.receipt.sha256,warningCount:bundle.plan.warnings.length});continue}
      const commandStart=commands.length
      for(const command of bundle.plan.commands){commands.push(structuredClone(command));session=executeVersionedWorkspaceCommand(session,command)}
      for(const warning of bundle.plan.warnings)warnings.push(`${input.name}: ${warning}`)
      files.push({name:input.name,status:'planned',classification,sourceIdentity:bundle.receipt.sourceIdentity,receiptSha256:bundle.receipt.sha256,commandStart,commandCount:bundle.plan.commands.length,warningCount:bundle.plan.warnings.length})
    }catch(error){files.push({name:input.name,status:'failed',error:error instanceof Error?error.message:String(error)})}
  }
  return{schema:'frame.office-migration-batch',version:1,createdAt,baseWorkspaceSha256,projectedWorkspaceSha256:await workspaceFingerprint(session.present),commands,files,warnings,ledger}
}

export async function migrationBatchMatchesWorkspace(plan:OfficeMigrationBatchPlan,workspace:WorkspaceState){return(await workspaceFingerprint(workspace))===plan.baseWorkspaceSha256}
