import type { WorkspaceState } from './model.ts'
import { assessOfficeReviewExport } from './officeReviewAssessment.ts'
import { exportWorkspaceDocx, exportWorkspacePptx, exportWorkspaceXlsx, type OfficeExportFile } from './officeExport.ts'
import { sha256OfficeInput } from './officeImportReceipt.ts'

export type OfficeExportReceipt={
  schema:'frame.office-export-receipt'
  version:1
  kind:'docx'|'pptx'|'xlsx'
  fileName:string
  mimeType:string
  byteLength:number
  sha256:string
  generatedAt:string
}
export type OfficeExportBundleReceipt={
  schema:'frame.office-export-bundle-receipt'
  version:1
  generatedAt:string
  artifacts:OfficeExportReceipt[]
  fidelity:ReturnType<typeof assessOfficeReviewExport>
}

function kindFromFile(file:OfficeExportFile):OfficeExportReceipt['kind']{if(/\.docx$/i.test(file.filename))return'docx';if(/\.pptx$/i.test(file.filename))return'pptx';if(/\.xlsx$/i.test(file.filename))return'xlsx';throw new Error(`Unsupported Office export receipt filename: ${file.filename}`)}
export async function createOfficeExportReceipt(file:OfficeExportFile,generatedAt=new Date().toISOString()):Promise<OfficeExportReceipt>{return{schema:'frame.office-export-receipt',version:1,kind:kindFromFile(file),fileName:file.filename,mimeType:file.mimeType,byteLength:file.bytes.byteLength,sha256:await sha256OfficeInput(file.bytes),generatedAt}}

export async function createOfficeExportBundleReceipt(workspace:WorkspaceState,generatedAt=new Date().toISOString()):Promise<{files:OfficeExportFile[];receipt:OfficeExportBundleReceipt}>{
  const files=[exportWorkspaceDocx(workspace),exportWorkspacePptx(workspace),exportWorkspaceXlsx(workspace)]
  const artifacts=[]
  for(const file of files)artifacts.push(await createOfficeExportReceipt(file,generatedAt))
  return{files,receipt:{schema:'frame.office-export-bundle-receipt',version:1,generatedAt,artifacts,fidelity:assessOfficeReviewExport(workspace)}}
}

export function exportReceiptMatchesArtifact(receipt:OfficeExportReceipt,file:OfficeExportFile){return receipt.fileName===file.filename&&receipt.mimeType===file.mimeType&&receipt.byteLength===file.bytes.byteLength}
