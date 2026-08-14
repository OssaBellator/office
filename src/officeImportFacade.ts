import type { WorkspaceState } from './model.ts'
import { planOfficeImport, type OfficeImportPlan } from './officeImportPlanner.ts'
import { synchronizeOfficeImportPlan } from './officeImportSync.ts'

/**
 * Canonical Office planning entry point for interactive imports.
 *
 * It keeps the low-level parser/planner pure while ensuring that importing a
 * newer revision of the same source replaces the prior imported projection
 * instead of accumulating duplicate blocks/tables/scenes.
 */
export async function planSynchronizedOfficeImport(
  workspace:WorkspaceState,
  input:ArrayBuffer|Uint8Array,
  fileName:string,
):Promise<OfficeImportPlan>{
  const plan=await planOfficeImport(workspace,input,fileName)
  return synchronizeOfficeImportPlan(workspace,plan,fileName)
}
