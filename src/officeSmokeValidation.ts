export type OfficeSmokeApplication='microsoft-word'|'microsoft-excel'|'microsoft-powerpoint'|'google-docs'|'google-sheets'|'google-slides'|'libreoffice-writer'|'libreoffice-calc'|'libreoffice-impress'
export type OfficeSmokeOutcome='pass'|'pass-with-differences'|'repair-required'|'fail'
export type OfficeSmokeValidation={
  schema:'frame.office-smoke-validation'
  version:1
  artifact:{fileName:string;sha256:string;kind:'docx'|'pptx'|'xlsx'}
  application:OfficeSmokeApplication
  applicationVersion?:string
  platform?:string
  testedAt:string
  testedBy?:string
  outcome:OfficeSmokeOutcome
  repairPrompt:boolean
  observations:string[]
  checks:Record<string,boolean>
}

const applications:OfficeSmokeApplication[]=['microsoft-word','microsoft-excel','microsoft-powerpoint','google-docs','google-sheets','google-slides','libreoffice-writer','libreoffice-calc','libreoffice-impress']
const outcomes:OfficeSmokeOutcome[]=['pass','pass-with-differences','repair-required','fail']
function record(value:unknown,field:string):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(`${field} must be an object`);return value as Record<string,unknown>}
function text(value:unknown,field:string){if(typeof value!=='string')throw new Error(`${field} must be a string`);return value}
function optionalText(value:unknown,field:string){return value===undefined?undefined:text(value,field)}
function boolean(value:unknown,field:string){if(typeof value!=='boolean')throw new Error(`${field} must be a boolean`);return value}

export function createOfficeSmokeValidation(input:Omit<OfficeSmokeValidation,'schema'|'version'>):OfficeSmokeValidation{return{schema:'frame.office-smoke-validation',version:1,...structuredClone(input)}}
export function parseOfficeSmokeValidation(value:unknown):OfficeSmokeValidation{
  const input=record(value,'Office smoke validation')
  if(input.schema!=='frame.office-smoke-validation'||input.version!==1)throw new Error('Unsupported Office smoke validation schema/version')
  const artifact=record(input.artifact,'artifact'),fileName=text(artifact.fileName,'artifact.fileName'),sha256=text(artifact.sha256,'artifact.sha256').toLowerCase(),kind=text(artifact.kind,'artifact.kind') as OfficeSmokeValidation['artifact']['kind']
  if(!/^[0-9a-f]{64}$/.test(sha256))throw new Error('artifact.sha256 must be a 64-character SHA-256 hex digest')
  if(!['docx','pptx','xlsx'].includes(kind))throw new Error('artifact.kind must be docx, pptx, or xlsx')
  const application=text(input.application,'application') as OfficeSmokeApplication;if(!applications.includes(application))throw new Error('Unsupported Office smoke application')
  const outcome=text(input.outcome,'outcome') as OfficeSmokeOutcome;if(!outcomes.includes(outcome))throw new Error('Unsupported Office smoke outcome')
  if(!Array.isArray(input.observations)||!input.observations.every((item)=>typeof item==='string'))throw new Error('observations must be a string array')
  const rawChecks=record(input.checks,'checks'),checks:Record<string,boolean>={};for(const [key,result] of Object.entries(rawChecks))checks[key]=boolean(result,`checks.${key}`)
  return{schema:'frame.office-smoke-validation',version:1,artifact:{fileName,sha256,kind},application,applicationVersion:optionalText(input.applicationVersion,'applicationVersion'),platform:optionalText(input.platform,'platform'),testedAt:text(input.testedAt,'testedAt'),testedBy:optionalText(input.testedBy,'testedBy'),outcome,repairPrompt:boolean(input.repairPrompt,'repairPrompt'),observations:[...input.observations] as string[],checks}
}
export function serializeOfficeSmokeValidation(value:OfficeSmokeValidation){return JSON.stringify(value)}
export function deserializeOfficeSmokeValidation(json:string){let value:unknown;try{value=JSON.parse(json)}catch{throw new Error('Office smoke validation is not valid JSON')}return parseOfficeSmokeValidation(value)}
export function smokeValidationPassesReleaseGate(value:OfficeSmokeValidation){return(value.outcome==='pass'||value.outcome==='pass-with-differences')&&!value.repairPrompt&&Object.values(value.checks).every(Boolean)}
