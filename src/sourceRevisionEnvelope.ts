import type { OfficeImportReceipt } from './officeImportReceipt.ts'
import { hydrateSourceRevisionLedger } from './sourceRevisionLedger.ts'

export type SourceRevisionEnvelope={
  schema:'frame.office-source-revision'
  version:1
  workspaceId?:string
  receipt:OfficeImportReceipt
  recordedBy?:string
  recordedAt:string
}

function text(value:unknown,field:string){if(typeof value!=='string')throw new Error(`${field} must be a string`);return value}
function optionalText(value:unknown,field:string){return value===undefined?undefined:text(value,field)}
function record(value:unknown,field:string):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(`${field} must be an object`);return value as Record<string,unknown>}

export function createSourceRevisionEnvelope(receipt:OfficeImportReceipt,options:{workspaceId?:string;recordedBy?:string;recordedAt?:string}={}):SourceRevisionEnvelope{
  return{schema:'frame.office-source-revision',version:1,...(options.workspaceId?{workspaceId:options.workspaceId}:{}),receipt:structuredClone(receipt),...(options.recordedBy?{recordedBy:options.recordedBy}:{}),recordedAt:options.recordedAt??new Date().toISOString()}
}

export function parseSourceRevisionEnvelope(value:unknown):SourceRevisionEnvelope{
  const input=record(value,'source revision envelope')
  if(input.schema!=='frame.office-source-revision'||input.version!==1)throw new Error('Unsupported source revision envelope schema/version')
  const receiptInput=record(input.receipt,'source revision envelope.receipt')
  const ledger=hydrateSourceRevisionLedger({version:1,revisions:[receiptInput]})
  if(ledger.revisions.length!==1)throw new Error('Source revision envelope receipt is invalid')
  const workspaceId=optionalText(input.workspaceId,'source revision envelope.workspaceId'),recordedBy=optionalText(input.recordedBy,'source revision envelope.recordedBy'),recordedAt=text(input.recordedAt,'source revision envelope.recordedAt')
  if(!recordedAt.trim())throw new Error('source revision envelope.recordedAt must not be blank')
  return{schema:'frame.office-source-revision',version:1,...(workspaceId?{workspaceId}:{}),receipt:ledger.revisions[0],...(recordedBy?{recordedBy}:{}),recordedAt}
}

export function serializeSourceRevisionEnvelope(envelope:SourceRevisionEnvelope){return JSON.stringify(envelope)}
export function deserializeSourceRevisionEnvelope(json:string){let value:unknown;try{value=JSON.parse(json)}catch{throw new Error('Source revision envelope is not valid JSON')}return parseSourceRevisionEnvelope(value)}
