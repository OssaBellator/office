import assert from 'node:assert/strict'
import test from 'node:test'
import { withImportedTables } from '../src/importedTables.ts'
import { cloneSeedWorkspace } from '../src/model.ts'
import { assessOfficeReviewExport } from '../src/officeReviewAssessment.ts'

test('Office review assessment aggregates legacy notes and threaded Excel review without duplicate warnings',()=>{
  const workspace=withImportedTables(cloneSeedWorkspace(),[{id:'table:pipeline',label:'Pipeline',source:'pipeline.xlsx',importedAt:'now',columns:[{id:'arr',label:'ARR',type:'number'}],rows:[{id:'row:1',values:{arr:2.4}}],commentByCell:{'row:1\u0000arr':{text:'Validate renewal assumption',author:'Alice'}},threadByCell:{'row:1\u0000arr':{comments:[{id:'thread:1',personId:'person:alice',author:'Alice',text:'Review renewal',done:false},{id:'thread:2',personId:'person:bob',author:'Bob',text:'Validated',parentId:'thread:1'}]}}}])
  const assessment=assessOfficeReviewExport(workspace)
  assert.deepEqual(assessment.importedCellNotes,{total:1,sources:['pipeline.xlsx'],authors:['Alice'],tables:['Pipeline']})
  assert.deepEqual(assessment.importedThreads,{threads:1,comments:2,open:1,resolved:0,sources:['pipeline.xlsx'],participants:['Alice','Bob']})
  assert.equal(assessment.exportAssessment.xlsx.reviewNoteCells,1)
  assert.equal(assessment.exportAssessment.xlsx.reviewThreadCells,1)
  assert.equal(assessment.warnings.filter((warning)=>/Excel cell note/.test(warning)).length,1)
  assert.equal(assessment.warnings.filter((warning)=>/Excel review thread/.test(warning)).length,1)
})
