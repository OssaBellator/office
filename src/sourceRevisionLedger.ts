import type { OfficeImportReceipt } from './officeImportReceipt.ts'

export type SourceRevisionLedger={version:1;revisions:OfficeImportReceipt[]}
export type SourceRevisionClassification='duplicate-content'|'filename-revision'|'new-source'

export function createSourceRevisionLedger():SourceRevisionLedger{return{version:1,revisions:[]}}
export function appendSourceRevision(ledger:SourceRevisionLedger,receipt:OfficeImportReceipt,maxEntries=500):SourceRevisionLedger{
  const revisions=[...ledger.revisions.filter((item)=>!(item.sourceIdentity===receipt.sourceIdentity&&item.fileName===receipt.fileName&&item.createdAt===receipt.createdAt)),structuredClone(receipt)]
  return{version:1,revisions:revisions.slice(-Math.max(1,maxEntries))}
}
export function classifySourceRevision(ledger:SourceRevisionLedger,receipt:OfficeImportReceipt):SourceRevisionClassification{
  if(ledger.revisions.some((item)=>item.sourceIdentity===receipt.sourceIdentity))return'duplicate-content'
  const filename=receipt.fileName.trim().toLowerCase()
  if(ledger.revisions.some((item)=>item.kind===receipt.kind&&item.fileName.trim().toLowerCase()===filename))return'filename-revision'
  return'new-source'
}
export function latestSourceRevision(ledger:SourceRevisionLedger,fileName:string,kind?:OfficeImportReceipt['kind']){
  const normalized=fileName.trim().toLowerCase()
  return [...ledger.revisions].reverse().find((item)=>item.fileName.trim().toLowerCase()===normalized&&(!kind||item.kind===kind))
}
export function revisionsForSource(ledger:SourceRevisionLedger,sourceIdentity:string){return ledger.revisions.filter((item)=>item.sourceIdentity===sourceIdentity)}
export function serializeSourceRevisionLedger(ledger:SourceRevisionLedger){return JSON.stringify(ledger)}
export function hydrateSourceRevisionLedger(value:unknown):SourceRevisionLedger{
  if(!value||typeof value!=='object'||Array.isArray(value))return createSourceRevisionLedger()
  const input=value as Record<string,unknown>;if(input.version!==1||!Array.isArray(input.revisions))return createSourceRevisionLedger()
  const revisions:OfficeImportReceipt[]=[]
  for(const item of input.revisions){
    if(!item||typeof item!=='object'||Array.isArray(item))continue
    const record=item as Record<string,unknown>
    if(record.version!==1||typeof record.fileName!=='string'||!['docx','pptx','xlsx'].includes(String(record.kind))||typeof record.byteLength!=='number'||!Number.isFinite(record.byteLength)||typeof record.sha256!=='string'||!/^[0-9a-f]{64}$/i.test(record.sha256)||typeof record.sourceIdentity!=='string'||typeof record.importedItems!=='number'||typeof record.warningCount!=='number'||typeof record.createdAt!=='string'||!record.commandTypes||typeof record.commandTypes!=='object'||Array.isArray(record.commandTypes))continue
    const commandTypes:Record<string,number>={};let valid=true
    for(const [key,count] of Object.entries(record.commandTypes as Record<string,unknown>)){if(typeof count!=='number'||!Number.isFinite(count)||count<0){valid=false;break}commandTypes[key]=count}
    if(!valid)continue
    revisions.push({version:1,fileName:record.fileName,kind:record.kind as OfficeImportReceipt['kind'],byteLength:record.byteLength,sha256:record.sha256.toLowerCase(),sourceIdentity:record.sourceIdentity,importedItems:record.importedItems,warningCount:record.warningCount,commandTypes,createdAt:record.createdAt})
  }
  return{version:1,revisions}
}
