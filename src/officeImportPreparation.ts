import type { WorkspaceState } from './model.ts'
import { planSecureOfficeImportBundle, type SecureOfficeImportBundle } from './officeImportBundle.ts'
import { classifySourceRevision, type SourceRevisionClassification, type SourceRevisionLedger } from './sourceRevisionLedger.ts'

export type PreparedOfficeImport=SecureOfficeImportBundle&{
  classification:SourceRevisionClassification
  previousFilenameRevision?:SecureOfficeImportBundle['receipt']
}

export async function prepareSecureOfficeImport(
  workspace:WorkspaceState,
  input:ArrayBuffer|Uint8Array,
  fileName:string,
  ledger:SourceRevisionLedger,
  createdAt?:string,
):Promise<PreparedOfficeImport>{
  const bundle=await planSecureOfficeImportBundle(workspace,input,fileName,createdAt)
  const classification=classifySourceRevision(ledger,bundle.receipt)
  const normalized=fileName.trim().toLowerCase()
  const previousFilenameRevision=[...ledger.revisions].reverse().find((item)=>item.kind===bundle.receipt.kind&&item.fileName.trim().toLowerCase()===normalized)
  return{...bundle,classification,...(previousFilenameRevision?{previousFilenameRevision}:{})}
}

export function sourceRevisionMessage(prepared:PreparedOfficeImport){
  if(prepared.classification==='duplicate-content')return'Identical Office content was imported previously. Review the semantic preview before applying a duplicate projection.'
  if(prepared.classification==='filename-revision')return`This looks like a new revision of ${prepared.receipt.fileName}; Frame can compare the proposed semantic changes with the prior import.`
  return'This Office payload has not been seen before in the source-revision ledger.'
}
