import type { WorkspaceState } from './model.ts'
import { readOfficeXml, readOfficeZip } from './officeArchive.ts'
import type { OfficeImportPlan } from './officeImportPlanner.ts'
import type { VersionedWorkspaceCommand } from './semanticCommands.ts'
import { getWorkspaceReviews, type WorkspaceReviewRecord } from './workspaceReviews.ts'

export type ImportedWordComment={id:string;author?:string;initials?:string;createdAt?:string;text:string}

function attribute(fragment:string,name:string){return fragment.match(new RegExp(`(?:^|\\s)(?:[\\w.-]+:)?${name}="([^"]*)"`,'i'))?.[1]}
function decodeXml(value:string){return value.replace(/&#x([0-9a-f]+);/gi,(_,hex)=>String.fromCodePoint(Number.parseInt(hex,16))).replace(/&#(\d+);/g,(_,decimal)=>String.fromCodePoint(Number(decimal))).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&')}
function wordText(fragment:string){
  const parts:string[]=[]
  for(const match of fragment.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>|<w:tab\b[^>]*\/?\s*>|<w:br\b[^>]*\/?\s*>/gi)){
    if(match[1]!==undefined)parts.push(decodeXml(match[1].replace(/<[^>]+>/g,'')))
    else if(/w:tab/i.test(match[0]))parts.push('\t')
    else parts.push('\n')
  }
  return parts.join('').trim()
}
function commentText(fragment:string){
  const paragraphs=[...fragment.matchAll(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/gi)].map((match)=>wordText(match[1])).filter(Boolean)
  return(paragraphs.length?paragraphs.join('\n'):wordText(fragment)).trim()
}
function markerIds(fragment:string,localName:string){
  return[...fragment.matchAll(new RegExp(`<w:${localName}\\b([^>]*)\\/?\\s*>`,'gi'))].flatMap((match)=>{const id=attribute(match[1],'id');return id?[id]:[]})
}

export function parseDocxComments(commentsXml:string):ImportedWordComment[]{
  const result:ImportedWordComment[]=[]
  for(const match of commentsXml.matchAll(/<w:comment\b([^>]*)>([\s\S]*?)<\/w:comment>/gi)){
    const id=attribute(match[1],'id');if(!id)continue
    const text=commentText(match[2]);if(!text)continue
    const author=attribute(match[1],'author'),initials=attribute(match[1],'initials'),createdAt=attribute(match[1],'date')
    result.push({id,text,...(author?{author}:{}),...(initials?{initials}:{}),...(createdAt?{createdAt}:{})})
  }
  return result
}

/** Maps a Word comment id to the retained non-empty paragraph index used by parseDocxDocumentXml(). */
export function parseDocxCommentParagraphAnchors(documentXml:string):Map<string,number>{
  const anchors=new Map<string,number>(),active=new Set<string>()
  const withoutTables=documentXml.replace(/<w:tbl\b[^>]*>[\s\S]*?<\/w:tbl>/gi,'')
  let retainedIndex=0
  for(const match of withoutTables.matchAll(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/gi)){
    const fragment=match[1],starts=markerIds(fragment,'commentRangeStart'),ends=markerIds(fragment,'commentRangeEnd'),references=markerIds(fragment,'commentReference')
    starts.forEach((id)=>active.add(id))
    const text=wordText(fragment)
    if(text){
      const relevant=new Set([...active,...references,...ends])
      for(const id of relevant)if(!anchors.has(id))anchors.set(id,retainedIndex)
      retainedIndex+=1
    }
    ends.forEach((id)=>active.delete(id))
  }
  return anchors
}

function setReviewCommand(commands:VersionedWorkspaceCommand[],reviews:WorkspaceReviewRecord[]){
  const index=commands.findIndex((command)=>command.type==='review.workspace.replace')
  if(index>=0){const existing=commands[index] as Extract<VersionedWorkspaceCommand,{type:'review.workspace.replace'}>;commands[index]={type:'review.workspace.replace',reviews,...(existing.changedAt?{changedAt:existing.changedAt}:{})}}
  else commands.push({type:'review.workspace.replace',reviews})
}
function labelForBlock(text:string){const compact=text.replace(/\s+/g,' ').trim();return compact.length>62?`${compact.slice(0,59)}…`:compact}
function sameReviewState(left:WorkspaceReviewRecord[],right:WorkspaceReviewRecord[]){return JSON.stringify(left)===JSON.stringify(right)}

/** Preserve Word comments as source review, remapping native promoted work by stable comment identity. */
export async function preserveDocxCommentMetadata(
  workspace:WorkspaceState,
  input:ArrayBuffer|Uint8Array,
  fileName:string,
  plan:OfficeImportPlan,
):Promise<OfficeImportPlan>{
  if(plan.kind!=='docx')return plan
  const entries=await readOfficeZip(input),commentsXml=readOfficeXml(entries,'word/comments.xml')
  if(!commentsXml)return plan
  const documentXml=readOfficeXml(entries,'word/document.xml')
  if(!documentXml)return plan
  const comments=parseDocxComments(commentsXml),anchors=parseDocxCommentParagraphAnchors(documentXml)
  const inserts=plan.commands.filter((command):command is Extract<VersionedWorkspaceCommand,{type:'document.block.insert'}>=>command.type==='document.block.insert'&&command.block.type==='paragraph'&&command.block.source===fileName)
  const currentReviews=getWorkspaceReviews(workspace),sourceReviews:WorkspaceReviewRecord[]=[]
  let skipped=0
  for(const comment of comments){
    const paragraphIndex=anchors.get(comment.id),insert=paragraphIndex===undefined?undefined:inserts[paragraphIndex]
    if(!insert){skipped+=1;continue}
    const sourceReviewId=`word-comment:${fileName}:${comment.id}`
    sourceReviews.push({
      id:`source-review:${sourceReviewId}`,
      objectId:insert.block.id,
      label:`Word comment · ${labelForBlock(insert.block.text)}`,
      kind:'comment',
      body:comment.text,
      owner:comment.author?.trim()||'Source author',
      status:'open',
      createdAt:comment.createdAt??'source',
      sourceOnly:true,
      sourceReview:{kind:'word-comment',source:fileName,blockId:insert.block.id,sourceReviewId},
    })
  }
  const sourceById=new Map(sourceReviews.map((review)=>[review.sourceReview!.sourceReviewId,review] as const))
  let detachedNative=0,remappedNative=0
  const retainedReviews=currentReviews.flatMap((review)=>{
    const sourceReview=review.sourceReview
    if(sourceReview?.kind!=='word-comment'||sourceReview.source!==fileName)return[review]
    if(review.sourceOnly)return[]
    const refreshed=sourceById.get(sourceReview.sourceReviewId)
    if(refreshed&&refreshed.sourceReview?.kind==='word-comment'){
      remappedNative+=1
      return[{...review,objectId:refreshed.objectId,label:refreshed.label,sourceDetached:undefined,sourceReview:{...sourceReview,blockId:refreshed.sourceReview.blockId}}]
    }
    detachedNative+=1
    return[{...review,objectId:'document:strategy',label:`Strategy document · detached source review`,sourceDetached:true}]
  })
  const nextReviews=[...retainedReviews,...sourceReviews],commands=[...plan.commands]
  if(!sameReviewState(nextReviews,currentReviews))setReviewCommand(commands,nextReviews)
  const warnings=plan.warnings.filter((warning)=>!/^Word comments and comment threads are not imported yet\./i.test(warning))
  if(sourceReviews.length)warnings.push(`${sourceReviews.length} Word comment${sourceReviews.length===1?' was':'s were'} preserved as read-only source review provenance on imported document blocks.`)
  else warnings.push('A Word comments part was detected, but no non-empty comment body could be anchored to a retained document paragraph.')
  if(skipped)warnings.push(`${skipped} Word comment${skipped===1?' could':'s could'} not be anchored because its comment range did not map to a retained non-empty document paragraph.`)
  if(remappedNative)warnings.push(`${remappedNative} promoted Frame review${remappedNative===1?' was':'s were'} remapped to refreshed Word comment anchors by stable source comment identity.`)
  if(detachedNative)warnings.push(`${detachedNative} promoted Frame review${detachedNative===1?' remains':'s remain'} actionable but ${detachedNative===1?'is':'are'} detached to the Strategy document because the source Word comment no longer has a retained anchor.`)
  if(entries.has('word/commentsExtended.xml')||entries.has('word/commentsExtensible.xml')||entries.has('word/commentsIds.xml'))warnings.push('Additional modern Word comment-thread metadata was detected. Frame preserves classic comment bodies and document anchors, but reply/thread metadata is not translated yet.')
  return{...plan,commands,warnings,importedItems:plan.importedItems+sourceReviews.length}
}
