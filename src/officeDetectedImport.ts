import type { WorkspaceState } from './model.ts'
import type { OfficeImportPlan } from './officeImportPlanner.ts'
import { planOfficeInteropImport } from './officeInteropImport.ts'
import { detectOfficePackageKind, normalizedOfficeFileName, officeKindFromFileName } from './officeKindDetection.ts'

export type DetectedOfficeImportPlan=OfficeImportPlan&{detectedFileName:string;originalFileName:string;fileNameCorrected:boolean}

export async function planDetectedOfficeImport(
  workspace:WorkspaceState,
  input:ArrayBuffer|Uint8Array,
  fileName:string,
):Promise<DetectedOfficeImportPlan>{
  const detected=await detectOfficePackageKind(input)
  const original=fileName.trim()||`import.${detected.kind}`
  const normalized=normalizedOfficeFileName(original,detected.kind)
  const plan=await planOfficeInteropImport(workspace,input,normalized)
  const declared=officeKindFromFileName(original)
  const corrected=original!==normalized
  const warnings=[...plan.warnings]
  if(corrected){
    const reason=declared?`filename declares .${declared} but package content is ${detected.kind.toUpperCase()}`:`filename did not identify a supported Office format; package content is ${detected.kind.toUpperCase()}`
    warnings.unshift(`Frame corrected the import filename to ${normalized} because ${reason}.`)
  }
  return{...plan,warnings,detectedFileName:normalized,originalFileName:original,fileNameCorrected:corrected}
}
