import { getImportedDataReviewItems } from './importedDataReview.ts'
import { getImportedTables } from './importedTables.ts'
import { getImportedThreadedReviewItems } from './importedThreadedReview.ts'
import type { WorkspaceState } from './model.ts'
import { listReviewInbox, type ReviewInboxItem } from './reviewWorkflow.ts'
import { getWorkspaceReviews, type WorkspaceReviewKind, type WorkspaceReviewStatus } from './workspaceReviews.ts'

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

export type ImportedWordWorkspaceReviewItem={
  origin:'imported-word'
  id:string
  objectId:string
  label:string
  kind:'source-comment'
  body:string
  owner:string
  status:'source'
  source:string
  actionable:false
}

export type WorkspaceReviewInboxItem=NativeWorkspaceReviewItem|PromotedWorkspaceReviewItem|ImportedWorkspaceReviewItem|ImportedThreadWorkspaceReviewItem|ImportedWordWorkspaceReviewItem

function nativeItem(item:ReviewInboxItem):NativeWorkspaceReviewItem{
  return{origin:'frame',id:item.id,objectId:item.blockId,label:item.blockLabel,kind:item.kind,body:item.body,owner:item.owner,status:item.status,actionable:true}
}
function archiveLabel(label:string){return label.endsWith(' · review archive')}

export function listWorkspaceReviewInbox(workspace:WorkspaceState):WorkspaceReviewInboxItem[]{
  const documentNative=listReviewInbox(workspace)
    .filter((item)=>item.status==='open'||item.status==='pending')
    .map(nativeItem)
  const tables=getImportedTables(workspace),tableById=new Map(tables.map((table)=>[table.id,table] as const)),allWorkspaceReviews=getWorkspaceReviews(workspace)
  const nativeWorkspaceReviews=allWorkspaceReviews.filter((review)=>!review.sourceOnly)
  const promotedBySource=new Map(nativeWorkspaceReviews.flatMap((review)=>review.sourceReview?[[`${review.sourceReview.source}|${review.sourceReview.sourceReviewId}`,review.id] as const]:[]))
  const promotedNative=nativeWorkspaceReviews
    .filter((review)=>review.kind==='approval'?review.status!=='approved':review.status!=='resolved')
    .map((review):PromotedWorkspaceReviewItem=>{
      const sourceReview=review.sourceReview
      const table=sourceReview&&sourceReview.kind!=='word-comment'?tableById.get(sourceReview.tableId):undefined
      return{origin:'frame-data',id:review.id,objectId:review.objectId,label:review.label,kind:review.kind,body:review.body,owner:review.owner,status:review.status,source:sourceReview?.source??'Frame',archived:Boolean(table&&archiveLabel(table.label)),actionable:true}
    })
  const wordComments=allWorkspaceReviews
    .filter((review)=>review.sourceOnly&&review.sourceReview?.kind==='word-comment')
    .map((review):ImportedWordWorkspaceReviewItem=>({origin:'imported-word',id:review.id,objectId:review.objectId,label:review.label,kind:'source-comment',body:review.body,owner:review.owner,status:'source',source:review.sourceReview!.source,actionable:false}))
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
  return[...documentNative,...promotedNative,...wordComments,...threads,...notes]
}

export function summarizeWorkspaceReviewInbox(workspace:WorkspaceState){
  const items=listWorkspaceReviewInbox(workspace)
  const documentNative=items.filter((item)=>item.origin==='frame')
  const promotedNative=items.filter((item)=>item.origin==='frame-data')
  const wordComments=items.filter((item)=>item.origin==='imported-word')
  const notes=items.filter((item)=>item.origin==='imported-excel')
  const threads=items.filter((item)=>item.origin==='imported-excel-thread')
  const sources=[...new Set([...wordComments.map((item)=>item.source),...notes.map((item)=>item.source),...threads.map((item)=>item.source)])].sort()
  return{
    total:items.length,
    nativeOpen:documentNative.length+promotedNative.length,
    promotedNativeOpen:promotedNative.length,
    archivedNativeOpen:promotedNative.filter((item)=>item.archived).length,
    importedWordComments:wordComments.length,
    importedSourceNotes:notes.length,
    importedThreads:threads.length,
    importedOpenThreads:threads.filter((item)=>item.sourceStatus==='open').length,
    importedThreadComments:threads.reduce((sum,item)=>sum+item.replyCount+1,0),
    importedSources:sources,
  }
}
