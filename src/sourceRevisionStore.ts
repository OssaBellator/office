import { appendSourceRevision, classifySourceRevision, createSourceRevisionLedger, hydrateSourceRevisionLedger, serializeSourceRevisionLedger, type SourceRevisionClassification, type SourceRevisionLedger } from './sourceRevisionLedger.ts'
import type { OfficeImportReceipt } from './officeImportReceipt.ts'

export const SOURCE_REVISION_STORAGE_KEY='frame-office-source-revisions-v1'

export function loadSourceRevisionLedger(storage:Pick<Storage,'getItem'>=localStorage):SourceRevisionLedger{
  try{const raw=storage.getItem(SOURCE_REVISION_STORAGE_KEY);return raw?hydrateSourceRevisionLedger(JSON.parse(raw)):createSourceRevisionLedger()}catch{return createSourceRevisionLedger()}
}
export function saveSourceRevisionLedger(ledger:SourceRevisionLedger,storage:Pick<Storage,'setItem'>=localStorage){storage.setItem(SOURCE_REVISION_STORAGE_KEY,serializeSourceRevisionLedger(ledger))}
export function recordSourceRevision(receipt:OfficeImportReceipt,storage:Pick<Storage,'getItem'|'setItem'>=localStorage){
  const current=loadSourceRevisionLedger(storage),classification=classifySourceRevision(current,receipt),next=appendSourceRevision(current,receipt);saveSourceRevisionLedger(next,storage);return{classification,ledger:next}
}
export function classifyStoredSourceRevision(receipt:OfficeImportReceipt,storage:Pick<Storage,'getItem'>=localStorage):SourceRevisionClassification{return classifySourceRevision(loadSourceRevisionLedger(storage),receipt)}
