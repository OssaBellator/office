import type { WorkspaceReviewRecord, WorkspaceReviewSource } from './workspaceReviews.ts'

function record(value:unknown,field:string):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(`${field} must be a JSON object`);return value as Record<string,unknown>}
function text(value:unknown,field:string){if(typeof value!=='string')throw new Error(`${field} must be a string`);return value}
function oneOf<T extends string>(value:unknown,field:string,allowed:readonly T[]):T{const result=text(value,field) as T;if(!allowed.includes(result))throw new Error(`${field} must be one of: ${allowed.join(', ')}`);return result}

function parseSource(value:unknown,field:string):WorkspaceReviewSource{
  const input=record(value,field)
  const kind=oneOf(input.kind,`${field}.kind`,['excel-note','excel-thread'] as const)
  const source=text(input.source,`${field}.source`),tableId=text(input.tableId,`${field}.tableId`),rowId=text(input.rowId,`${field}.rowId`),columnId=text(input.columnId,`${field}.columnId`),sourceReviewId=text(input.sourceReviewId,`${field}.sourceReviewId`)
  if(!source.trim()||!tableId.trim()||!rowId.trim()||!columnId.trim()||!sourceReviewId.trim())throw new Error(`${field} source reference fields must not be blank`)
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
  return{id,objectId,label,kind,body,owner,status,createdAt,...(sourceReview?{sourceReview}:{})}
}
