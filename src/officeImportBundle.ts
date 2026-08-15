import type { WorkspaceState } from './model.ts'
import { createOfficeImportReceipt, type OfficeImportReceipt } from './officeImportReceipt.ts'
import type { OfficeImportPlan } from './officeImportPlanner.ts'
import { planSecureOfficeImport } from './officeSecureImport.ts'

export type SecureOfficeImportBundle={plan:OfficeImportPlan;receipt:OfficeImportReceipt}

/** Canonical server/cloud-friendly boundary: secure plan plus immutable source identity. */
export async function planSecureOfficeImportBundle(
  workspace:WorkspaceState,
  input:ArrayBuffer|Uint8Array,
  fileName:string,
  createdAt?:string,
):Promise<SecureOfficeImportBundle>{
  const plan=await planSecureOfficeImport(workspace,input,fileName)
  const receipt=await createOfficeImportReceipt(input,fileName,plan,createdAt)
  return{plan,receipt}
}
