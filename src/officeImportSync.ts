import { getImportedTables, type ImportedDataTable } from './importedTables.ts'
import type { WorkspaceState } from './model.ts'
import type { OfficeImportPlan } from './officeImportPlanner.ts'
import { getPresentationState } from './presentationState.ts'
import { getSemanticDocument } from './semanticDocument.ts'
import type { VersionedWorkspaceCommand } from './semanticCommands.ts'

function remapPromotedReviews(previous:ImportedDataTable,next:ImportedDataTable):ImportedDataTable{
  const promotedReviews=(previous.promotedReviews??[]).flatMap((review)=>{
    const sourceReview=review.sourceReview;if(!sourceReview)return[]
    const oldRowIndex=previous.rows.findIndex((row)=>row.id===sourceReview.rowId),columnExists=next.columns.some((column)=>column.id===sourceReview.columnId),nextRow=oldRowIndex>=0?next.rows[oldRowIndex]:undefined
    if(!nextRow||!columnExists)return[]
    return[{...review,objectId:`table:${next.id}:${nextRow.id}`,label:`${next.label} · ${next.columns.find((column)=>column.id===sourceReview.columnId)?.label??sourceReview.columnId}`,sourceReview:{...sourceReview,source:next.source,tableId:next.id,rowId:nextRow.id}}]
  })
  return promotedReviews.length?{...next,promotedReviews}:next
}

function synchronizeImportedTables(workspace:WorkspaceState,commands:VersionedWorkspaceCommand[],fileName:string){
  const existing=getImportedTables(workspace)
  const existingIds=new Set(existing.map((table)=>table.id))
  const priorSource=existing.filter((table)=>table.source===fileName)
  const retained=existing.filter((table)=>table.source!==fileName)
  const replacementIndex=commands.findIndex((command)=>command.type==='data.imported.replace')
  if(replacementIndex>=0){
    const command=commands[replacementIndex] as Extract<VersionedWorkspaceCommand,{type:'data.imported.replace'}>
    const newlyPlanned=command.tables.filter((table)=>!existingIds.has(table.id)).map((table)=>{
      const previous=priorSource.find((item)=>item.label===table.label)
      return previous?remapPromotedReviews(previous,table):table
    })
    const replacedLabels=new Set(newlyPlanned.map((table)=>table.label))
    const reviewAnchors=priorSource.filter((table)=>!replacedLabels.has(table.label)&&(table.promotedReviews?.length??0)>0)
    commands[replacementIndex]={type:'data.imported.replace',tables:[...retained,...newlyPlanned,...reviewAnchors],...(command.changedAt?{changedAt:command.changedAt}:{})}
  }else if(retained.length!==existing.length){
    const reviewAnchors=priorSource.filter((table)=>(table.promotedReviews?.length??0)>0)
    commands.push({type:'data.imported.replace',tables:[...retained,...reviewAnchors]})
  }
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
  synchronizeImportedTables(workspace,commands,fileName)
  return{...plan,commands}
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
  synchronizeImportedTables(workspace,commands,fileName)
  return{...plan,commands}
}
