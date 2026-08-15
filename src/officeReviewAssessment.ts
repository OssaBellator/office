import { summarizeImportedDataReview } from './importedDataReview.ts'
import type { WorkspaceState } from './model.ts'
import { assessOfficeExport, type OfficeExportAssessment } from './officeExportAssessment.ts'

export type OfficeReviewAssessment={
  exportAssessment:OfficeExportAssessment
  importedCellNotes:{total:number;sources:string[];authors:string[];tables:string[]}
  warnings:string[]
}

/**
 * Adds source/author/table aggregation for imported Data review provenance to
 * the normal Office export preflight. The base export assessment owns fidelity
 * warnings so callers never see duplicate classic-note warnings.
 */
export function assessOfficeReviewExport(workspace:WorkspaceState):OfficeReviewAssessment{
  const exportAssessment=assessOfficeExport(workspace)
  const importedCellNotes=summarizeImportedDataReview(workspace)
  return{exportAssessment,importedCellNotes,warnings:[...exportAssessment.warnings]}
}
