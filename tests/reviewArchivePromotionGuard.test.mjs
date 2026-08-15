import assert from 'node:assert/strict'
import test from 'node:test'
import { getImportedDataReviewItems } from '../src/importedDataReview.ts'
import { withImportedTables } from '../src/importedTables.ts'
import { cloneSeedWorkspace } from '../src/model.ts'
import { planBatchPromoteSourceReviews } from '../src/reviewBatchPromotion.ts'
import { planPromoteSourceReview } from '../src/reviewPromotion.ts'

function workspace(){return withImportedTables(cloneSeedWorkspace(),[{id:'table:archive',label:'Pipeline · review archive',source:'pipeline.xlsx',importedAt:'earlier',columns:[{id:'arr',label:'ARR',type:'number'}],rows:[{id:'row:old',values:{arr:2.4}}],commentByCell:{'row:old\u0000arr':{text:'Validate renewal',author:'Alice',sourceRef:'B2'}}}])}

test('single promotion rejects copied review archive provenance as new native work',()=>{
  const base=workspace(),source=getImportedDataReviewItems(base)[0]
  assert.ok(source)
  assert.throws(()=>planPromoteSourceReview(base,source.id),/Review archive provenance cannot be promoted/)
})

test('batch promotion rejects copied review archive provenance even when called outside Review Center',()=>{
  const base=workspace(),source=getImportedDataReviewItems(base)[0]
  assert.ok(source)
  assert.throws(()=>planBatchPromoteSourceReviews(base,[source.id]),/Review archive provenance cannot be batch-promoted/)
})
