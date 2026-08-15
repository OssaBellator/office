import { approveAutomation, executeGovernedAutomation, planGovernedAutomation, type AutomationApproval, type GovernedAutomationPlan } from './governedAutomation.ts'
import { migrationBatchMatchesWorkspace, type OfficeMigrationBatchPlan } from './officeMigrationBatch.ts'
import type { VersionedWorkspaceSession } from './versioning.ts'

export type GovernedOfficeMigrationPreparation={batch:OfficeMigrationBatchPlan;automation:GovernedAutomationPlan}

export async function prepareGovernedOfficeMigration(session:VersionedWorkspaceSession,batch:OfficeMigrationBatchPlan,role:Parameters<typeof planGovernedAutomation>[1]='owner'):Promise<GovernedOfficeMigrationPreparation>{
  if(!(await migrationBatchMatchesWorkspace(batch,session.present)))throw new Error('Office migration batch is stale because the workspace changed after the batch was prepared')
  if(batch.files.some((file)=>file.status==='failed'))throw new Error('Office migration batch contains failed source files and cannot be executed as a single governed batch')
  return{batch,automation:planGovernedAutomation(session,role,batch.commands,batch.warnings)}
}

export async function executePreparedOfficeMigration(session:VersionedWorkspaceSession,batch:OfficeMigrationBatchPlan,options:{role?:Parameters<typeof planGovernedAutomation>[1];approvedBy?:string;approval?:AutomationApproval}={}):Promise<VersionedWorkspaceSession>{
  const prepared=await prepareGovernedOfficeMigration(session,batch,options.role??'owner')
  const approval=options.approval??(prepared.automation.governance.requiresApproval?approveAutomation(prepared.automation,options.approvedBy??'Workspace owner'):undefined)
  return executeGovernedAutomation(session,prepared.automation,approval)
}
