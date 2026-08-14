import { type TableData, type TableSchema } from './formulas.ts'
import { evaluateSemanticExpression } from './expressions.ts'

export type Surface = 'docs' | 'data' | 'present'
export type ObjectKind = 'document' | 'region' | 'plan' | 'metric' | 'decision' | 'scene' | 'chart'
export type Metric = { id:string; label:string; value:number; previous:number; format:'currency'|'percent'|'number'; source:string; updatedAt:string; formula?:string }
export type RegionRow = { id:string; region:string; revenue:number; growth:number; margin:number }
export type PlanRow = { id:string; region:string; revenue:number }
export type TableRelationship = { id:string; label:string; fromTable:string; fromField:string; toTable:string; toField:string; cardinality:'one-to-one'|'many-to-one' }
export type ChartSeries = { id:string; label:string; tableId:string; fieldId:string }
export type ChartDefinition = { id:string; label:string; kind:'grouped-bar'; relationshipId:string; category:{tableId:string;fieldId:string}; series:ChartSeries[] }
export type Decision = { id:string; title:string; status:'approved'|'pending'; owner:string; rationale:string }
export type SourceRecord = { id:string; label:string; type:'dataset'|'research'|'manual'; locator:string; status:'live'|'stale'; updatedAt:string }
export type WorkspaceObject = { id:string; kind:ObjectKind; label:string; surfaces:Surface[] }
export type DependencyRelation = 'derives'|'renders'|'supports'|'decides'
export type DependencyEdge = { from:string; to:string; relation:DependencyRelation; description:string }
export type ChangeEvent = { id:string; changedAt:string; summary:string; changedObjectIds:string[]; affectedObjectIds:string[] }
export type WorkspaceGraph = { objects:WorkspaceObject[]; edges:DependencyEdge[] }
export type WorkspaceState = { title:string; document:{eyebrow:string;title:string;summary:string;body:string}; metrics:Metric[]; regions:RegionRow[]; plans:PlanRow[]; relationships:TableRelationship[]; charts:ChartDefinition[]; decisions:Decision[]; sources:SourceRecord[]; graph:WorkspaceGraph; history:ChangeEvent[] }
export type WorkspaceImpact = WorkspaceObject & { reason:string }
export type WorkspaceMutationResult = { workspace:WorkspaceState; impacts:WorkspaceImpact[]; event:ChangeEvent }
export type WorkspaceCommand =
  | { type:'region.update'; regionId:string; field:keyof RegionRow; value:string|number; changedAt?:string }
  | { type:'plan.update'; planId:string; field:keyof PlanRow; value:string|number; changedAt?:string }
  | { type:'decision.status'; decisionId:string; status:Decision['status']; changedAt?:string }
  | { type:'document.append'; text:string; changedAt?:string }
export type WorkspaceTransaction = { id:string; command:WorkspaceCommand; summary:string; before:WorkspaceState; after:WorkspaceState }
export type WorkspaceSession = { present:WorkspaceState; past:WorkspaceTransaction[]; future:WorkspaceTransaction[] }

