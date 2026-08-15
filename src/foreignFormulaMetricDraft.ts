import type { ForeignFormulaReview } from './foreignFormulaReview.ts'
import { getImportedTables } from './importedTables.ts'
import type { WorkspaceState } from './model.ts'
import type { VersionedWorkspaceCommand } from './semanticCommands.ts'

function slug(value:string){return value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'metric'}
function cachedValue(workspace:WorkspaceState,review:ForeignFormulaReview){
  const table=getImportedTables(workspace).find((item)=>item.id===review.proposal.tableId),row=table?.rows.find((item)=>item.id===review.proposal.rowId),value=row?.values[review.proposal.columnId]
  return typeof value==='number'&&Number.isFinite(value)?value:0
}
export function foreignFormulaMetricId(review:ForeignFormulaReview){return`translated:${slug(`${review.proposal.tableLabel}-${review.proposal.columnLabel}-${review.proposal.rowId}-${review.proposal.columnId}`)}`}

/**
 * Explicitly builds a normal Frame semantic metric command only after formula
 * translation + model resolution have both passed review.
 */
export function buildForeignFormulaMetricCommand(workspace:WorkspaceState,review:ForeignFormulaReview,options:{label?:string;id?:string;updatedAt?:string}={}):VersionedWorkspaceCommand{
  if(review.status!=='ready'||review.proposal.translation.status!=='translatable'||!review.proposal.translation.frameFormula)throw new Error('Foreign formula must be reviewed as ready before a Frame metric command can be built')
  const id=options.id??foreignFormulaMetricId(review)
  if(workspace.metrics.some((metric)=>metric.id===id))throw new Error(`Metric ${id} already exists`)
  const label=options.label??`${review.proposal.translation.functionName} ${review.resolvedTable}.${review.resolvedField}`
  const value=cachedValue(workspace,review)
  return{type:'metric.create',metric:{id,label,value,previous:value,format:'number',source:`Translated from ${review.proposal.source} · ${review.proposal.tableLabel}.${review.proposal.columnLabel}`,updatedAt:options.updatedAt??'just now',formula:review.proposal.translation.frameFormula}}
}
