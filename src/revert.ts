import type { WorkspaceState } from './model.ts'
import { getEditableChart } from './chartModel.ts'
import { getPresentationState } from './presentationState.ts'
import { getSemanticDocument } from './semanticDocument.ts'
import { executeVersionedWorkspaceCommand, type VersionedWorkspaceSession, type VersionedWorkspaceTransaction } from './versioning.ts'
import type { VersionedWorkspaceCommand } from './semanticCommands.ts'
import { compareWorkspaceStates } from './workspaceCompare.ts'
export type RevertConflict={objectId:string;field:string;message:string}
export type RevertPlan={transaction:VersionedWorkspaceTransaction;canRevert:boolean;inverseCommand:VersionedWorkspaceCommand|null;diffs:ReturnType<typeof compareWorkspaceStates>;conflicts:RevertConflict[]}
const conflict=(objectId:string,field:string,message:string):RevertConflict=>({objectId,field,message})
function semanticJson(workspace:WorkspaceState){return JSON.stringify(getSemanticDocument(workspace))}
function presentationJson(workspace:WorkspaceState){return JSON.stringify(getPresentationState(workspace))}
export function planTransactionRevert(session:VersionedWorkspaceSession,transactionId:string):RevertPlan{
  const transaction=session.past.find((x)=>x.id===transactionId);if(!transaction)throw new Error(`Unknown applied transaction: ${transactionId}`);const conflicts:RevertConflict[]=[];let inverseCommand:VersionedWorkspaceCommand|null=null;const current=session.present,command=transaction.command
  switch(command.type){
    case'region.update':{const before=transaction.before.regions.find((x)=>x.id===command.regionId),after=transaction.after.regions.find((x)=>x.id===command.regionId),now=current.regions.find((x)=>x.id===command.regionId);if(!before||!after||!now)conflicts.push(conflict(`region:${command.regionId}`,String(command.field),'Region no longer exists'));else if(!Object.is(now[command.field],after[command.field]))conflicts.push(conflict(`region:${command.regionId}`,String(command.field),'Field changed again after this transaction'));else inverseCommand={type:'region.update',regionId:command.regionId,field:command.field,value:before[command.field]};break}
    case'plan.update':{const before=transaction.before.plans.find((x)=>x.id===command.planId),after=transaction.after.plans.find((x)=>x.id===command.planId),now=current.plans.find((x)=>x.id===command.planId);if(!before||!after||!now)conflicts.push(conflict(`plan:${command.planId}`,String(command.field),'Plan row no longer exists'));else if(!Object.is(now[command.field],after[command.field]))conflicts.push(conflict(`plan:${command.planId}`,String(command.field),'Plan field changed again after this transaction'));else inverseCommand={type:'plan.update',planId:command.planId,field:command.field,value:before[command.field]};break}
    case'decision.status':{const before=transaction.before.decisions.find((x)=>x.id===command.decisionId),after=transaction.after.decisions.find((x)=>x.id===command.decisionId),now=current.decisions.find((x)=>x.id===command.decisionId);if(!before||!after||!now)conflicts.push(conflict(`decision:${command.decisionId}`,'status','Decision no longer exists'));else if(now.status!==after.status)conflicts.push(conflict(`decision:${command.decisionId}`,'status','Decision status changed again after this transaction'));else inverseCommand={type:'decision.status',decisionId:command.decisionId,status:before.status};break}
    case'document.append':if(current.document.body!==transaction.after.document.body)conflicts.push(conflict('document:strategy','body','Document body changed after the append'));else inverseCommand={type:'document.update',field:'body',value:transaction.before.document.body};break
    case'document.update':if(current.document[command.field]!==transaction.after.document[command.field])conflicts.push(conflict('document:strategy',String(command.field),'Document field changed again after this transaction'));else inverseCommand={type:'document.update',field:command.field,value:transaction.before.document[command.field]};break
    case'document.semantic.replace':
    case'document.block.update':
    case'document.block.insert':
    case'document.block.remove':
    case'document.block.move':
    case'claim.update':
    case'citation.update':
    case'annotation.insert':
    case'annotation.update':
    case'annotation.remove':if(semanticJson(current)!==semanticJson(transaction.after))conflicts.push(conflict('document:strategy','semanticDocument','Semantic document changed again after this transaction'));else inverseCommand={type:'document.semantic.replace',value:getSemanticDocument(transaction.before)};break
    case'chart.kind':{const before=transaction.before.charts.find((x)=>x.id===command.chartId),after=transaction.after.charts.find((x)=>x.id===command.chartId);let now;try{now=getEditableChart(current,command.chartId)}catch{now=null}if(!before||!after||!now)conflicts.push(conflict(`chart:${command.chartId}`,'kind','Chart no longer exists'));else if(String(now.kind)!==String(after.kind))conflicts.push(conflict(`chart:${command.chartId}`,'kind','Chart kind changed again after this transaction'));else inverseCommand={type:'chart.kind',chartId:command.chartId,kind:String(before.kind)==='line'?'line':'grouped-bar'};break}
    case'presentation.replace':
    case'presentation.scene.move':
    case'presentation.scene.visibility':
    case'presentation.note.update':if(presentationJson(current)!==presentationJson(transaction.after))conflicts.push(conflict('presentation:story','state','Board narrative changed again after this transaction'));else inverseCommand={type:'presentation.replace',value:getPresentationState(transaction.before)};break
    case'metric.formula':{const before=transaction.before.metrics.find((x)=>x.id===command.metricId),after=transaction.after.metrics.find((x)=>x.id===command.metricId),now=current.metrics.find((x)=>x.id===command.metricId);if(!before||!after||!now)conflicts.push(conflict(`metric:${command.metricId}`,'formula','Metric no longer exists'));else if((now.formula??null)!==(after.formula??null))conflicts.push(conflict(`metric:${command.metricId}`,'formula','Formula changed again after this transaction'));else inverseCommand={type:'metric.formula',metricId:command.metricId,formula:before.formula??null,fallbackValue:before.value};break}
    case'source.status':{const before=transaction.before.sources.find((x)=>x.id===command.sourceId),after=transaction.after.sources.find((x)=>x.id===command.sourceId),now=current.sources.find((x)=>x.id===command.sourceId);if(!before||!after||!now)conflicts.push(conflict(command.sourceId,'status','Source no longer exists'));else if(now.status!==after.status)conflicts.push(conflict(command.sourceId,'status','Source freshness changed again after this transaction'));else inverseCommand={type:'source.status',sourceId:command.sourceId,status:before.status};break}
  }
  return{transaction,canRevert:conflicts.length===0&&inverseCommand!==null,inverseCommand,diffs:compareWorkspaceStates(transaction.before,transaction.after),conflicts}
}
export function revertVersionedTransaction(session:VersionedWorkspaceSession,transactionId:string){const plan=planTransactionRevert(session,transactionId);if(!plan.canRevert||!plan.inverseCommand)return{session,plan};return{plan,session:executeVersionedWorkspaceCommand(session,plan.inverseCommand,{kind:'revert',reverts:transactionId})}}
export function getTransactionDiff(transaction:VersionedWorkspaceTransaction){return compareWorkspaceStates(transaction.before,transaction.after)}