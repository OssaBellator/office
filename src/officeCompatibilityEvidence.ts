import type { OfficeExportBundleReceipt, OfficeExportReceipt } from './officeExportReceipt.ts'
import { smokeValidationPassesReleaseGate, type OfficeSmokeApplication, type OfficeSmokeValidation } from './officeSmokeValidation.ts'

export type OfficeCompatibilityRequirement={kind:'docx'|'pptx'|'xlsx';applications:OfficeSmokeApplication[]}
export type OfficeArtifactEvidence={receipt:OfficeExportReceipt;validations:OfficeSmokeValidation[];missingApplications:OfficeSmokeApplication[];passingApplications:OfficeSmokeApplication[];ready:boolean}
export type OfficeBundleEvidence={artifacts:OfficeArtifactEvidence[];ready:boolean}

function validationsForReceipt(receipt:OfficeExportReceipt,validations:OfficeSmokeValidation[]){return validations.filter((item)=>item.artifact.kind===receipt.kind&&item.artifact.sha256===receipt.sha256&&item.artifact.fileName===receipt.fileName)}
export function evaluateOfficeCompatibilityEvidence(bundle:OfficeExportBundleReceipt,validations:OfficeSmokeValidation[],requirements:OfficeCompatibilityRequirement[]):OfficeBundleEvidence{
  const artifacts=bundle.artifacts.map((receipt)=>{
    const required=requirements.find((item)=>item.kind===receipt.kind)?.applications??[]
    const matched=validationsForReceipt(receipt,validations)
    const passingApplications=required.filter((application)=>matched.some((validation)=>validation.application===application&&smokeValidationPassesReleaseGate(validation)))
    const missingApplications=required.filter((application)=>!passingApplications.includes(application))
    return{receipt,validations:matched,missingApplications,passingApplications,ready:missingApplications.length===0}
  })
  return{artifacts,ready:artifacts.every((artifact)=>artifact.ready)}
}

export function defaultOfficeCompatibilityRequirements():OfficeCompatibilityRequirement[]{return[
  {kind:'docx',applications:['microsoft-word']},
  {kind:'pptx',applications:['microsoft-powerpoint']},
  {kind:'xlsx',applications:['microsoft-excel']},
]}
