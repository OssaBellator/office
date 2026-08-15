import { tableReviewItems } from './importedDataReview.ts'
import { getImportedTables, type ImportedDataTable } from './importedTables.ts'
import type { WorkspaceState } from './model.ts'
import type { OfficeImportPlan } from './officeImportPlanner.ts'
import { getPresentationState } from './presentationState.ts'
import { getSemanticDocument } from './semanticDocument.ts'
import type { VersionedWorkspaceCommand } from './semanticCommands.ts'
import type { WorkspaceReviewRecord, WorkspaceReviewSource } from './workspaceReviews.ts'

type SourceReviewCell={rowId:string;columnId:string;sourceReviewId:string}
type ReviewRemapResult={table:ImportedDataTable;unmatched:WorkspaceReviewRecord[]}

function splitCellKey(key:string){const index=key.indexOf('\u0000');return index<0?null:{rowId:key.slice(0,index),columnId:key.slice(index+1)}}
function findThreadSourceReview(next:ImportedDataTable,sourceReviewId:string):SourceReviewCell|null{
  for(const [key,thread] of Object.entries(next.threadByCell??{})){
    const root=thread.comments.find((comment)=>!comment.parentId)??thread.comments[0]
    if(root?.id!==sourceReviewId)continue
    const cell=splitCellKey(key);if(cell)return{...cell,sourceReviewId:root.id}
  }
  return null
}
function findClassicSourceReview(previous:ImportedDataTable,next:ImportedDataTable,sourceReview:WorkspaceReviewSource):SourceReviewCell|null{
  const nextItems=tableReviewItems(next)
  const exact=nextItems.find((item)=>item.sourceReviewId===sourceReview.sourceReviewId)
  if(exact)return{rowId:exact.rowId,columnId:exact.columnId,sourceReviewId:exact.sourceReviewId}

  const previousItem=tableReviewItems(previous).find((item)=>item.rowId===sourceReview.rowId&&item.columnId===sourceReview.columnId)
  if(previousItem){
    const sameContent=nextItems.filter((item)=>item.text===previousItem.text&&(item.author??'')===(previousItem.author??''))
    if(sameContent.length===1){const item=sameContent[0];return{rowId:item.rowId,columnId:item.columnId,sourceReviewId:item.sourceReviewId}}
  }

  const previousComment=previous.commentByCell?.[`${sourceReview.rowId}\u0000${sourceReview.columnId}`]
  if(previousComment?.sourceRef)return null
  const oldRowIndex=previous.rows.findIndex((row)=>row.id===sourceReview.rowId),nextRow=oldRowIndex>=0?next.rows[oldRowIndex]:undefined
  if(nextRow&&next.columns.some((column)=>column.id===sourceReview.columnId))return{rowId:nextRow.id,columnId:sourceReview.columnId,sourceReviewId:sourceReview.sourceReviewId}
  return null
}
function findSourceReviewCell(previous:ImportedDataTable,next:ImportedDataTable,sourceReview:WorkspaceReviewSource){
  return sourceReview.kind==='excel-thread'?findThreadSourceReview(next,sourceReview.sourceReviewId):findClassicSourceReview(previous,next,sourceReview)
}
function reviewArchive(previous:ImportedDataTable,reviews:WorkspaceReviewRecord[]):ImportedDataTable{
  const suffix=' · review archive',label=previous.label.endsWith(suffix)?previous.label:`${previous.label}${suffix}`
  return{...structuredClone(previous),label,promotedReviews:structuredClone(reviews)}
}

function remapPromotedReviews(previous:ImportedDataTable,next:ImportedDataTable):ReviewRemapResult{
  const promotedReviews:WorkspaceReviewRecord[]=[],unmatched:WorkspaceReviewRecord[]=[]
  for(const review of previous.promotedReviews??[]){
    const sourceReview=review.sourceReview
    if(!sourceReview){unmatched.push(review);continue}
    const match=findSourceReviewCell(previous,next,sourceReview)
    if(!match){unmatched.push(review);continue}
    const column=next.columns.find((candidate)=>candidate.id===match.columnId)
    promotedReviews.push({...review,objectId:`table:${next.id}:${match.rowId}`,label:`${next.label} · ${column?.label??match.columnId}`,sourceReview:{...sourceReview,source:next.source,tableId:next.id,rowId:match.rowId,columnId:match.columnId,sourceReviewId:match.sourceReviewId}})
  }
  return{table:promotedReviews.length?{...next,promotedReviews}:next,unmatched}
}