function buildSeedGraph(): WorkspaceGraph {
  const objects: WorkspaceObject[] = [
    { id:'document:strategy', kind:'document', label:'Strategy document', surfaces:['docs'] },
    { id:'metric:revenue', kind:'metric', label:'Q2 revenue', surfaces:['docs','data','present'] },
    { id:'metric:growth', kind:'metric', label:'YoY growth', surfaces:['docs','data','present'] },
    { id:'metric:margin', kind:'metric', label:'Gross margin', surfaces:['docs','data'] },
    { id:'metric:planRevenue', kind:'metric', label:'Q2 revenue plan', surfaces:['docs','data','present'] },
    { id:'metric:variance', kind:'metric', label:'Revenue variance', surfaces:['docs','data','present'] },
    { id:'decision:launch', kind:'decision', label:'APAC expansion decision', surfaces:['docs','present'] },
    { id:'scene:performance', kind:'scene', label:'Board narrative · Performance', surfaces:['present'] },
    { id:'scene:decision', kind:'scene', label:'Board narrative · Decision', surfaces:['present'] },
    { id:'chart:revenue-vs-plan', kind:'chart', label:'Actual vs plan by region', surfaces:['data','present'] },
    { id:'region:na', kind:'region', label:'North America', surfaces:['data'] },
    { id:'region:eu', kind:'region', label:'Europe', surfaces:['data'] },
    { id:'region:apac', kind:'region', label:'APAC', surfaces:['data'] },
    { id:'region:latam', kind:'region', label:'Latin America', surfaces:['data'] },
    { id:'plan:na', kind:'plan', label:'North America plan', surfaces:['data'] },
    { id:'plan:eu', kind:'plan', label:'Europe plan', surfaces:['data'] },
    { id:'plan:apac', kind:'plan', label:'APAC plan', surfaces:['data'] },
    { id:'plan:latam', kind:'plan', label:'Latin America plan', surfaces:['data'] },
  ]
  const edges: DependencyEdge[] = [
    ...['na','eu','apac','latam'].map((region)=>({from:`region:${region}`,to:'metric:revenue',relation:'derives' as const,description:'Regional revenue contributes to the Q2 revenue metric'})),
    ...['na','eu','apac','latam'].map((region)=>({from:`plan:${region}`,to:'metric:planRevenue',relation:'derives' as const,description:'Regional plan contributes to the Q2 revenue plan metric'})),
    {from:'metric:revenue',to:'document:strategy',relation:'renders',description:'Revenue is embedded in the strategy snapshot'},
    {from:'metric:growth',to:'document:strategy',relation:'renders',description:'Growth is embedded in the strategy snapshot'},
    {from:'metric:planRevenue',to:'document:strategy',relation:'renders',description:'Revenue plan is embedded in the strategy snapshot'},
    ...['na','eu','apac','latam'].map((region)=>({from:`region:${region}`,to:'metric:variance',relation:'derives' as const,description:'Regional actuals contribute to revenue variance'})),
    ...['na','eu','apac','latam'].map((region)=>({from:`plan:${region}`,to:'metric:variance',relation:'derives' as const,description:'Regional plans contribute to revenue variance'})),
    {from:'metric:variance',to:'document:strategy',relation:'renders',description:'Revenue variance is embedded in the strategy snapshot'},
    {from:'metric:variance',to:'scene:performance',relation:'renders',description:'Revenue variance informs the performance scene'},
    {from:'metric:revenue',to:'chart:revenue-vs-plan',relation:'renders',description:'Actual revenue feeds the shared comparison chart'},
    {from:'metric:planRevenue',to:'chart:revenue-vs-plan',relation:'renders',description:'Revenue plan feeds the shared comparison chart'},
    {from:'chart:revenue-vs-plan',to:'scene:performance',relation:'renders',description:'Shared comparison chart renders in the performance scene'},
    {from:'metric:planRevenue',to:'scene:performance',relation:'renders',description:'Revenue plan informs the performance scene'},
    {from:'metric:revenue',to:'scene:performance',relation:'renders',description:'Revenue drives the performance scene'},
    {from:'metric:growth',to:'scene:performance',relation:'renders',description:'Growth drives the performance scene'},
    {from:'region:apac',to:'decision:launch',relation:'supports',description:'APAC performance supports the expansion decision'},
    {from:'decision:launch',to:'document:strategy',relation:'decides',description:'Decision status is shown in the strategy'},
    {from:'decision:launch',to:'scene:decision',relation:'renders',description:'Decision status drives the decision scene'},
  ]
  return {objects,edges}
}

