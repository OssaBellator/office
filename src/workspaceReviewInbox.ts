import { getImportedDataReviewItems } from './importedDataReview.ts'
import { getImportedTables } from './importedTables.ts'
import { getImportedThreadedReviewItems } from './importedThreadedReview.ts'
import type { WorkspaceState } from './model.ts'
import { listReviewInbox, type ReviewInboxItem } from './reviewWorkflow.ts'
import type { WorkspaceReviewKind, WorkspaceReviewStatus } from './workspaceReviews.ts'

export type NativeWorkspaceReviewItem={
  origin:'frame'
  id:string
  objectId:string
  label:string
  kind:ReviewInboxItem['kind']
  body:string
  owner:string
  status:ReviewInboxItem['status']
  actionable:true
}

export type PromotedWorkspaceReviewItem={
  origin:'frame-data'
  id:string
  objectId:string
  label:string
  kind:WorkspaceReviewKind
  body:string
  owner:string
  status:WorkspaceReviewStatus
  source:string
  archived:boolean
  actionable:true
}

export type ImportedWorkspaceReviewItem={
  origin:'imported-excel'
  id:string
  objectId:string
  label:string
  kind:'source-note'
  body:string
  owner:string
  status:'source'
  source:string
  promotedReviewId?:string
  actionable:false
}

export type ImportedThreadWorkspaceReviewItem={
  origin:'imported-excel-thread'
  id:string
  objectId:string
  label:string
  kind:'source-thread'
  body:string
  owner:string
  status:'source'
  sourceStatus:'open'|'resolved'
  source:string
  replyCount:number
  participants:string[]
  promotedReviewId?:string
  actionable:false
}

export type WorkspaceReviewInboxItem=NativeWorkspaceReviewItem|PromotedWorkspaceReviewItem|ImportedWorkspaceReviewItem|ImportedThreadWorkspaceReviewItem

function nativeItem(item:ReviewInboxItem):NativeWorkspaceReviewItem{
  return{origin:'frame',id:item.id,objectId:item.blockId,label:item.blockLabel,kind:item.kind,body:item.body,owner:item.owner,status:item.status,actionable:true}
}
function archiveLabel(label:string){return label.endsWith(' · review archive')}

export function listWorkspaceReviewInbox(workspace:WorkspaceState):WorkspaceReviewInboxItem[]{
  const documentNative=listReviewInbox(workspace)
    .filter((item)=>item.status==='open'||item.status==='pending')
    .map(nativeItem)
  const tables=getImportedTables(workspace)
  const promoted=tables.flatMap((table)=>(table.promotedReviews??[]).map((review)=>({table,review})))
  const promotedBySource=new Map(promoted.flatMap(({review})=>review.sourceReview?[[`${review.sourceReview.source}|${review.sourceReview.sourceReviewId}`,review.id] as const]:[]))
  const promotedNative=promoted
    .filter(({review})=>review.kind==='approval'?review.status!=='approved':review.status!=='resolved')
    .map(({table,review}):PromotedWorkspaceReviewItem=>({origin:'frame-data',id:review.id,objectId:review.objectId,label:review.label,kind:review.kind,body:review.body,owner:review.owner,status:review.status,source:review.sourceReview?.source??'Frame',archived:archiveLabel(table.label),actionable:true}))
  const threads=getImportedThreadedReviewItems(workspace)
    .filter((item)=>!archiveLabel(item.tableLabel))
    .map((item):ImportedThreadWorkspaceReviewItem=>({
      origin:'imported-excel-thread',
      id:item.id,
      objectId:`table:${item.tableId}:${item.rowId}`,
      label:`${item.tableLabel} · ${item.columnLabel}`,
      kind:'source-thread',
      body:item.root.text,
      owner:item.root.author,
      status:'source',
      sourceStatus:item.resolved?'resolved':'open',
      source:item.source,
      replyCount:item.replyCount,
      participants:item.participants,
      promotedReviewId:promotedBySource.get(`${item.source}|${item.sourceReviewId}`),
      actionable:false,
    })).sort((left,right)=>(left.sourceStatus==='resolved'?1:0)-(right.sourceStatus==='resolved'?1:0)||left.label.localeCompare(right.label))
  const notes=getImportedDataReviewItems(workspace)
    .filter((item)=>!archiveLabel(item.tableLabel))
    .map((item):ImportedWorkspaceReviewItem=>({
      origin:'imported-excel',
      id:item.id,
      objectId:`table:${item.tableId}:${item.rowId}`,
      label:`${item.tableLabel} · ${item.columnLabel}`,
      kind:'source-note',
      body:item.text,
      owner:item.author??'Source author',
      status:'source',
      source:item.source,
      promotedReviewId:promotedBySource.get(`${item.source}|${item.sourceReviewId}`),
      actionable:false,
    }))
  return[...documentNative,...promotedNative,...threads,...notes]
}

export function summarizeWorkspaceReviewInbox(workspace:WorkspaceState){
  const items=listWorkspaceReviewInbox(workspace)
  const documentNative=items.filter((item)=>item.origin==='frame')
  const promotedNative=items.filter((item)=>item.origin==='frame-data')
  const notes=items.filter((item)=>item.origin==='imported-excel')
  const threads=items.filter((item)=>item.origin==='imported-excel-thread')
  const sources=[...new Set([...notes.map((item)=>item.source),...threads.map((item)=>item.source)])].sort()
  return{
    total:items.length,
    nativeOpen:documentNative.length+promotedNative.length,
    promotedNativeOpen:promotedNative.length,
    archivedNativeOpen:promotedNative.filter((item)=>item.archived).length,
    importedSourceNotes:notes.length,
    importedThreads:threads.length,
    importedOpenThreads:threads.filter((item)=>item.sourceStatus==='open').length,
    importedThreadComments:threads.reduce((sum,item)=>sum+item.replyCount+1,0),
    importedSources:sources,
  }
}
