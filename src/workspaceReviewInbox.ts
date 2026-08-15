import { getImportedDataReviewItems } from './importedDataReview.ts'
import { getImportedThreadedReviewItems } from './importedThreadedReview.ts'
import type { WorkspaceState } from './model.ts'
import { listReviewInbox, type ReviewInboxItem } from './reviewWorkflow.ts'

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
  actionable:false
}

export type WorkspaceReviewInboxItem=NativeWorkspaceReviewItem|ImportedWorkspaceReviewItem|ImportedThreadWorkspaceReviewItem

function nativeItem(item:ReviewInboxItem):NativeWorkspaceReviewItem{
  return{origin:'frame',id:item.id,objectId:item.blockId,label:item.blockLabel,kind:item.kind,body:item.body,owner:item.owner,status:item.status,actionable:true}
}

export function listWorkspaceReviewInbox(workspace:WorkspaceState):WorkspaceReviewInboxItem[]{
  const native=listReviewInbox(workspace)
    .filter((item)=>item.status==='open'||item.status==='pending')
    .map(nativeItem)
  const threads=getImportedThreadedReviewItems(workspace).map((item):ImportedThreadWorkspaceReviewItem=>({
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
    actionable:false,
  })).sort((left,right)=>(left.sourceStatus==='resolved'?1:0)-(right.sourceStatus==='resolved'?1:0)||left.label.localeCompare(right.label))
  const notes=getImportedDataReviewItems(workspace).map((item):ImportedWorkspaceReviewItem=>({
    origin:'imported-excel',
    id:item.id,
    objectId:`table:${item.tableId}:${item.rowId}`,
    label:`${item.tableLabel} · ${item.columnLabel}`,
    kind:'source-note',
    body:item.text,
    owner:item.author??'Source author',
    status:'source',
    source:item.source,
    actionable:false,
  }))
  return[...native,...threads,...notes]
}

export function summarizeWorkspaceReviewInbox(workspace:WorkspaceState){
  const items=listWorkspaceReviewInbox(workspace)
  const native=items.filter((item)=>item.origin==='frame')
  const notes=items.filter((item)=>item.origin==='imported-excel')
  const threads=items.filter((item)=>item.origin==='imported-excel-thread')
  const sources=[...new Set([...notes.map((item)=>item.source),...threads.map((item)=>item.source)])].sort()
  return{
    total:items.length,
    nativeOpen:native.length,
    importedSourceNotes:notes.length,
    importedThreads:threads.length,
    importedOpenThreads:threads.filter((item)=>item.sourceStatus==='open').length,
    importedThreadComments:threads.reduce((sum,item)=>sum+item.replyCount+1,0),
    importedSources:sources,
  }
}
