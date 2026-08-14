import type { WorkspaceState } from './model.ts'
import { planOfficeImport, type OfficeImportPlan } from './officeImportPlanner.ts'
import { synchronizeOfficeImportPlan } from './officeImportSync.ts'

export type GoogleWorkspaceKind = 'document' | 'spreadsheet' | 'presentation'
export type GoogleWorkspaceFile = { id:string; name:string; kind:GoogleWorkspaceKind }
export type GoogleWorkspaceExportRequest = { fileId:string; mimeType:string }
export type GoogleWorkspaceExportProvider = { exportFile(request:GoogleWorkspaceExportRequest):Promise<ArrayBuffer|Uint8Array> }

const formats:Record<GoogleWorkspaceKind,{mimeType:string;extension:'docx'|'xlsx'|'pptx'}>={
  document:{mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',extension:'docx'},
  spreadsheet:{mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',extension:'xlsx'},
  presentation:{mimeType:'application/vnd.openxmlformats-officedocument.presentationml.presentation',extension:'pptx'},
}

export function getGoogleWorkspaceExportFormat(kind:GoogleWorkspaceKind){return formats[kind]}

export async function planGoogleWorkspaceImport(workspace:WorkspaceState,file:GoogleWorkspaceFile,provider:GoogleWorkspaceExportProvider):Promise<OfficeImportPlan>{
  const format=formats[file.kind]
  const bytes=await provider.exportFile({fileId:file.id,mimeType:format.mimeType})
  const fileName=`${file.name}.${format.extension}`
  const plan=await planOfficeImport(workspace,bytes,fileName)
  return synchronizeOfficeImportPlan(workspace,plan,fileName)
}