function synchronizeImportedTables(workspace:WorkspaceState,commands:VersionedWorkspaceCommand[],fileName:string){
  const existing=getImportedTables(workspace)
  const existingIds=new Set(existing.map((table)=>table.id))
  const priorSource=existing.filter((table)=>table.source===fileName)
  const retained=existing.filter((table)=>table.source!==fileName)
  const replacementIndex=commands.findIndex((command)=>command.type==='data.imported.replace')
  let archivedReviewCount=0
  if(replacementIndex>=0){
    const command=commands[replacementIndex] as Extract<VersionedWorkspaceCommand,{type:'data.imported.replace'}>
    const remapArchives:ImportedDataTable[]=[]
    const newlyPlanned=command.tables.filter((table)=>!existingIds.has(table.id)).map((table)=>{
      const previous=priorSource.find((item)=>item.label===table.label)
      if(!previous)return table
      const remapped=remapPromotedReviews(previous,table)
      if(remapped.unmatched.length){archivedReviewCount+=remapped.unmatched.length;remapArchives.push(reviewArchive(previous,remapped.unmatched))}
      return remapped.table
    })
    const replacedLabels=new Set(newlyPlanned.map((table)=>table.label))
    const missingSheetAnchors=priorSource.filter((table)=>!replacedLabels.has(table.label)&&(table.promotedReviews?.length??0)>0).map((table)=>{archivedReviewCount+=table.promotedReviews?.length??0;return reviewArchive(table,table.promotedReviews??[])})
    commands[replacementIndex]={type:'data.imported.replace',tables:[...retained,...newlyPlanned,...remapArchives,...missingSheetAnchors],...(command.changedAt?{changedAt:command.changedAt}:{})}
  }else if(retained.length!==existing.length){
    const reviewAnchors=priorSource.filter((table)=>(table.promotedReviews?.length??0)>0).map((table)=>{archivedReviewCount+=table.promotedReviews?.length??0;return reviewArchive(table,table.promotedReviews??[])})
    commands.push({type:'data.imported.replace',tables:[...retained,...reviewAnchors]})
  }
  return archivedReviewCount
}

function appendReviewArchiveWarning(plan:OfficeImportPlan,count:number):OfficeImportPlan{
  if(!count)return plan
  return{...plan,warnings:[...plan.warnings,`${count} promoted Frame review record${count===1?' could':'s could'} not be safely remapped to refreshed source review and ${count===1?'was':'were'} retained on a review archive table instead of being dropped or guessed.`]}
}

function synchronizeDocx(workspace:WorkspaceState,plan:OfficeImportPlan,fileName:string):OfficeImportPlan{
  const semantic=getSemanticDocument(workspace)
  const prior=semantic.blocks.flatMap((block,index)=>block.type==='paragraph'&&block.source===fileName?[{id:block.id,index}]:[])
  const firstIndex=prior.length?Math.min(...prior.map((item)=>item.index)):semantic.blocks.length
  const inserts=plan.commands.filter((command):command is Extract<VersionedWorkspaceCommand,{type:'document.block.insert'}>=>command.type==='document.block.insert')
  const others=plan.commands.filter((command)=>command.type!=='document.block.insert')
  const commands:VersionedWorkspaceCommand[]=[
    ...prior.map((item)=>({type:'document.block.remove',blockId:item.id} as const)),
    ...inserts.map((command,index)=>({...command,index:firstIndex+index})),
    ...others,
  ]
  const archived=synchronizeImportedTables(workspace,commands,fileName)
  return appendReviewArchiveWarning({...plan,commands},archived)
}

function synchronizePptx(workspace:WorkspaceState,plan:OfficeImportPlan,fileName:string):OfficeImportPlan{
  const index=plan.commands.findIndex((command)=>command.type==='presentation.replace')
  if(index<0)return plan
  const current=getPresentationState(workspace)
  const currentSceneIds=new Set((current.importedScenes??[]).map((scene)=>scene.id))
  const command=plan.commands[index] as Extract<VersionedWorkspaceCommand,{type:'presentation.replace'}>
  const newlyPlanned=(command.value.importedScenes??[]).filter((scene)=>!currentSceneIds.has(scene.id))
  const priorIds=new Set((current.importedScenes??[]).filter((scene)=>scene.source.startsWith(`${fileName} ·`)).map((scene)=>scene.id))
  const retainedScenes=(current.importedScenes??[]).filter((scene)=>!priorIds.has(scene.id))
  const retainedOrder=current.order.filter((sceneId)=>!priorIds.has(sceneId))
  const retainedHidden=current.hiddenSceneIds.filter((sceneId)=>!priorIds.has(sceneId))
  const retainedNotes=Object.fromEntries(Object.entries(current.notes).filter(([sceneId])=>!priorIds.has(sceneId)))
  const next={
    ...current,
    importedScenes:[...retainedScenes,...newlyPlanned],
    order:[...retainedOrder,...newlyPlanned.map((scene)=>scene.id)],
    hiddenSceneIds:retainedHidden,
    notes:retainedNotes,
  }
  const commands=[...plan.commands]
  commands[index]={type:'presentation.replace',value:next,...(command.changedAt?{changedAt:command.changedAt}:{})}
  return{...plan,commands}
}

export function synchronizeOfficeImportPlan(workspace:WorkspaceState,plan:OfficeImportPlan,fileName:string):OfficeImportPlan{
  if(plan.kind==='docx')return synchronizeDocx(workspace,plan,fileName)
  if(plan.kind==='pptx')return synchronizePptx(workspace,plan,fileName)
  const commands=[...plan.commands]
  const archived=synchronizeImportedTables(workspace,commands,fileName)
  return appendReviewArchiveWarning({...plan,commands},archived)
}
