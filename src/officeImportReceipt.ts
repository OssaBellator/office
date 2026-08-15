import type { OfficeImportPlan } from './officeImportPlanner.ts'

export type OfficeImportReceipt={
  version:1
  fileName:string
  kind:OfficeImportPlan['kind']
  byteLength:number
  sha256:string
  sourceIdentity:string
  importedItems:number
  warningCount:number
  commandTypes:Record<string,number>
  createdAt:string
}

function bytes(input:ArrayBuffer|Uint8Array){return input instanceof Uint8Array?input:new Uint8Array(input)}
function hex(input:ArrayBuffer){return[...new Uint8Array(input)].map((value)=>value.toString(16).padStart(2,'0')).join('')}

export async function sha256OfficeInput(input:ArrayBuffer|Uint8Array){
  const value=bytes(input),copy=value.slice()
  return hex(await globalThis.crypto.subtle.digest('SHA-256',copy.buffer))
}

export async function createOfficeImportReceipt(input:ArrayBuffer|Uint8Array,fileName:string,plan:OfficeImportPlan,createdAt=new Date().toISOString()):Promise<OfficeImportReceipt>{
  const sha256=await sha256OfficeInput(input),commandTypes:Record<string,number>={}
  for(const command of plan.commands)commandTypes[command.type]=(commandTypes[command.type]??0)+1
  return{version:1,fileName,kind:plan.kind,byteLength:bytes(input).byteLength,sha256,sourceIdentity:`${plan.kind}:${sha256}`,importedItems:plan.importedItems,warningCount:plan.warnings.length,commandTypes,createdAt}
}

export function sameOfficeSource(left:OfficeImportReceipt,right:OfficeImportReceipt){return left.sourceIdentity===right.sourceIdentity}
export function sameOfficeFilename(left:OfficeImportReceipt,right:OfficeImportReceipt){return left.fileName.trim().toLowerCase()===right.fileName.trim().toLowerCase()}
