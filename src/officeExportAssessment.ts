import { getImportedTables, isSafeNavigableImportedLink, type ImportedNumberFormat } from './importedTables.ts'
import type { WorkspaceState } from './model.ts'
import { buildPresentationScenes } from './presentationModel.ts'
import { getSemanticDocument } from './semanticDocument.ts'
import { getWorkspaceReviews, workspaceReviewIsOpen } from './workspaceReviews.ts'

export type OfficeExportAssessment={
  docx:{documentBlocks:number;claims:number;reviews:number;sourceReviewComments:number}
  pptx:{scenes:number;speakerNotes:number}
  xlsx:{tables:number;formulaCells:number;numberFormatCells:number;hyperlinkCells:number;exportableHyperlinkCells:number;suppressedHyperlinkCells:number;reviewNoteCells:number;reviewThreadCells:number;threadedComments:number;openReviewThreads:number;promotedReviewItems:number;openPromotedReviews:number;booleanCells:number;hiddenTables:number;veryHiddenTables:number;sourceDateSystems:Array<'1900'|'1904'>;suppressedDateLikeFormatCells:number}
  warnings:string[]
}

const builtinDateFormatIds=new Set([14,15,16,17,18,19,20,21,22,27,28,29,30,31,32,33,34,35,36,45,46,47,50,51,52,53,54,55,56,57,58])
function looksDateLike(format:ImportedNumberFormat){
  if(builtinDateFormatIds.has(format.numFmtId))return true
  if(!format.formatCode)return false
  const stripped=format.formatCode.replace(/"[^"]*"/g,'').replace(/\\./g,'').replace(/\[[^\]]*\]/g,'')
  return /(^|[^a-z])[ymdhis]+([^a-z]|$)/i.test(stripped)
}