export const seedWorkspace: WorkspaceState = {
  title:'FY27 Product Strategy',
  document:{
    eyebrow:'Strategy brief · Draft',
    title:'Build the operating layer for modern knowledge work',
    summary:'Frame treats documents, analysis, and presentations as three views over the same structured work — reducing handoffs, stale numbers, and duplicated reasoning.',
    body:'Our strongest opportunity is not to recreate the Office ribbon with an AI assistant attached. It is to make the underlying work legible: claims know their sources, metrics know their definitions, decisions know their owners, and every view can stay connected to the same source of truth.',
  },
  metrics:[
    {id:'revenue',label:'Q2 revenue',value:42.8,previous:36.6,format:'currency',source:'Finance model · Revenue · Q2 FY27',updatedAt:'12 min ago',formula:'SUM(Regions.Revenue)'},
    {id:'growth',label:'YoY growth',value:17,previous:14,format:'percent',source:'Finance model · Growth · Q2 FY27',updatedAt:'12 min ago'},
    {id:'margin',label:'Gross margin',value:71.4,previous:69.8,format:'percent',source:'Finance model · Margin · Q2 FY27',updatedAt:'12 min ago'},
    {id:'planRevenue',label:'Q2 revenue plan',value:45,previous:41,format:'currency',source:'Finance plan · Revenue · Q2 FY27',updatedAt:'12 min ago',formula:'SUM(Plan.Revenue)'},
    {id:'variance',label:'Revenue variance',value:-2.2,previous:-4.4,format:'currency',source:'Finance model · Actual vs plan · Q2 FY27',updatedAt:'12 min ago',formula:'SUM(Regions.Revenue) - SUM(Plan.Revenue)'},
  ],
  regions:[
    {id:'na',region:'North America',revenue:18.6,growth:12,margin:74.1},
    {id:'eu',region:'Europe',revenue:11.9,growth:23,margin:70.2},
    {id:'apac',region:'APAC',revenue:8.7,growth:31,margin:68.8},
    {id:'latam',region:'Latin America',revenue:3.6,growth:18,margin:66.7},
  ],
  plans:[
    {id:'na',region:'North America',revenue:19},
    {id:'eu',region:'Europe',revenue:12.5},
    {id:'apac',region:'APAC',revenue:9.5},
    {id:'latam',region:'Latin America',revenue:4},
  ],
  relationships:[{id:'relationship:regions-plan',label:'Actuals to plan by region',fromTable:'Regions',fromField:'Region',toTable:'Plan',toField:'Region',cardinality:'one-to-one'}],
  charts:[{id:'revenue-vs-plan',label:'Actual vs plan by region',kind:'grouped-bar',relationshipId:'relationship:regions-plan',category:{tableId:'Regions',fieldId:'Region'},series:[{id:'actual',label:'Actual',tableId:'Regions',fieldId:'Revenue'},{id:'plan',label:'Plan',tableId:'Plan',fieldId:'Revenue'}]}],
  decisions:[{id:'launch',title:'Prioritise APAC expansion in the second half',status:'pending',owner:'Strategy',rationale:'APAC is the fastest-growing region, but margin remains below the company average.'}],
  sources:[
    {id:'source:finance',label:'Finance model',type:'dataset',locator:'Revenue · Q2 FY27',status:'live',updatedAt:'12 min ago'},
    {id:'source:research',label:'Customer research',type:'research',locator:'FY27 customer interviews',status:'live',updatedAt:'2 days ago'},
  ],
  graph:buildSeedGraph(),history:[],
}

