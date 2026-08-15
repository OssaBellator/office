import { AlertCircle, CheckCircle2, FunctionSquare, Layers3 } from 'lucide-react'
import { reviewForeignFormulaTranslations, type ForeignFormulaReview } from '../foreignFormulaReview'
import type { WorkspaceState } from '../model'

export function ForeignFormulaReviewPanel({workspace}:{workspace:WorkspaceState}){
  const reviews=reviewForeignFormulaTranslations(workspace)
  if(!reviews.length)return null
  const ready=reviews.filter((review)=>review.status==='ready').length
  return <section className="foreign-formula-review-panel">
    <header><div><FunctionSquare size={15}/><div><span>FOREIGN FORMULA REVIEW</span><strong>Preserved formulas → Frame candidates</strong></div></div><small>{ready}/{reviews.length} ready</small></header>
    <p>Frame never executes imported spreadsheet formulas implicitly. Only a narrow structured-aggregate subset is translated, and candidates become executable only after their semantic table/field context is proven.</p>
    <div className="foreign-formula-review-list">{reviews.slice(0,12).map((review)=><FormulaReviewItem key={`${review.proposal.tableId}:${review.proposal.rowId}:${review.proposal.columnId}`} review={review}/>)}</div>
    {reviews.length>12&&<footer>Showing 12 of {reviews.length} preserved foreign formula reviews.</footer>}
  </section>
}

function FormulaReviewItem({review}:{review:ForeignFormulaReview}){
  const Icon=review.status==='ready'?CheckCircle2:review.status==='requires-model-promotion'?Layers3:AlertCircle
  return <article className={`foreign-formula-review-item ${review.status}`}><span className="foreign-formula-review-icon"><Icon size={12}/></span><div><div className="foreign-formula-review-title"><strong>{review.proposal.tableLabel} · {review.proposal.columnLabel}</strong><small>{review.status.replace(/-/g,' ')}</small></div><code>={review.proposal.sourceFormula.replace(/^=/,'')}</code>{review.proposal.translation.frameFormula&&<code className="frame-formula-candidate">→ {review.proposal.translation.frameFormula}</code>}<p>{review.reason}</p></div></article>
}