export function assessOfficeExport(workspace:WorkspaceState):OfficeExportAssessment{
  const semantic=getSemanticDocument(workspace),scenes=buildPresentationScenes(workspace),tables=getImportedTables(workspace),workspaceReviews=getWorkspaceReviews(workspace)
  const nativeWorkspaceReviews=workspaceReviews.filter((review)=>!review.sourceOnly)
  const sourceReviewComments=workspaceReviews.filter((review)=>review.sourceOnly&&review.sourceReview?.kind==='word-comment').length
  let formulaCells=0,numberFormatCells=0,hyperlinkCells=0,exportableHyperlinkCells=0,suppressedHyperlinkCells=0,reviewNoteCells=0,reviewThreadCells=0,threadedComments=0,openReviewThreads=0,booleanCells=0,hiddenTables=0,veryHiddenTables=0,suppressedDateLikeFormatCells=0
  const sourceDateSystems=new Set<'1900'|'1904'>()
  for(const table of tables){
    formulaCells+=Object.keys(table.formulaByCell??{}).length
    numberFormatCells+=Object.keys(table.numberFormatByCell??{}).length
    reviewNoteCells+=Object.keys(table.commentByCell??{}).length
    const threads=Object.values(table.threadByCell??{});reviewThreadCells+=threads.length
    for(const thread of threads){threadedComments+=thread.comments.length;const root=thread.comments.find((comment)=>!comment.parentId)??thread.comments[0];if(root&&root.done!==true)openReviewThreads+=1}
    const links=Object.values(table.linkByCell??{});hyperlinkCells+=links.length
    for(const link of links){if(link.kind==='internal'||isSafeNavigableImportedLink(link))exportableHyperlinkCells+=1;else suppressedHyperlinkCells+=1}
    if(table.sourceVisibility==='hidden')hiddenTables+=1
    if(table.sourceVisibility==='veryHidden')veryHiddenTables+=1
    if(Object.keys(table.numberFormatByCell??{}).length)sourceDateSystems.add(table.sourceDateSystem??'1900')
    for(const row of table.rows)for(const value of Object.values(row.values))if(typeof value==='boolean')booleanCells+=1
  }
  if(sourceDateSystems.size>1){
    for(const table of tables){
      if((table.sourceDateSystem??'1900')!=='1904')continue
      for(const format of Object.values(table.numberFormatByCell??{}))if(looksDateLike(format))suppressedDateLikeFormatCells+=1
    }
  }
  const promotedReviewItems=nativeWorkspaceReviews.length,openPromotedReviews=nativeWorkspaceReviews.filter(workspaceReviewIsOpen).length
  const warnings:string[]=[]
  if(formulaCells)warnings.push(`${formulaCells} imported Excel/Sheets formula cell${formulaCells===1?' exports':'s export'} as cached values only; Frame never reactivates foreign spreadsheet formulas implicitly.`)
  if(suppressedDateLikeFormatCells)warnings.push(`${suppressedDateLikeFormatCells} date-like number format${suppressedDateLikeFormatCells===1?' is':'s are'} intentionally omitted from 1904-source cells because this combined workbook also contains 1900-source formatting. Raw serial values remain unchanged.`)
  if(numberFormatCells&&!suppressedDateLikeFormatCells)warnings.push(`${numberFormatCells} imported Excel number-format cell${numberFormatCells===1?' is':'s are'} projected back into XLSX styles.`)
  if(exportableHyperlinkCells)warnings.push(`${exportableHyperlinkCells} safe web/mail or internal workbook hyperlink${exportableHyperlinkCells===1?' is':'s are'} projected back into XLSX.`)
  if(suppressedHyperlinkCells)warnings.push(`${suppressedHyperlinkCells} imported external hyperlink${suppressedHyperlinkCells===1?' is':'s are'} preserved in Frame but omitted from XLSX because the target uses a file/custom/unsupported scheme.`)
  if(reviewNoteCells)warnings.push(`${reviewNoteCells} imported Excel cell note${reviewNoteCells===1?' remains':'s remain'} Frame review provenance and ${reviewNoteCells===1?'is':'are'} omitted from the default XLSX compatibility projection until classic-note export is externally validated.`)
  if(reviewThreadCells)warnings.push(`${reviewThreadCells} imported Excel review thread${reviewThreadCells===1?' remains':'s remain'} in Frame (${threadedComments} comment${threadedComments===1?'':'s'}, ${openReviewThreads} open) and ${reviewThreadCells===1?'is':'are'} omitted from the default XLSX projection rather than flattened into legacy notes.`)
  if(promotedReviewItems)warnings.push(`${promotedReviewItems} native Frame review${promotedReviewItems===1?' remains':'s remain'} in Frame (${openPromotedReviews} open) and ${promotedReviewItems===1?'is':'are'} not embedded into the default Office compatibility projection.`)
  if(sourceReviewComments)warnings.push(`${sourceReviewComments} imported Word source comment${sourceReviewComments===1?' remains':'s remain'} as Frame provenance and ${sourceReviewComments===1?'is':'are'} not treated as native review work or exported until explicitly promoted.`)
  if(hiddenTables||veryHiddenTables)warnings.push(`${hiddenTables+veryHiddenTables} imported worksheet${hiddenTables+veryHiddenTables===1?' retains':'s retain'} source hidden/very-hidden state in XLSX export.`)
  warnings.push('Frame JSON remains the lossless semantic backup; Office files are compatibility projections and do not carry hidden Frame-only manifest metadata by default.')
  return{
    docx:{documentBlocks:semantic.blocks.length,claims:semantic.claims.length,reviews:semantic.annotations.length,sourceReviewComments},
    pptx:{scenes:scenes.length,speakerNotes:scenes.filter((scene)=>Boolean(scene.note)).length},
    xlsx:{tables:2+tables.length,formulaCells,numberFormatCells,hyperlinkCells,exportableHyperlinkCells,suppressedHyperlinkCells,reviewNoteCells,reviewThreadCells,threadedComments,openReviewThreads,promotedReviewItems,openPromotedReviews,booleanCells,hiddenTables,veryHiddenTables,sourceDateSystems:[...sourceDateSystems].sort(),suppressedDateLikeFormatCells},
    warnings,
  }
}
