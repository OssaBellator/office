import { parseOfficeSmokeValidation, type OfficeSmokeValidation } from './officeSmokeValidation.ts'

export type OfficeSmokeLedger={schema:'frame.office-smoke-ledger';version:1;validations:OfficeSmokeValidation[]}
export function createOfficeSmokeLedger():OfficeSmokeLedger{return{schema:'frame.office-smoke-ledger',version:1,validations:[]}}
export function appendOfficeSmokeValidation(ledger:OfficeSmokeLedger,validation:OfficeSmokeValidation,maxEntries=1000):OfficeSmokeLedger{
  const parsed=parseOfficeSmokeValidation(validation),key=`${parsed.artifact.sha256}:${parsed.application}:${parsed.applicationVersion??''}:${parsed.platform??''}:${parsed.testedAt}`
  const validations=[...ledger.validations.filter((item)=>`${item.artifact.sha256}:${item.application}:${item.applicationVersion??''}:${item.platform??''}:${item.testedAt}`!==key),parsed]
  return{schema:'frame.office-smoke-ledger',version:1,validations:validations.slice(-Math.max(1,maxEntries))}
}
export function parseOfficeSmokeLedger(value:unknown):OfficeSmokeLedger{
  if(!value||typeof value!=='object'||Array.isArray(value))return createOfficeSmokeLedger()
  const input=value as Record<string,unknown>;if(input.schema!=='frame.office-smoke-ledger'||input.version!==1||!Array.isArray(input.validations))return createOfficeSmokeLedger()
  const validations:OfficeSmokeValidation[]=[]
  for(const item of input.validations){try{validations.push(parseOfficeSmokeValidation(item))}catch{}}
  return{schema:'frame.office-smoke-ledger',version:1,validations}
}
export function serializeOfficeSmokeLedger(ledger:OfficeSmokeLedger){return JSON.stringify(ledger)}
export function deserializeOfficeSmokeLedger(json:string){let value:unknown;try{value=JSON.parse(json)}catch{return createOfficeSmokeLedger()}return parseOfficeSmokeLedger(value)}
export function validationsForArtifact(ledger:OfficeSmokeLedger,sha256:string){const key=sha256.toLowerCase();return ledger.validations.filter((item)=>item.artifact.sha256===key)}
