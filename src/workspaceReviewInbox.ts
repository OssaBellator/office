import { getImportedDataReviewItems } from './importedDataReview.ts'
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

export type WorkspaceReviewInboxItem=NativeWorkspaceReviewItem|ImportedWorkspaceReviewItem

function nativeItem(item:ReviewInboxItem):NativeWorkspaceReviewItem{
  return{origin:'frame',id:item.id,objectId:item.blockId,label:item.blockLabel,kind:item.kind,body:item.body,owner:item.owner,status:item.status,actionable:true}
}

export function listWorkspaceReviewInbox(workspace:WorkspaceState):WorkspaceReviewInboxItem[]{
  const native=listReviewInbox(workspace)
    .filter((item)=>item.status==='open'||item.status==='pending')
    .map(nativeItem)
  const imported=getImportedDataReviewItems(workspace).map((item):ImportedWorkspaceReviewItem=>({
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
  return[...native,...imported]
}

export function summarizeWorkspaceReviewInbox(workspace:WorkspaceState){
  const items=listWorkspaceReviewInbox(workspace)
  const native=items.filter((item)=>item.origin==='frame')
  const imported=items.filter((item)=>item.origin==='imported-excel')
  return{
    total:items.length,
    nativeOpen:native.length,
    importedSourceNotes:imported.length,
    importedSources:[...new Set(imported.map((item)=>item.source))].sort(),
  }
}