export const regionsSchema: TableSchema = {id:'Regions',label:'Regions',fields:[
  {id:'Region',label:'Region',type:'text'},
  {id:'Revenue',label:'Revenue',type:'currency'},
  {id:'Growth',label:'Growth',type:'percent'},
  {id:'Margin',label:'Margin',type:'percent'},
]}
export const planSchema: TableSchema = {id:'Plan',label:'Plan',fields:[
  {id:'Region',label:'Region',type:'text'},
  {id:'Revenue',label:'Revenue plan',type:'currency'},
]}
export function regionsTable(workspace:WorkspaceState):TableData { return {schema:regionsSchema,rows:workspace.regions.map(row=>({Region:row.region,Revenue:row.revenue,Growth:row.growth,Margin:row.margin}))} }
export function planTable(workspace:WorkspaceState):TableData { return {schema:planSchema,rows:workspace.plans.map(row=>({Region:row.region,Revenue:row.revenue}))} }
export function workspaceTables(workspace:WorkspaceState):TableData[] { return [regionsTable(workspace),planTable(workspace)] }
export function evaluateWorkspaceFormula(workspace:WorkspaceState,expression:string){return evaluateSemanticExpression(expression,workspaceTables(workspace))}
export function evaluateMetric(workspace:WorkspaceState,metricId:string){const metric=workspace.metrics.find(c=>c.id===metricId);if(!metric)throw new Error(`Unknown metric: ${metricId}`);if(!metric.formula)return {value:metric.value,dependencies:[]};return evaluateWorkspaceFormula(workspace,metric.formula)}
export function formatMetric(metric:Metric){if(metric.format==='currency')return `$${metric.value.toFixed(1)}M`;if(metric.format==='percent')return `${metric.value.toFixed(metric.value%1?1:0)}%`;return metric.value.toLocaleString()}
export function metricDelta(metric:Metric){return metric.value-metric.previous}
export function cloneSeedWorkspace():WorkspaceState{return structuredClone(seedWorkspace)}
export function mergeWorkspaceGraph(base:WorkspaceGraph,incoming:WorkspaceGraph|undefined):WorkspaceGraph{if(!incoming)return structuredClone(base);const baseObjectIds=new Set(base.objects.map(object=>object.id));const objects=[...base.objects.map(object=>({...object,...(incoming.objects.find(candidate=>candidate.id===object.id)??{})})),...incoming.objects.filter(object=>!baseObjectIds.has(object.id))];const edgeKey=(edge:DependencyEdge)=>`${edge.from}|${edge.to}|${edge.relation}`;const incomingByKey=new Map(incoming.edges.map(edge=>[edgeKey(edge),edge]));const baseKeys=new Set(base.edges.map(edge=>edgeKey(edge)));const edges=[...base.edges.map(edge=>incomingByKey.get(edgeKey(edge))??edge),...incoming.edges.filter(edge=>!baseKeys.has(edgeKey(edge)))];return{objects,edges}}
function mergeById<T extends {id:string}>(base:T[],incoming:T[]|undefined):T[]{if(!incoming)return structuredClone(base);const baseIds=new Set(base.map(item=>item.id));return [...base.map(item=>({...item,...(incoming.find(candidate=>candidate.id===item.id)??{})})),...incoming.filter(item=>!baseIds.has(item.id))]}
export function hydrateWorkspace(value:Partial<WorkspaceState>|null|undefined):WorkspaceState{
  const base=cloneSeedWorkspace();if(!value)return base;const legacyMetrics=value.metrics??[];const knownMetricIds=new Set(base.metrics.map(m=>m.id));const metrics=[...base.metrics.map(metric=>({...metric,...(legacyMetrics.find(c=>c.id===metric.id)??{})})),...legacyMetrics.filter(m=>!knownMetricIds.has(m.id))];
  return {...base,...value,document:{...base.document,...(value.document??{})},metrics,regions:value.regions??base.regions,plans:value.plans??base.plans,relationships:mergeById(base.relationships,value.relationships),charts:mergeById(base.charts,value.charts),decisions:value.decisions??base.decisions,sources:value.sources??base.sources,graph:mergeWorkspaceGraph(base.graph,value.graph),history:value.history??[]}
}
export function getUpstreamObjectIds(graph:WorkspaceGraph,objectIds:string[]):string[]{const targets=new Set(objectIds),visited=new Set(objectIds),queue=[...objectIds],upstream:string[]=[];while(queue.length){const current=queue.shift()!;for(const edge of graph.edges){if(edge.to!==current||visited.has(edge.from))continue;visited.add(edge.from);queue.push(edge.from);if(!targets.has(edge.from))upstream.push(edge.from)}}return upstream}
export type ObjectLineage={object:WorkspaceObject;upstream:WorkspaceObject[];downstream:WorkspaceObject[];incoming:DependencyEdge[];outgoing:DependencyEdge[]}
export function getObjectLineage(workspace:WorkspaceState,objectId:string):ObjectLineage{const object=workspace.graph.objects.find(c=>c.id===objectId);if(!object)throw new Error(`Unknown workspace object: ${objectId}`);const upstreamIds=getUpstreamObjectIds(workspace.graph,[objectId]),downstreamIds=getDownstreamObjectIds(workspace.graph,[objectId]);return {object,upstream:upstreamIds.flatMap(id=>workspace.graph.objects.find(c=>c.id===id)??[]),downstream:downstreamIds.flatMap(id=>workspace.graph.objects.find(c=>c.id===id)??[]),incoming:workspace.graph.edges.filter(e=>e.to===objectId),outgoing:workspace.graph.edges.filter(e=>e.from===objectId)}}
export function getDownstreamObjectIds(graph:WorkspaceGraph,changedObjectIds:string[]):string[]{const changed=new Set(changedObjectIds),visited=new Set(changedObjectIds),queue=[...changedObjectIds],downstream:string[]=[];while(queue.length){const current=queue.shift()!;for(const edge of graph.edges){if(edge.from!==current||visited.has(edge.to))continue;visited.add(edge.to);queue.push(edge.to);if(!changed.has(edge.to))downstream.push(edge.to)}}return downstream}
export function getWorkspaceImpacts(workspace:WorkspaceState,changedObjectIds:string[]):WorkspaceImpact[]{const downstreamIds=getDownstreamObjectIds(workspace.graph,changedObjectIds);return downstreamIds.flatMap(objectId=>{const object=workspace.graph.objects.find(c=>c.id===objectId);if(!object)return[];const inbound=workspace.graph.edges.filter(edge=>edge.to===objectId&&(changedObjectIds.includes(edge.from)||downstreamIds.includes(edge.from)));return [{...object,reason:inbound.map(e=>e.description).join(' · ')||'Downstream dependency'}]})}
function makeEvent(workspace:WorkspaceState,summary:string,changedAt:string,changedObjectIds:string[]):ChangeEvent{return{id:`change:${workspace.history.length+1}`,changedAt,summary,changedObjectIds,affectedObjectIds:getDownstreamObjectIds(workspace.graph,changedObjectIds)}}
function appendHistory(workspace:WorkspaceState,event:ChangeEvent):WorkspaceState{return{...workspace,history:[event,...workspace.history].slice(0,50)}}
function recalculateFormulaMetrics(workspace:WorkspaceState,changedAt:string){const changedMetricIds:string[]=[];const metrics=workspace.metrics.map(metric=>{if(!metric.formula)return metric;const nextValue=Number(evaluateMetric(workspace,metric.id).value.toFixed(12));if(Object.is(nextValue,metric.value))return metric;changedMetricIds.push(`metric:${metric.id}`);return{...metric,value:nextValue,updatedAt:changedAt}});return{metrics,changedMetricIds}}
export function updateRegionField(workspace:WorkspaceState,id:string,field:keyof RegionRow,value:string|number,changedAt='just now'):WorkspaceMutationResult{const existing=workspace.regions.find(r=>r.id===id);if(!existing)throw new Error(`Unknown region: ${id}`);const regions=workspace.regions.map(row=>row.id===id?{...row,[field]:value}:row);const provisional={...workspace,regions};const recalculated=recalculateFormulaMetrics(provisional,changedAt);const changedObjectIds=[`region:${id}`,...recalculated.changedMetricIds];const next={...provisional,metrics:recalculated.metrics};const event=makeEvent(next,`${existing.region} ${String(field)} updated`,changedAt,changedObjectIds);const withHistory=appendHistory(next,event);return{workspace:withHistory,impacts:getWorkspaceImpacts(withHistory,changedObjectIds),event}}
export function updatePlanField(workspace:WorkspaceState,id:string,field:keyof PlanRow,value:string|number,changedAt='just now'):WorkspaceMutationResult{const existing=workspace.plans.find(r=>r.id===id);if(!existing)throw new Error(`Unknown plan row: ${id}`);const plans=workspace.plans.map(row=>row.id===id?{...row,[field]:value}:row);const provisional={...workspace,plans};const recalculated=recalculateFormulaMetrics(provisional,changedAt);const changedObjectIds=[`plan:${id}`,...recalculated.changedMetricIds];const next={...provisional,metrics:recalculated.metrics};const event=makeEvent(next,`${existing.region} plan ${String(field)} updated`,changedAt,changedObjectIds);const withHistory=appendHistory(next,event);return{workspace:withHistory,impacts:getWorkspaceImpacts(withHistory,changedObjectIds),event}}
export function setDecisionStatus(workspace:WorkspaceState,id:string,status:Decision['status'],changedAt='just now'):WorkspaceMutationResult{const existing=workspace.decisions.find(d=>d.id===id);if(!existing)throw new Error(`Unknown decision: ${id}`);const decisions=workspace.decisions.map(d=>d.id===id?{...d,status}:d);const changedObjectIds=[`decision:${id}`];const next={...workspace,decisions};const event=makeEvent(next,`${existing.title} ${status}`,changedAt,changedObjectIds);const withHistory=appendHistory(next,event);return{workspace:withHistory,impacts:getWorkspaceImpacts(withHistory,changedObjectIds),event}}
export function appendDocumentText(workspace:WorkspaceState,text:string,changedAt='just now'):WorkspaceMutationResult{const body=workspace.document.body.trimEnd();const document={...workspace.document,body:body?`${body}\n\n${text}`:text};const changedObjectIds=['document:strategy'];const next={...workspace,document};const event=makeEvent(next,'Strategy evidence appended',changedAt,changedObjectIds);const withHistory=appendHistory(next,event);return{workspace:withHistory,impacts:getWorkspaceImpacts(withHistory,changedObjectIds),event}}
export function createWorkspaceSession(workspace:WorkspaceState):WorkspaceSession{return{present:workspace,past:[],future:[]}}
export function executeWorkspaceCommand(session:WorkspaceSession,command:WorkspaceCommand):WorkspaceSession{let result:WorkspaceMutationResult;switch(command.type){case'region.update':result=updateRegionField(session.present,command.regionId,command.field,command.value,command.changedAt);break;case'plan.update':result=updatePlanField(session.present,command.planId,command.field,command.value,command.changedAt);break;case'decision.status':result=setDecisionStatus(session.present,command.decisionId,command.status,command.changedAt);break;case'document.append':result=appendDocumentText(session.present,command.text,command.changedAt);break}const transaction:WorkspaceTransaction={id:`transaction:${session.past.length+1}`,command,summary:result.event.summary,before:structuredClone(session.present),after:structuredClone(result.workspace)};return{present:result.workspace,past:[...session.past,transaction].slice(-50),future:[]}}
export function undoWorkspaceSession(session:WorkspaceSession):WorkspaceSession{const transaction=session.past.at(-1);if(!transaction)return session;return{present:structuredClone(transaction.before),past:session.past.slice(0,-1),future:[transaction,...session.future].slice(0,50)}}
export function redoWorkspaceSession(session:WorkspaceSession):WorkspaceSession{const transaction=session.future[0];if(!transaction)return session;return{present:structuredClone(transaction.after),past:[...session.past,transaction].slice(-50),future:session.future.slice(1)}}
