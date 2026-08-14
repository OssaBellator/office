import type { WorkspaceState } from './model.ts'
import { planOfficeInteropImport } from './officeInteropImport.ts'
import { getGoogleWorkspaceExportFormat, type GoogleWorkspaceExportProvider, type GoogleWorkspaceFile } from './googleWorkspaceImport.ts'
import type { OfficeImportPlan } from './officeImportPlanner.ts'

/** Direct Google import through the same fully enriched Office interoperability pipeline. */
export async function planGoogleWorkspaceInteropImport(
  workspace:WorkspaceState,
  file:GoogleWorkspaceFile,
  provider:GoogleWorkspaceExportProvider,
):Promise<OfficeImportPlan>{
  const format=getGoogleWorkspaceExportFormat(file.kind)
  const bytes=await provider.exportFile({fileId:file.id,mimeType:format.mimeType})
  return planOfficeInteropImport(workspace,bytes,`${file.name}.${format.extension}`)
}
