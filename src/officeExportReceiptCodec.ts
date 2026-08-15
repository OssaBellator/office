import type { OfficeExportBundleReceipt, OfficeExportReceipt } from './officeExportReceipt.ts'

function record(value:unknown,field:string):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(`${field} must be an object`);return value as Record<string,unknown>}
function text(value:unknown,field:string){if(typeof value!=='string')throw new Error(`${field} must be a string`);return value}
function number(value:unknown,field:string){if(typeof value!=='number'||!Number.isFinite(value))throw new Error(`${field} must be a finite number`);return value}

export function parseOfficeExportReceipt(value:unknown):OfficeExportReceipt{
  const input=record(value,'Office export receipt')
  if(input.schema!=='frame.office-export-receipt'||input.version!==1)throw new Error('Unsupported Office export receipt schema/version')
  const kind=text(input.kind,'kind') as OfficeExportReceipt['kind'];if(!['docx','pptx','xlsx'].includes(kind))throw new Error('Office export receipt kind must be docx, pptx, or xlsx')
  const sha256=text(input.sha256,'sha256').toLowerCase();if(!/^[0-9a-f]{64}$/.test(sha256))throw new Error('Office export receipt sha256 must be a 64-character hex digest')
  const byteLength=number(input.byteLength,'byteLength');if(!Number.isInteger(byteLength)||byteLength<0)throw new Error('Office export receipt byteLength must be a non-negative integer')
  return{schema:'frame.office-export-receipt',version:1,kind,fileName:text(input.fileName,'fileName'),mimeType:text(input.mimeType,'mimeType'),byteLength,sha256,generatedAt:text(input.generatedAt,'generatedAt')}
}

export function parseOfficeExportBundleReceipt(value:unknown):OfficeExportBundleReceipt{
  const input=record(value,'Office export bundle receipt')
  if(input.schema!=='frame.office-export-bundle-receipt'||input.version!==1)throw new Error('Unsupported Office export bundle receipt schema/version')
  if(!Array.isArray(input.artifacts))throw new Error('Office export bundle artifacts must be an array')
  const artifacts=input.artifacts.map(parseOfficeExportReceipt),kinds=artifacts.map((item)=>item.kind)
  if(new Set(kinds).size!==artifacts.length)throw new Error('Office export bundle receipt contains duplicate artifact kinds')
  const fidelity=record(input.fidelity,'fidelity') as unknown as OfficeExportBundleReceipt['fidelity']
  return{schema:'frame.office-export-bundle-receipt',version:1,generatedAt:text(input.generatedAt,'generatedAt'),artifacts,fidelity}
}

export function serializeOfficeExportBundleReceipt(value:OfficeExportBundleReceipt){return JSON.stringify(value)}
export function deserializeOfficeExportBundleReceipt(json:string){let value:unknown;try{value=JSON.parse(json)}catch{throw new Error('Office export bundle receipt is not valid JSON')}return parseOfficeExportBundleReceipt(value)}
