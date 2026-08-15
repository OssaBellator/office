import type { WorkspaceState } from './model.ts'
import { planOfficeImport, type OfficeImportPlan } from './officeImportPlanner.ts'
import { synchronizeOfficeImportPlan } from './officeImportSync.ts'
import { preserveXlsxSharedFormulaMetadata } from './xlsxSharedFormulaImport.ts'
import { preserveXlsxSheetVisibility } from './xlsxSheetVisibilityImport.ts'

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
  const enriched=await preserveXlsxSharedFormulaMetadata(input,fileName,withVisibility)
  return synchronizeOfficeImportPlan(workspace,enriched,fileName)
}
