import type { WorkspaceState } from './model.ts'
import { planOfficeImport, type OfficeImportPlan } from './officeImportPlanner.ts'

export type GoogleWorkspaceKind = 'document' | 'spreadsheet' | 'presentation'
export type GoogleWorkspaceFile = { id:string; name:string; kind:GoogleWorkspaceKind }
export type GoogleWorkspaceExportRequest = { fileId:string; mimeType:string }
export type GoogleWorkspaceExportProvider = {
  exportFile(request: GoogleWorkspaceExportRequest): Promise<ArrayBuffer | Uint8Array>
}

const exportsByKind: Record<GoogleWorkspaceKind,{extension:'docx'|'xlsx'|'pptx';mimeType:string}> = {
  document:{extension:'docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'},
  spreadsheet:{extension:'xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'},
  presentation:{extension:'pptx',mimeType:'application/vnd.openxmlformats-officedocument.presentationml.presentation'},
}

export function getGoogleWorkspaceExportFormat(kind:GoogleWorkspaceKind){return exportsByKind[kind]}

export async function planGoogleWorkspaceImport(workspace:WorkspaceState,file:GoogleWorkspaceFile,provider:GoogleWorkspaceExportProvider):Promise<OfficeImportPlan>{
  const format=exportsByKind[file.kind]
  const bytes=await provider.exportFile({fileId:file.id,mimeType:format.mimeType})
  const base=file.name.replace(/\.[^.]+$/,'')||'Google Workspace import'
  return planOfficeImport(workspace,bytes,`${base}.${format.extension}`)
}
