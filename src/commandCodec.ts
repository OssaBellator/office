import type { Metric } from './model.ts'
import type { ImportedCellLink, ImportedDataTable, ImportedTableCell, ImportedNumberFormat } from './importedTables.ts'
import type { VersionedWorkspaceCommand } from './semanticCommands.ts'
import type { BlockAnnotation, SemanticCitation, SemanticClaim, SemanticDocumentBlock, SemanticDocumentState, SemanticParagraphStyle } from './semanticDocument.ts'
import type { ImportedPresentationScene, PresentationSceneId, PresentationState } from './presentationState.ts'

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
function timestamp(changedAt: string | undefined) { return changedAt === undefined ? {} : { changedAt } }
function sceneId(value: unknown, field: string): PresentationSceneId { const result=text(value,field);if(result==='thesis'||result==='performance'||result==='signal'||result==='decision'||result.startsWith('imported:'))return result as PresentationSceneId;throw new Error(`${field} must be a built-in or imported presentation scene id`) }
function importedCell(value:unknown,field:string):ImportedTableCell{if(value===null||typeof value==='string'||typeof value==='boolean')return value;if(typeof value==='number'&&Number.isFinite(value))return value;throw new Error(`${field} must be text, a finite number, a boolean, or null`)}

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
function parseImportedNumberFormat(value:unknown,field:string):ImportedNumberFormat{
  const input=record(value),numFmtId=number(input.numFmtId,`${field}.numFmtId`)
  if(!Number.isInteger(numFmtId)||numFmtId<0)throw new Error(`${field}.numFmtId must be a non-negative integer`)
  const formatCode=input.formatCode===undefined?undefined:text(input.formatCode,`${field}.formatCode`)
  return{numFmtId,...(formatCode!==undefined?{formatCode}:{})}
}
function parseImportedCellLink(value:unknown,field:string):ImportedCellLink{
  const input=record(value),kind=oneOf(input.kind,`${field}.kind`,['external','internal'] as const),target=text(input.target,`${field}.target`)
  if(!target.trim())throw new Error(`${field}.target must not be blank`)
  const display=input.display===undefined?undefined:text(input.display,`${field}.display`),tooltip=input.tooltip===undefined?undefined:text(input.tooltip,`${field}.tooltip`)
  return{kind,target,...(display!==undefined?{display}:{}),...(tooltip!==undefined?{tooltip}:{})}
}
function parseImportedTable(value:unknown):ImportedDataTable{
  const input=record(value)
  const columns=array(input.columns,'table.columns').map((item,index)=>{const column=record(item);return{id:text(column.id,`table.columns[${index}].id`),label:text(column.label,`table.columns[${index}].label`),type:oneOf(column.type,`table.columns[${index}].type`,['text','number','boolean'] as const)}})
  const columnIds=new Set(columns.map((column)=>column.id))
  const rows=array(input.rows,'table.rows').map((item,rowIndex)=>{const row=record(item),values=record(row.values);for(const key of Object.keys(values))if(!columnIds.has(key))throw new Error(`table.rows[${rowIndex}].values contains unknown column ${key}`);return{id:text(row.id,`table.rows[${rowIndex}].id`),values:Object.fromEntries(columns.map((column)=>[column.id,importedCell(values[column.id]??null,`table.rows[${rowIndex}].values.${column.id}`)]))}})
  const validKeys=new Set(rows.flatMap((row)=>columns.map((column)=>`${row.id}\u0000${column.id}`)))
  let formulaByCell:Record<string,string>|undefined
  if(input.formulaByCell!==undefined){
    const raw=record(input.formulaByCell);formulaByCell={}
    for(const [key,value] of Object.entries(raw)){if(!validKeys.has(key))throw new Error(`table.formulaByCell contains unknown cell ${key}`);formulaByCell[key]=text(value,`table.formulaByCell.${key}`)}
    if(!Object.keys(formulaByCell).length)formulaByCell=undefined
  }
  let numberFormatByCell:Record<string,ImportedNumberFormat>|undefined
  if(input.numberFormatByCell!==undefined){
    const raw=record(input.numberFormatByCell);numberFormatByCell={}
    for(const [key,value] of Object.entries(raw)){if(!validKeys.has(key))throw new Error(`table.numberFormatByCell contains unknown cell ${key}`);numberFormatByCell[key]=parseImportedNumberFormat(value,`table.numberFormatByCell.${key}`)}
    if(!Object.keys(numberFormatByCell).length)numberFormatByCell=undefined
  }
  let linkByCell:Record<string,ImportedCellLink>|undefined
  if(input.linkByCell!==undefined){
    const raw=record(input.linkByCell);linkByCell={}
    for(const [key,value] of Object.entries(raw)){if(!validKeys.has(key))throw new Error(`table.linkByCell contains unknown cell ${key}`);linkByCell[key]=parseImportedCellLink(value,`table.linkByCell.${key}`)}
    if(!Object.keys(linkByCell).length)linkByCell=undefined
  }
  const sourceVisibility=input.sourceVisibility===undefined?undefined:oneOf(input.sourceVisibility,'table.sourceVisibility',['visible','hidden','veryHidden'] as const)
  const sourceDateSystem=input.sourceDateSystem===undefined?undefined:oneOf(input.sourceDateSystem,'table.sourceDateSystem',['1900','1904'] as const)
  return{id:text(input.id,'table.id'),label:text(input.label,'table.label'),source:text(input.source,'table.source'),columns,rows,importedAt:text(input.importedAt,'table.importedAt'),...(formulaByCell?{formulaByCell}:{}),...(numberFormatByCell?{numberFormatByCell}:{}),...(linkByCell?{linkByCell}:{}),...(sourceVisibility?{sourceVisibility}:{}),...(sourceDateSystem?{sourceDateSystem}:{})}
}
function parseBlock(value: unknown): SemanticDocumentBlock {
  const input = record(value), id=text(input.id,'block.id'), type=oneOf(input.type,'block.type',['paragraph','claim','metric-embed','decision-embed'] as const)
  if(type==='paragraph'){
    const style=input.style===undefined?undefined:oneOf(input.style,'block.style',['body','heading-1','heading-2','heading-3','bullet','numbered'] as const) as SemanticParagraphStyle
    const source=optionalText(input.source,'block.source')
    return{id,type,text:text(input.text,'block.text'),...(style?{style}:{}),...(source?{source}:{})}
  }
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
function parseImportedScene(value: unknown): ImportedPresentationScene {const input=record(value),id=sceneId(input.id,'presentation.importedScene.id');if(!id.startsWith('imported:'))throw new Error('Imported presentation scene ids must start with imported:');return{id:id as ImportedPresentationScene['id'],title:text(input.title,'presentation.importedScene.title'),body:array(input.body,'presentation.importedScene.body').map((item,index)=>text(item,`presentation.importedScene.body[${index}]`)),source:text(input.source,'presentation.importedScene.source'),note:input.note===undefined?undefined:text(input.note,'presentation.importedScene.note')}}
function parsePresentationState(value: unknown): PresentationState {const input=record(value);const notes=record(input.notes??{}),importedScenes=input.importedScenes===undefined?undefined:array(input.importedScenes,'presentation.importedScenes').map(parseImportedScene);return{order:array(input.order,'presentation.order').map((item,index)=>sceneId(item,`presentation.order[${index}]`)),hiddenSceneIds:array(input.hiddenSceneIds,'presentation.hiddenSceneIds').map((item,index)=>sceneId(item,`presentation.hiddenSceneIds[${index}]`)),notes:Object.fromEntries(Object.entries(notes).map(([key,value])=>[sceneId(key,'presentation.notes key'),text(value,`presentation.notes.${key}`)])),...(importedScenes?{importedScenes}:{})}}

export function parseWorkspaceCommand(value: unknown): VersionedWorkspaceCommand {
  const input=record(value), type=text(input.type,'type'), changedAt=optionalText(input.changedAt,'changedAt')
  switch(type){
    case'region.update':return{type,regionId:text(input.regionId,'regionId'),field:oneOf(input.field,'field',['region','revenue','growth','margin'] as const),value:typeof input.value==='string'?input.value:number(input.value,'value'),changedAt}
    case'plan.update':return{type,planId:text(input.planId,'planId'),field:oneOf(input.field,'field',['region','revenue'] as const),value:typeof input.value==='string'?input.value:number(input.value,'value'),changedAt}
    case'data.imported.replace':return{type,tables:array(input.tables,'tables').map(parseImportedTable),...timestamp(changedAt)}
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
    case'presentation.scene.move':return{type,sceneId:sceneId(input.sceneId,'sceneId'),toIndex:number(input.toIndex,'toIndex'),changedAt}
    case'presentation.scene.visibility':return{type,sceneId:sceneId(input.sceneId,'sceneId'),visible:boolean(input.visible,'visible'),changedAt}
    case'presentation.note.update':return{type,sceneId:sceneId(input.sceneId,'sceneId'),note:text(input.note,'note'),changedAt}
    case'metric.create':return{type,metric:parseMetric(input.metric),...timestamp(changedAt)}
    case'metric.remove':return{type,metricId:text(input.metricId,'metricId'),...timestamp(changedAt)}
    case'metric.formula':return{type,metricId:text(input.metricId,'metricId'),formula:input.formula===null?null:text(input.formula,'formula'),fallbackValue:input.fallbackValue===undefined?undefined:number(input.fallbackValue,'fallbackValue'),...timestamp(changedAt)}
    case'source.status':return{type,sourceId:text(input.sourceId,'sourceId'),status:oneOf(input.status,'status',['live','stale'] as const),changedAt}
    default:throw new Error(`Unknown workspace command type: ${type}`)
  }
}

export function serializeWorkspaceCommand(command: VersionedWorkspaceCommand) { return JSON.stringify(command) }
export function deserializeWorkspaceCommand(json: string) { let parsed:unknown;try{parsed=JSON.parse(json)}catch{throw new Error('Workspace command is not valid JSON')}return parseWorkspaceCommand(parsed) }
