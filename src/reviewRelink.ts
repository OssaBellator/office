import { tableReviewItems } from './importedDataReview.ts'
import { getImportedTables, type ImportedDataTable } from './importedTables.ts'
import { tableThreadedReviewItems } from './importedThreadedReview.ts'
import type { WorkspaceState } from './model.ts'
import type { VersionedWorkspaceCommand } from './semanticCommands.ts'
import { getWorkspaceReviews, type WorkspaceReviewRecord, type WorkspaceReviewSource } from './workspaceReviews.ts'

export type ReviewRelinkCandidate={
  id:string
  kind:'excel-note'|'excel-thread'
  sourceReviewId:string
  source:string
  tableId:string
  tableLabel:string
  rowId:string
  columnId:string
  columnLabel:string
  body:string
  author:string
  sourceStatus?:'open'|'resolved'
  replyCount?:number
  score:number
  matchHints:string[]
}

export type ReviewRelinkPlan={
  reviewId:string
  fromTableId:string
  candidate:ReviewRelinkCandidate
  review:WorkspaceReviewRecord
  command:Extract<VersionedWorkspaceCommand,{type:'review.workspace.replace'}>
}

type LocatedReview={table:ImportedDataTable|undefined;review:WorkspaceReviewRecord}
type SourceDescriptor={kind:'excel-note'|'excel-thread';body:string;author:string;columnLabel:string;tableLabel:string;sourceReviewId:string}

export function isReviewArchiveTable(table:ImportedDataTable){return table.label.endsWith(' · review archive')}
function baseTableLabel(label:string){return label.replace(/ · review archive$/,'')}

function locateReview(workspace:WorkspaceState,reviewId:string):LocatedReview{
  const review=getWorkspaceReviews(workspace).find((item)=>item.id===reviewId)
  if(!review)throw new Error(`Unknown promoted Frame review: ${reviewId}`)
  const table=review.sourceReview?getImportedTables(workspace).find((candidate)=>candidate.id===review.sourceReview!.tableId):undefined
  return{table,review}
}

function sourceDescriptor(table:ImportedDataTable|undefined,sourceReview:WorkspaceReviewSource):SourceDescriptor|null{
  if(!table)return null
  if(sourceReview.kind==='excel-note'){
    const item=tableReviewItems(table).find((candidate)=>candidate.rowId===sourceReview.rowId&&candidate.columnId===sourceReview.columnId)
    return item?{kind:'excel-note',body:item.text,author:item.author??'Source author',columnLabel:item.columnLabel,tableLabel:item.tableLabel,sourceReviewId:sourceReview.sourceReviewId}:null
  }
  const item=tableThreadedReviewItems(table).find((candidate)=>candidate.rowId===sourceReview.rowId&&candidate.columnId===sourceReview.columnId)
  return item?{kind:'excel-thread',body:item.root.text,author:item.root.author,columnLabel:item.columnLabel,tableLabel:item.tableLabel,sourceReviewId:sourceReview.sourceReviewId}:null
}

function candidateScore(candidate:Omit<ReviewRelinkCandidate,'score'|'matchHints'>,source:SourceDescriptor|null){
  let score=0;const matchHints:string[]=[]
  if(!source)return{score,matchHints}
  if(baseTableLabel(candidate.tableLabel)===baseTableLabel(source.tableLabel)){score+=8;matchHints.push('same sheet')}
  if(candidate.body===source.body){score+=6;matchHints.push('same source text')}
  if(candidate.author===source.author){score+=3;matchHints.push('same source author')}
  if(candidate.columnLabel===source.columnLabel){score+=2;matchHints.push('same column')}
  if(candidate.sourceReviewId===source.sourceReviewId){score+=12;matchHints.unshift('same source identity')}
  return{score,matchHints}
}

function occupiedSourceKeys(workspace:WorkspaceState,exceptReviewId:string){
  const keys=new Set<string>()
  for(const review of getWorkspaceReviews(workspace)){
    if(review.id===exceptReviewId||!review.sourceReview)continue
    keys.add(`${review.sourceReview.source}|${review.sourceReview.sourceReviewId}`)
  }
  return keys
}

export function listReviewRelinkCandidates(workspace:WorkspaceState,reviewId:string):ReviewRelinkCandidate[]{
  const located=locateReview(workspace,reviewId),sourceReview=located.review.sourceReview
  if(!sourceReview)throw new Error(`Frame review ${reviewId} has no imported source review to relink`)
  const source=sourceDescriptor(located.table,sourceReview),occupied=occupiedSourceKeys(workspace,reviewId)
  const candidates:ReviewRelinkCandidate[]=[]
  for(const table of getImportedTables(workspace)){
    if(table.source!==sourceReview.source||isReviewArchiveTable(table))continue
    if(sourceReview.kind==='excel-note'){
      for(const item of tableReviewItems(table)){
        const key=`${item.source}|${item.sourceReviewId}`;if(occupied.has(key))continue
        const base={id:item.id,kind:'excel-note' as const,sourceReviewId:item.sourceReviewId,source:item.source,tableId:item.tableId,tableLabel:item.tableLabel,rowId:item.rowId,columnId:item.columnId,columnLabel:item.columnLabel,body:item.text,author:item.author??'Source author'}
        candidates.push({...base,...candidateScore(base,source)})
      }
    }else{
      for(const item of tableThreadedReviewItems(table)){
        const key=`${item.source}|${item.sourceReviewId}`;if(occupied.has(key))continue
        const base={id:item.id,kind:'excel-thread' as const,sourceReviewId:item.sourceReviewId,source:item.source,tableId:item.tableId,tableLabel:item.tableLabel,rowId:item.rowId,columnId:item.columnId,columnLabel:item.columnLabel,body:item.root.text,author:item.root.author,sourceStatus:item.resolved?'resolved' as const:'open' as const,replyCount:item.replyCount}
        candidates.push({...base,...candidateScore(base,source)})
      }
    }
  }
  return candidates.sort((left,right)=>right.score-left.score||left.tableLabel.localeCompare(right.tableLabel)||left.columnLabel.localeCompare(right.columnLabel)||left.id.localeCompare(right.id))
}

export function planRelinkPromotedReview(workspace:WorkspaceState,reviewId:string,candidateId:string):ReviewRelinkPlan{
  const located=locateReview(workspace,reviewId),sourceReview=located.review.sourceReview
  if(!sourceReview)throw new Error(`Frame review ${reviewId} has no imported source review to relink`)
  const candidate=listReviewRelinkCandidates(workspace,reviewId).find((item)=>item.id===candidateId)
  if(!candidate)throw new Error(`Unknown or unavailable review relink target: ${candidateId}`)
  if(candidate.kind!==sourceReview.kind)throw new Error(`Cannot relink ${sourceReview.kind} review to ${candidate.kind}`)
  if(candidate.source!==sourceReview.source)throw new Error('Review relink target must come from the same source file')
  const updatedReview:WorkspaceReviewRecord={
    ...located.review,
    objectId:`table:${candidate.tableId}:${candidate.rowId}`,
    label:`${candidate.tableLabel} · ${candidate.columnLabel}`,
    sourceReview:{kind:candidate.kind,source:candidate.source,tableId:candidate.tableId,rowId:candidate.rowId,columnId:candidate.columnId,sourceReviewId:candidate.sourceReviewId},
  }
  const reviews=getWorkspaceReviews(workspace).map((review)=>review.id===reviewId?updatedReview:review)
  return{reviewId,fromTableId:sourceReview.tableId,candidate,review:updatedReview,command:{type:'review.workspace.replace',reviews}}
}
