import type { WorkspaceState } from './model.ts'
import { getWorkspaceReviews, type WordWorkspaceReviewSource, type WorkspaceReviewRecord } from './workspaceReviews.ts'

export type ImportedWordReviewMessage={
  id:string
  sourceReviewId:string
  objectId:string
  label:string
  source:string
  body:string
  author:string
  createdAt:string
  depth:number
  parentSourceReviewId?:string
  durableId?:string
  done?:boolean
  dateUtc?:string
}
export type ImportedWordReviewThread={
  id:string
  source:string
  root:ImportedWordReviewMessage
  messages:ImportedWordReviewMessage[]
  replyCount:number
  participants:string[]
  resolved:boolean
  objectId:string
  label:string
}

type WordSourceRecord=WorkspaceReviewRecord&{sourceOnly:true;sourceReview:WordWorkspaceReviewSource}

function wordSourceRecords(workspace:WorkspaceState):WordSourceRecord[]{
  return getWorkspaceReviews(workspace).filter((review):review is WordSourceRecord=>Boolean(review.sourceOnly&&review.sourceReview?.kind==='word-comment'))
}
function key(source:string,sourceReviewId:string){return`${source}\u0000${sourceReviewId}`}

/**
 * Projects flat imported Word source-review records into conservative threads.
 * Parent links are source metadata only; cycles or missing parents are treated as roots.
 */
export function getImportedWordReviewThreads(workspace:WorkspaceState):ImportedWordReviewThread[]{
  const records=wordSourceRecords(workspace),byKey=new Map(records.map((record)=>[key(record.sourceReview.source,record.sourceReview.sourceReviewId),record] as const))
  const rootFor=(record:WordSourceRecord)=>{
    let current=record,seen=new Set<string>()
    while(current.sourceReview.parentSourceReviewId){
      const currentKey=key(current.sourceReview.source,current.sourceReview.sourceReviewId)
      if(seen.has(currentKey))break
      seen.add(currentKey)
      const parent=byKey.get(key(current.sourceReview.source,current.sourceReview.parentSourceReviewId))
      if(!parent)break
      current=parent
    }
    return current
  }
  const groups=new Map<string,WordSourceRecord[]>()
  for(const record of records){const root=rootFor(record),rootKey=key(root.sourceReview.source,root.sourceReview.sourceReviewId),group=groups.get(rootKey)??[];group.push(record);groups.set(rootKey,group)}

  const depthFor=(record:WordSourceRecord,groupByKey:Map<string,WordSourceRecord>)=>{
    let depth=0,current=record,seen=new Set<string>()
    while(current.sourceReview.parentSourceReviewId){
      const currentKey=key(current.sourceReview.source,current.sourceReview.sourceReviewId)
      if(seen.has(currentKey))break
      seen.add(currentKey)
      const parent=groupByKey.get(key(current.sourceReview.source,current.sourceReview.parentSourceReviewId));if(!parent)break
      depth+=1;current=parent
    }
    return depth
  }
  const message=(record:WordSourceRecord,depth:number):ImportedWordReviewMessage=>({id:record.id,sourceReviewId:record.sourceReview.sourceReviewId,objectId:record.objectId,label:record.label,source:record.sourceReview.source,body:record.body,author:record.owner,createdAt:record.createdAt,depth,...(record.sourceReview.parentSourceReviewId?{parentSourceReviewId:record.sourceReview.parentSourceReviewId}:{}),...(record.sourceReview.durableId?{durableId:record.sourceReview.durableId}:{}),...(record.sourceReview.done!==undefined?{done:record.sourceReview.done}:{}),...(record.sourceReview.dateUtc?{dateUtc:record.sourceReview.dateUtc}:{})})

  const result:ImportedWordReviewThread[]=[]
  for(const [rootKey,group] of groups){
    const groupByKey=new Map(group.map((record)=>[key(record.sourceReview.source,record.sourceReview.sourceReviewId),record] as const)),root=group.find((record)=>key(record.sourceReview.source,record.sourceReview.sourceReviewId)===rootKey)??group[0]
    const messages=group.map((record)=>message(record,depthFor(record,groupByKey))).sort((left,right)=>left.depth-right.depth||left.createdAt.localeCompare(right.createdAt)||left.id.localeCompare(right.id))
    const rootMessage=messages.find((item)=>item.sourceReviewId===root.sourceReview.sourceReviewId)??messages[0],participants=[...new Set(messages.map((item)=>item.author))].sort()
    result.push({id:`word-thread:${root.sourceReview.source}:${root.sourceReview.sourceReviewId}`,source:root.sourceReview.source,root:rootMessage,messages,replyCount:Math.max(0,messages.length-1),participants,resolved:root.sourceReview.done===true,objectId:root.objectId,label:root.label})
  }
  return result.sort((left,right)=>(left.resolved?1:0)-(right.resolved?1:0)||left.source.localeCompare(right.source)||left.label.localeCompare(right.label)||left.id.localeCompare(right.id))
}

export function summarizeImportedWordReview(workspace:WorkspaceState){
  const threads=getImportedWordReviewThreads(workspace)
  return{threads:threads.length,comments:threads.reduce((sum,thread)=>sum+thread.messages.length,0),open:threads.filter((thread)=>!thread.resolved).length,resolved:threads.filter((thread)=>thread.resolved).length,replies:threads.reduce((sum,thread)=>sum+thread.replyCount,0),participants:[...new Set(threads.flatMap((thread)=>thread.participants))].sort(),sources:[...new Set(threads.map((thread)=>thread.source))].sort()}
}
