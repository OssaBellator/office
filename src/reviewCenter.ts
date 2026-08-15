import { getImportedDataReviewItems } from './importedDataReview.ts'
import { getImportedTables } from './importedTables.ts'
import { getImportedThreadedReviewItems } from './importedThreadedReview.ts'
import type { WorkspaceState } from './model.ts'
import { listReviewInbox } from './reviewWorkflow.ts'
import { getWorkspaceReviews, workspaceReviewIsOpen, type WorkspaceReviewKind, type WorkspaceReviewStatus } from './workspaceReviews.ts'

export type ReviewCenterOrigin='docs'|'data'|'source-note'|'source-thread'
export type ReviewCenterKind=WorkspaceReviewKind|'source-note'|'source-thread'
export type ReviewCenterState='active'|'completed'|'source'|'archived'
export type ReviewCenterItem={
  id:string
  origin:ReviewCenterOrigin
  kind:ReviewCenterKind
  state:ReviewCenterState
  label:string
  body:string
  owner:string
  objectId:string
  status:WorkspaceReviewStatus|'source'
  source?:string
  linkedSource?:boolean
  archived?:boolean
  promotedReviewId?:string
  replyCount?:number
  participants?:string[]
}
export type ReviewCenterFilter={
  state?:'all'|ReviewCenterState
  kind?:'all'|ReviewCenterKind
  owner?:'all'|string
  query?:string
}

function sourceArchive(label:string){return label.endsWith(' · review archive')}
function normalize(value:string){return value.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}

export function buildReviewCenterItems(workspace:WorkspaceState):ReviewCenterItem[]{
  const tables=getImportedTables(workspace),tableById=new Map(tables.map((table)=>[table.id,table] as const)),nativeData=getWorkspaceReviews(workspace)
  const promotedBySource=new Map(nativeData.flatMap((review)=>review.sourceReview?[[`${review.sourceReview.source}|${review.sourceReview.sourceReviewId}`,review.id] as const]:[]))
  const docs=listReviewInbox(workspace).map((item):ReviewCenterItem=>({
    id:item.id,origin:'docs',kind:item.kind,state:item.kind==='approval'?(item.status==='approved'?'completed':'active'):(item.status==='resolved'?'completed':'active'),label:item.blockLabel,body:item.body,owner:item.owner,objectId:item.blockId,status:item.status,
  }))
  const data=nativeData.map((review):ReviewCenterItem=>{
    const table=review.sourceReview?tableById.get(review.sourceReview.tableId):undefined,archived=Boolean(review.sourceReview&&(!table||sourceArchive(table.label))),linkedSource=Boolean(review.sourceReview)
    return{id:review.id,origin:'data',kind:review.kind,state:archived?'archived':workspaceReviewIsOpen(review)?'active':'completed',label:review.label,body:review.body,owner:review.owner,objectId:review.objectId,status:review.status,source:review.sourceReview?.source,linkedSource,archived}
  })
  const notes=getImportedDataReviewItems(workspace).filter((item)=>!sourceArchive(item.tableLabel)).map((item):ReviewCenterItem=>({
    id:item.id,origin:'source-note',kind:'source-note',state:'source',label:`${item.tableLabel} · ${item.columnLabel}`,body:item.text,owner:item.author??'Source author',objectId:`table:${item.tableId}:${item.rowId}`,status:'source',source:item.source,promotedReviewId:promotedBySource.get(`${item.source}|${item.sourceReviewId}`),
  }))
  const threads=getImportedThreadedReviewItems(workspace).filter((item)=>!sourceArchive(item.tableLabel)).map((item):ReviewCenterItem=>({
    id:item.id,origin:'source-thread',kind:'source-thread',state:'source',label:`${item.tableLabel} · ${item.columnLabel}`,body:item.root.text,owner:item.root.author,objectId:`table:${item.tableId}:${item.rowId}`,status:'source',source:item.source,promotedReviewId:promotedBySource.get(`${item.source}|${item.sourceReviewId}`),replyCount:item.replyCount,participants:item.participants,
  }))
  const stateRank:Record<ReviewCenterState,number>={active:0,archived:1,source:2,completed:3}
  return[...docs,...data,...threads,...notes].sort((left,right)=>stateRank[left.state]-stateRank[right.state]||left.owner.localeCompare(right.owner)||left.label.localeCompare(right.label)||left.id.localeCompare(right.id))
}

export function filterReviewCenterItems(items:ReviewCenterItem[],filter:ReviewCenterFilter={}){
  const query=normalize(filter.query??''),terms=query.split(/\s+/).filter(Boolean)
  return items.filter((item)=>!filter.state||filter.state==='all'||item.state===filter.state)
    .filter((item)=>!filter.kind||filter.kind==='all'||item.kind===filter.kind)
    .filter((item)=>!filter.owner||filter.owner==='all'||item.owner===filter.owner)
    .filter((item)=>!terms.length||terms.every((term)=>normalize(`${item.label} ${item.body} ${item.owner} ${item.source??''} ${item.kind} ${item.status}`).includes(term)))
}

export function summarizeReviewCenter(items:ReviewCenterItem[]){
  return{
    total:items.length,
    active:items.filter((item)=>item.state==='active').length,
    completed:items.filter((item)=>item.state==='completed').length,
    source:items.filter((item)=>item.state==='source').length,
    archived:items.filter((item)=>item.state==='archived').length,
    pendingApprovals:items.filter((item)=>item.kind==='approval'&&item.status==='pending').length,
    owners:[...new Set(items.map((item)=>item.owner).filter(Boolean))].sort(),
  }
}
