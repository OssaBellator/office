import type { WorkspaceState } from './model.ts'
import { planSecureOfficeImportBundle } from './officeImportBundle.ts'
import { assessOfficeReviewExport } from './officeReviewAssessment.ts'
import { summarizeOfficeImportPlan } from './interoperabilityReport.ts'
import { appendSourceRevision, classifySourceRevision, createSourceRevisionLedger, type SourceRevisionLedger } from './sourceRevisionLedger.ts'

export type OfficeBatchInput={name:string;bytes:ArrayBuffer|Uint8Array}
export type OfficeBatchDiagnostic={
  name:string
  ok:boolean
  classification?:ReturnType<typeof classifySourceRevision>
  sourceIdentity?:string
  kind?:'docx'|'pptx'|'xlsx'
  importedItems?:number
  warningCount?:number
  warnings?:string[]
  commandTypes?:Record<string,number>
  preserved?:ReturnType<typeof summarizeOfficeImportPlan>['preserved']
  error?:string
}
export type OfficeBatchDiagnostics={
  files:OfficeBatchDiagnostic[]
  ledger:SourceRevisionLedger
  totals:{files:number;ok:number;failed:number;warnings:number;importedItems:number;duplicates:number;filenameRevisions:number}
  workspaceExportReview:ReturnType<typeof assessOfficeReviewExport>
}

export async function diagnoseOfficeBatch(workspace:WorkspaceState,inputs:OfficeBatchInput[],initialLedger=createSourceRevisionLedger()):Promise<OfficeBatchDiagnostics>{
  let ledger=structuredClone(initialLedger)
  const files:OfficeBatchDiagnostic[]=[]
  for(const input of inputs){
    try{
      const bundle=await planSecureOfficeImportBundle(workspace,input.bytes,input.name)
      const classification=classifySourceRevision(ledger,bundle.receipt),report=summarizeOfficeImportPlan(bundle.plan)
      ledger=appendSourceRevision(ledger,bundle.receipt)
      files.push({name:input.name,ok:true,classification,sourceIdentity:bundle.receipt.sourceIdentity,kind:bundle.plan.kind,importedItems:bundle.plan.importedItems,warningCount:bundle.plan.warnings.length,warnings:[...bundle.plan.warnings],commandTypes:{...bundle.receipt.commandTypes},preserved:report.preserved})
    }catch(error){files.push({name:input.name,ok:false,error:error instanceof Error?error.message:String(error)})}
  }
  return{
    files,
    ledger,
    totals:{
      files:files.length,
      ok:files.filter((file)=>file.ok).length,
      failed:files.filter((file)=>!file.ok).length,
      warnings:files.reduce((sum,file)=>sum+(file.warningCount??0),0),
      importedItems:files.reduce((sum,file)=>sum+(file.importedItems??0),0),
      duplicates:files.filter((file)=>file.classification==='duplicate-content').length,
      filenameRevisions:files.filter((file)=>file.classification==='filename-revision').length,
    },
    workspaceExportReview:assessOfficeReviewExport(workspace),
  }
}
