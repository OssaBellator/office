import type { Metric } from './model.ts'
import type { VersionedWorkspaceCommand } from './semanticCommands.ts'
import type { BlockAnnotation, SemanticCitation, SemanticClaim, SemanticDocumentBlock, SemanticDocumentState } from './semanticDocument.ts'
import type { PresentationState } from './presentationState.ts'

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Command must be a JSON object')
  return value as Record<string, unknown>
}
function text(value: unknown, field: string) { if (typeof value !== 'string') throw new Error(`${field} must be a string`); return value }
function number(value: unknown, field: string) { if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${field} must be a finite number`); return value }
function boolean(value: unknown, field: string) { if (typeof value !== 'boolean') throw new Error(`${field} must be a boolean`); return value }
function optionalText(value: unknown, field: string) { return value === undefined ? undefined : text(value, field) }
function oneOf<T extends string>(value: unknown, field: string, allowed: readonly T[]): T { const result=text(value,field) as T;if(!allowed.includes(result))throw new Error(`${field} must be one of: ${allowed.join(', ')}`);return result }
function array(value: unknown, field: string) { if (!Array.isArray(value)) throw new Error(`${field} must be an array`); return value }

function parseMetric(value: unknown): Metric {
  const input=record(value)
  return {
    id:text(input.id,'metric.id'),
    label:text(input.label,'metric.label'),
    value:number(input.value,'metric.value'),
    previous:number(input.previous,'metric.previous'),
    format:oneOf(input.format,'metric.format',['currency','percent','number'] as const),
    source:text(input.source,'metric.source'),
    updatedAt:text(input.updatedAt,'metric.updatedAt'),
    formula:input.formula===undefined?undefined:text(input.formula,'metric.formula'),
  }
}
function parseBlock(value: unknown): SemanticDocumentBlock {
  const input = record(value), id=text(input.id,'block.id'), type=oneOf(input.type,'block.type',['paragraph','claim','metric-embed','decision-embed'] as const)
  if(type==='paragraph')return{id,type,text:text(input.text,'block.text')}
  if(type==='claim')return{id,type,claimId:text(input.claimId,'block.claimId')}
  if(type==='metric-embed')return{id,type,label:text(input.label,'block.label'),metricIds:array(input.metricIds,'block.metricIds').map((item,index)=>text(item,`block.metricIds[${index}]`))}
  return{id,type,decisionId:text(input.decisionId,'block.decisionId')}
}
function parseClaim(value: unknown): SemanticClaim {
  const input=record(value),predicate=record(input.predicate),predicateType=oneOf(predicate.type,'claim.predicate.type',['growth-leader','manual'] as const)
  return{id:text(input.id,'claim.id'),statement:text(input.statement,'claim.statement'),rationale:text(input.rationale,'claim.rationale'),confidence:oneOf(input.confidence,'claim.confidence',['low','medium','high'] as const),predicate:predicateType==='growth-leader'?{type:predicateType,subjectObjectId:text(predicate.subjectObjectId,'claim.predicate.subjectObjectId')}:{type:'manual'},citationIds:array(input.citationIds,'claim.citationIds').map((item,index)=>text(item,`claim.citationIds[${index}]`))}
}
function parseCitation(value: unknown): SemanticCitation {const input=record(value);return{id:text(input.id,'citation.id'),label:text(input.label,'citation.label'),sourceId:text(input.sourceId,'citation.sourceId'),evidenceObjectId:text(input.evidenceObjectId,'citation.evidenceObjectId'),locator:text(input.locator,'citation.locator')}}
function parseAnnotation(value: unknown): BlockAnnotation {const input=record(value);return{id:text(input.id,'annotation.id'),blockId:text(input.blockId,'annotation.blockId'),kind:oneOf(input.kind,'annotation.kind',['comment','task','approval'] as const),body:text(input.body,'annotation.body'),owner:text(input.owner,'annotation.owner'),status:oneOf(input.status,'annotation.status',['open','resolved','pending','approved'] as const)}}
function parseSemanticDocument(value: unknown): SemanticDocumentState {const input=record(value);return{blocks:array(input.blocks,'semanticDocument.blocks').map(parseBlock),claims:array(input.claims,'semanticDocument.claims').map(parseClaim),citations:array(input.citations,'semanticDocument.citations').map(parseCitation),annotations:array(input.annotations,'semanticDocument.annotations').map(parseAnnotation)}}
function parsePresentationState(value: unknown): PresentationState {const input=record(value);const sceneIds=['thesis','performance','signal','decision'] as const;const notes=record(input.notes??{});return{order:array(input.order,'presentation.order').map((item,index)=>oneOf(item,`presentation.order[${index}]`,sceneIds)),hiddenSceneIds:array(input.hiddenSceneIds,'presentation.hiddenSceneIds').map((item,index)=>oneOf(item,`presentation.hiddenSceneIds[${index}]`,sceneIds)),notes:Object.fromEntries(Object.entries(notes).map(([key,value])=>[oneOf(key,'presentation.notes key',sceneIds),text(value,`presentation.notes.${key}`)]))}}

export function parseWorkspaceCommand(value: unknown): VersionedWorkspaceCommand {
  const input=record(value), type=text(input.type,'type'), changedAt=optionalText(input.changedAt,'changedAt')
  switch(type){
    case'region.update':return{type,regionId:text(input.regionId,'regionId'),field:oneOf(input.field,'field',['region','revenue','growth','margin'] as const),value:typeof input.value==='string'?input.value:number(input.value,'value'),changedAt}
    case'plan.update':return{type,planId:text(input.planId,'planId'),field:oneOf(input.field,'field',['region','revenue'] as const),value:typeof input.value==='string'?input.value:number(input.value,'value'),changedAt}
    case'decision.status':return{type,decisionId:text(input.decisionId,'decisionId'),status:oneOf(input.status,'status',['approved','pending'] as const),changedAt}
    case'document.append':return{type,text:text(input.text,'text'),changedAt}
    case'document.update':return{type,field:oneOf(input.field,'field',['eyebrow','title','summary','body'] as const),value:text(input.value,'value'),changedAt}
    case'document.semantic.replace':return{type,value:parseSemanticDocument(input.value),changedAt}
    case'document.block.update':return{type,blockId:text(input.blockId,'blockId'),text:text(input.text,'text'),changedAt}
    case'document.block.insert':return{type,block:parseBlock(input.block),index:input.index===undefined?undefined:number(input.index,'index'),claim:input.claim===undefined?undefined:parseClaim(input.claim),citation:input.citation===undefined?undefined:parseCitation(input.citation),changedAt}
    case'document.block.remove':return{type,blockId:text(input.blockId,'blockId'),changedAt}
    case'document.block.move':return{type,blockId:text(input.blockId,'blockId'),toIndex:number(input.toIndex,'toIndex'),changedAt}
    case'claim.update':return{type,claimId:text(input.claimId,'claimId'),field:oneOf(input.field,'field',['statement','rationale','confidence'] as const),value:input.field==='confidence'?oneOf(input.value,'value',['low','medium','high'] as const):text(input.value,'value'),changedAt}
    case'citation.update':return{type,citationId:text(input.citationId,'citationId'),field:oneOf(input.field,'field',['label','locator'] as const),value:text(input.value,'value'),changedAt}
    case'annotation.insert':return{type,annotation:parseAnnotation(input.annotation),changedAt}
    case'annotation.update':{const field=oneOf(input.field,'field',['body','owner','status'] as const);return{type,annotationId:text(input.annotationId,'annotationId'),field,value:field==='status'?oneOf(input.value,'value',['open','resolved','pending','approved'] as const):text(input.value,'value'),changedAt}}
    case'annotation.remove':return{type,annotationId:text(input.annotationId,'annotationId'),changedAt}
    case'chart.kind':return{type,chartId:text(input.chartId,'chartId'),kind:oneOf(input.kind,'kind',['grouped-bar','line'] as const),changedAt}
    case'presentation.replace':return{type,value:parsePresentationState(input.value),changedAt}
    case'presentation.scene.move':return{type,sceneId:oneOf(input.sceneId,'sceneId',['thesis','performance','signal','decision'] as const),toIndex:number(input.toIndex,'toIndex'),changedAt}
    case'presentation.scene.visibility':return{type,sceneId:oneOf(input.sceneId,'sceneId',['thesis','performance','signal','decision'] as const),visible:boolean(input.visible,'visible'),changedAt}
    case'presentation.note.update':return{type,sceneId:oneOf(input.sceneId,'sceneId',['thesis','performance','signal','decision'] as const),note:text(input.note,'note'),changedAt}
    case'metric.create':return{type,metric:parseMetric(input.metric),changedAt}
    case'metric.remove':return{type,metricId:text(input.metricId,'metricId'),changedAt}
    case'metric.formula':return{type,metricId:text(input.metricId,'metricId'),formula:input.formula===null?null:text(input.formula,'formula'),fallbackValue:input.fallbackValue===undefined?undefined:number(input.fallbackValue,'fallbackValue'),changedAt}
    case'source.status':return{type,sourceId:text(input.sourceId,'sourceId'),status:oneOf(input.status,'status',['live','stale'] as const),changedAt}
    default:throw new Error(`Unknown workspace command type: ${type}`)
  }
}

export function serializeWorkspaceCommand(command: VersionedWorkspaceCommand) { return JSON.stringify(command) }
export function deserializeWorkspaceCommand(json: string) { let parsed:unknown;try{parsed=JSON.parse(json)}catch{throw new Error('Workspace command is not valid JSON')}return parseWorkspaceCommand(parsed) }
