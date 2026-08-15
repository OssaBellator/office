import type { OfficeExportFile } from './officeExport.ts'
import type { OfficeExportReceipt } from './officeExportReceipt.ts'
import { sha256OfficeInput } from './officeImportReceipt.ts'

export type OfficeExportReceiptVerification={matches:boolean;metadataMatches:boolean;hashMatches:boolean;expectedSha256:string;actualSha256:string}

export async function verifyOfficeExportReceipt(receipt:OfficeExportReceipt,file:OfficeExportFile):Promise<OfficeExportReceiptVerification>{
  const metadataMatches=receipt.fileName===file.filename&&receipt.mimeType===file.mimeType&&receipt.byteLength===file.bytes.byteLength
  const actualSha256=await sha256OfficeInput(file.bytes),hashMatches=actualSha256===receipt.sha256
  return{matches:metadataMatches&&hashMatches,metadataMatches,hashMatches,expectedSha256:receipt.sha256,actualSha256}
}
