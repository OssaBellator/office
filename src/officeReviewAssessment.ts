import { summarizeImportedDataReview } from './importedDataReview.ts'
import { summarizeImportedThreadedReview } from './importedThreadedReview.ts'
import type { WorkspaceState } from './model.ts'
import { assessOfficeExport, type OfficeExportAssessment } from './officeExportAssessment.ts'

export type OfficeReviewAssessment={
  exportAssessment:OfficeExportAssessment
  importedCellNotes:{total:number;sources:string[];authors:string[];tables:string[]}
  importedThreads:{threads:number;comments:number;open:number;resolved:number;sources:string[];participants:string[]}
  warnings:string[]
}

/**
 * Adds source/author/table/participant aggregation for imported Data review
 * provenance to the normal Office export preflight. The base export assessment
 * owns fidelity warnings so callers never receive duplicate policy messages.
 */
export function assessOfficeReviewExport(workspace:WorkspaceState):OfficeReviewAssessment{
  const exportAssessment=assessOfficeExport(workspace)
  const importedCellNotes=summarizeImportedDataReview(workspace)
  const importedThreads=summarizeImportedThreadedReview(workspace)
  return{exportAssessment,importedCellNotes,importedThreads,warnings:[...exportAssessment.warnings]}
}
