import assert from 'node:assert/strict'
import test from 'node:test'
import { withImportedTables } from '../src/importedTables.ts'
import { cloneSeedWorkspace } from '../src/model.ts'
import { assessOfficeReviewExport } from '../src/officeReviewAssessment.ts'

test('Office review assessment surfaces classic Excel cell notes before export',()=>{
  const workspace=withImportedTables(cloneSeedWorkspace(),[{id:'table:pipeline',label:'Pipeline',source:'pipeline.xlsx',importedAt:'now',columns:[{id:'arr',label:'ARR',type:'number'}],rows:[{id:'row:1',values:{arr:2.4}}],commentByCell:{'row:1\u0000arr':{text:'Validate renewal assumption',author:'Alice'}}}])
  const assessment=assessOfficeReviewExport(workspace)
  assert.deepEqual(assessment.importedCellNotes,{total:1,sources:['pipeline.xlsx'],authors:['Alice'],tables:['Pipeline']})
  assert.equal(assessment.warnings.some((warning)=>/not projected into normal XLSX export yet/.test(warning)),true)
})
