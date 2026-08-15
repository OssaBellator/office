import { summarizeImportedDataReview } from './importedDataReview.ts'
import type { WorkspaceState } from './model.ts'
import { assessOfficeExport, type OfficeExportAssessment } from './officeExportAssessment.ts'

export type OfficeReviewAssessment={
  exportAssessment:OfficeExportAssessment
  importedCellNotes:{total:number;sources:string[];authors:string[];tables:string[]}
  warnings:string[]
}

/**
 * Adds review-provenance information to the normal Office export preflight.
 * Classic Excel cell notes are intentionally Frame-only until a repair-free
 * comments + VML writer has been validated in current Excel clients.
 */
export function assessOfficeReviewExport(workspace:WorkspaceState):OfficeReviewAssessment{
  const exportAssessment=assessOfficeExport(workspace)
  const importedCellNotes=summarizeImportedDataReview(workspace)
  const warnings=[...exportAssessment.warnings]
  if(importedCellNotes.total){
    warnings.push(`${importedCellNotes.total} imported Excel cell note${importedCellNotes.total===1?' remains':'s remain'} as Frame review provenance and ${importedCellNotes.total===1?'is':'are'} not projected into normal XLSX export yet.`)
  }
  return{exportAssessment,importedCellNotes,warnings}
}
