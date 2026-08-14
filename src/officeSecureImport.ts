import type { WorkspaceState } from './model.ts'
import type { DetectedOfficeImportPlan } from './officeDetectedImport.ts'
import { planDetectedOfficeImport } from './officeDetectedImport.ts'
import { assertOfficeImportSafe } from './officeImportSecurity.ts'

/** Safest current Office import entry point for new product surfaces. */
export async function planSecureOfficeImport(
  workspace:WorkspaceState,
  input:ArrayBuffer|Uint8Array,
  fileName:string,
):Promise<DetectedOfficeImportPlan>{
  const findings=await assertOfficeImportSafe(input)
  const plan=await planDetectedOfficeImport(workspace,input,fileName)
  const notices=[...new Set(findings.filter((finding)=>finding.severity==='notice').map((finding)=>finding.detail))]
  return notices.length?{...plan,warnings:[...notices,...plan.warnings]}:plan
}
