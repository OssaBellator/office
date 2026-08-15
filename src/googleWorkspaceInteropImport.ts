import type { WorkspaceState } from './model.ts'
import { planSecureOfficeImport } from './officeSecureImport.ts'
import { getGoogleWorkspaceExportFormat, type GoogleWorkspaceExportProvider, type GoogleWorkspaceFile } from './googleWorkspaceImport.ts'
import type { OfficeImportPlan } from './officeImportPlanner.ts'

/** Direct Google import through the same secure, enriched Office interoperability pipeline. */
export async function planGoogleWorkspaceInteropImport(
  workspace:WorkspaceState,
  file:GoogleWorkspaceFile,
  provider:GoogleWorkspaceExportProvider,
):Promise<OfficeImportPlan>{
  const format=getGoogleWorkspaceExportFormat(file.kind)
  const bytes=await provider.exportFile({fileId:file.id,mimeType:format.mimeType})
  const base=file.name.replace(/\.[^.]+$/,'')||'Google Workspace import'
  return planSecureOfficeImport(workspace,bytes,`${base}.${format.extension}`)
}
