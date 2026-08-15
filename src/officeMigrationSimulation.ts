import { buildForeignFormulaTranslationReport } from './foreignFormulaTranslationReport.ts'
import { summarizeImportedDataReview } from './importedDataReview.ts'
import type { WorkspaceState } from './model.ts'
import { planSecureOfficeImportBundle } from './officeImportBundle.ts'
import { assessOfficeReviewExport } from './officeReviewAssessment.ts'
import { appendSourceRevision, classifySourceRevision, createSourceRevisionLedger, type SourceRevisionLedger } from './sourceRevisionLedger.ts'
import { createVersionedWorkspaceSession, executeVersionedWorkspaceCommand, type VersionedWorkspaceSession } from './versioning.ts'

export type OfficeMigrationSimulationInput={name:string;bytes:ArrayBuffer|Uint8Array}
export type OfficeMigrationSimulationFile={name:string;status:'applied'|'duplicate-skipped'|'failed';classification?:'duplicate-content'|'filename-revision'|'new-source';transactionCount?:number;warnings?:string[];sourceIdentity?:string;error?:string}
export type OfficeMigrationSimulation={
  session:VersionedWorkspaceSession
  ledger:SourceRevisionLedger
  files:OfficeMigrationSimulationFile[]
  formulaTranslation:ReturnType<typeof buildForeignFormulaTranslationReport>
  importedReview:ReturnType<typeof summarizeImportedDataReview>
  exportReview:ReturnType<typeof assessOfficeReviewExport>
}

export async function simulateOfficeMigration(initialWorkspace:WorkspaceState,inputs:OfficeMigrationSimulationInput[],options:{ledger?:SourceRevisionLedger;skipDuplicateContent?:boolean}={}):Promise<OfficeMigrationSimulation>{
  let session=createVersionedWorkspaceSession(structuredClone(initialWorkspace)),ledger=structuredClone(options.ledger??createSourceRevisionLedger())
  const files:OfficeMigrationSimulationFile[]=[],skipDuplicateContent=options.skipDuplicateContent??true
  for(const input of inputs){
    try{
      const bundle=await planSecureOfficeImportBundle(session.present,input.bytes,input.name),classification=classifySourceRevision(ledger,bundle.receipt)
      if(classification==='duplicate-content'&&skipDuplicateContent){
        files.push({name:input.name,status:'duplicate-skipped',classification,warnings:[...bundle.plan.warnings],sourceIdentity:bundle.receipt.sourceIdentity})
        ledger=appendSourceRevision(ledger,bundle.receipt)
        continue
      }
      const before=session.past.length
      for(const command of bundle.plan.commands)session=executeVersionedWorkspaceCommand(session,command)
      files.push({name:input.name,status:'applied',classification,transactionCount:session.past.length-before,warnings:[...bundle.plan.warnings],sourceIdentity:bundle.receipt.sourceIdentity})
      ledger=appendSourceRevision(ledger,bundle.receipt)
    }catch(error){files.push({name:input.name,status:'failed',error:error instanceof Error?error.message:String(error)})}
  }
  return{session,ledger,files,formulaTranslation:buildForeignFormulaTranslationReport(session.present),importedReview:summarizeImportedDataReview(session.present),exportReview:assessOfficeReviewExport(session.present)}
}
