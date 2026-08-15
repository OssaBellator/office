import type { WorkspaceReviewRecord, WorkspaceReviewSource } from './workspaceReviews.ts'

function record(value:unknown,field:string):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(`${field} must be a JSON object`);return value as Record<string,unknown>}
function text(value:unknown,field:string){if(typeof value!=='string')throw new Error(`${field} must be a string`);return value}
function boolean(value:unknown,field:string){if(typeof value!=='boolean')throw new Error(`${field} must be a boolean`);return value}
function oneOf<T extends string>(value:unknown,field:string,allowed:readonly T[]):T{const result=text(value,field) as T;if(!allowed.includes(result))throw new Error(`${field} must be one of: ${allowed.join(', ')}`);return result}

function parseSource(value:unknown,field:string):WorkspaceReviewSource{
  const input=record(value,field)
  const kind=oneOf(input.kind,`${field}.kind`,['excel-note','excel-thread','word-comment'] as const)
  const source=text(input.source,`${field}.source`),sourceReviewId=text(input.sourceReviewId,`${field}.sourceReviewId`)
  if(!source.trim()||!sourceReviewId.trim())throw new Error(`${field} source and sourceReviewId must not be blank`)
  if(kind==='word-comment'){
    const blockId=text(input.blockId,`${field}.blockId`)
    if(!blockId.trim())throw new Error(`${field}.blockId must not be blank`)
    return{kind,source,blockId,sourceReviewId}
  }
  const tableId=text(input.tableId,`${field}.tableId`),rowId=text(input.rowId,`${field}.rowId`),columnId=text(input.columnId,`${field}.columnId`)
  if(!tableId.trim()||!rowId.trim()||!columnId.trim())throw new Error(`${field} Excel source reference fields must not be blank`)
  return{kind,source,tableId,rowId,columnId,sourceReviewId}
}

export function parseWorkspaceReviewRecord(value:unknown):WorkspaceReviewRecord{
  const input=record(value,'workspaceReview')
  const id=text(input.id,'workspaceReview.id'),objectId=text(input.objectId,'workspaceReview.objectId'),label=text(input.label,'workspaceReview.label'),body=text(input.body,'workspaceReview.body'),owner=text(input.owner,'workspaceReview.owner'),createdAt=text(input.createdAt,'workspaceReview.createdAt')
  if(!id.trim()||!objectId.trim()||!label.trim()||!body.trim()||!owner.trim())throw new Error('Workspace review id, object, label, body, and owner must not be blank')
  const kind=oneOf(input.kind,'workspaceReview.kind',['comment','task','approval'] as const),status=oneOf(input.status,'workspaceReview.status',['open','resolved','pending','approved'] as const)
  if(kind==='approval'&&!['pending','approved'].includes(status))throw new Error('Approval workspace reviews must be pending or approved')
  if(kind!=='approval'&&!['open','resolved'].includes(status))throw new Error('Comment/task workspace reviews must be open or resolved')
  const sourceReview=input.sourceReview===undefined?undefined:parseSource(input.sourceReview,'workspaceReview.sourceReview')
  const sourceOnly=input.sourceOnly===undefined?undefined:boolean(input.sourceOnly,'workspaceReview.sourceOnly')
  const sourceDetached=input.sourceDetached===undefined?undefined:boolean(input.sourceDetached,'workspaceReview.sourceDetached')
  if(sourceOnly&&kind!=='comment')throw new Error('Source-only workspace reviews must use comment kind')
  if(sourceOnly&&!sourceReview)throw new Error('Source-only workspace reviews require source provenance')
  if(sourceOnly&&sourceDetached)throw new Error('Source-only provenance cannot itself be detached; detachment applies to native promoted review work')
  if(sourceDetached&&!sourceReview)throw new Error('Detached workspace reviews require source provenance')
  return{id,objectId,label,kind,body,owner,status,createdAt,...(sourceReview?{sourceReview}:{}),...(sourceOnly!==undefined?{sourceOnly}:{}),...(sourceDetached!==undefined?{sourceDetached}:{})}
}
