import type { WorkspaceState } from './model.ts'
import { planOfficeImport, type OfficeImportPlan } from './officeImportPlanner.ts'
import { synchronizeOfficeImportPlan } from './officeImportSync.ts'
import { preserveXlsxCommentMetadata } from './xlsxCommentImport.ts'
import { preserveXlsxHyperlinkMetadata } from './xlsxHyperlinkImport.ts'
import { preserveXlsxNumberFormatMetadata } from './xlsxNumberFormatImport.ts'
import { preserveXlsxSharedFormulaMetadata } from './xlsxSharedFormulaImport.ts'
import { preserveXlsxSheetVisibility } from './xlsxSheetVisibilityImport.ts'
import { preserveXlsxThreadedCommentMetadata } from './xlsxThreadedCommentImport.ts'

/**
 * Full interoperability pipeline for new Office import surfaces.
 * Parse first, enrich fidelity metadata, then synchronize against any prior
 * projection from the same source before governance/preview is calculated.
 */
export async function planOfficeInteropImport(
  workspace:WorkspaceState,
  input:ArrayBuffer|Uint8Array,
  fileName:string,
):Promise<OfficeImportPlan>{
  const parsed=await planOfficeImport(workspace,input,fileName)
  const withVisibility=await preserveXlsxSheetVisibility(workspace,input,fileName,parsed)
  const withFormats=await preserveXlsxNumberFormatMetadata(workspace,input,fileName,withVisibility)
  const withLinks=await preserveXlsxHyperlinkMetadata(workspace,input,fileName,withFormats)
  const withComments=await preserveXlsxCommentMetadata(workspace,input,fileName,withLinks)
  const withThreads=await preserveXlsxThreadedCommentMetadata(workspace,input,fileName,withComments)
  const enriched=await preserveXlsxSharedFormulaMetadata(input,fileName,withThreads)
  return synchronizeOfficeImportPlan(workspace,enriched,fileName)
}
