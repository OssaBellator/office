import { reviewForeignFormulaTranslations } from './foreignFormulaReview.ts'
import type { WorkspaceState } from './model.ts'

export type ForeignFormulaTranslationReport={
  total:number
  ready:number
  requiresModelPromotion:number
  unsupported:number
  missingTable:number
  missingField:number
  sources:string[]
  readyFrameFormulas:string[]
  blockers:Array<{source:string;table:string;column:string;formula:string;status:string;reason:string}>
}

export function buildForeignFormulaTranslationReport(workspace:WorkspaceState):ForeignFormulaTranslationReport{
  const reviews=reviewForeignFormulaTranslations(workspace)
  const count=(status:string)=>reviews.filter((review)=>review.status===status).length
  return{
    total:reviews.length,
    ready:count('ready'),
    requiresModelPromotion:count('requires-model-promotion'),
    unsupported:count('unsupported'),
    missingTable:count('missing-table'),
    missingField:count('missing-field'),
    sources:[...new Set(reviews.map((review)=>review.proposal.source))].sort(),
    readyFrameFormulas:[...new Set(reviews.flatMap((review)=>review.status==='ready'&&review.proposal.translation.frameFormula?[review.proposal.translation.frameFormula]:[]))].sort(),
    blockers:reviews.filter((review)=>review.status!=='ready').map((review)=>({source:review.proposal.source,table:review.proposal.tableLabel,column:review.proposal.columnLabel,formula:review.proposal.sourceFormula,status:review.status,reason:review.reason})),
  }
}
