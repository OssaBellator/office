import assert from 'node:assert/strict'
import test from 'node:test'
import { buildForeignFormulaMetricCommand, foreignFormulaMetricId } from '../src/foreignFormulaMetricDraft.ts'
import { reviewForeignFormulaProposal } from '../src/foreignFormulaReview.ts'
import { withImportedTables } from '../src/importedTables.ts'
import { cloneSeedWorkspace } from '../src/model.ts'

function workspace(){return withImportedTables(cloneSeedWorkspace(),[{id:'table:calc',label:'Calc',source:'model.xlsx',importedAt:'now',columns:[{id:'metric',label:'Metric',type:'number'}],rows:[{id:'row:1',values:{metric:42}}]}])}
function proposal(){return{tableId:'table:calc',tableLabel:'Calc',rowId:'row:1',columnId:'metric',columnLabel:'Metric',source:'model.xlsx',sourceFormula:'SUM(Regions[Revenue])',translation:{status:'translatable',sourceFormula:'SUM(Regions[Revenue])',frameFormula:'SUM(Regions.Revenue)',functionName:'SUM',tableName:'Regions',fieldName:'Revenue',reason:'candidate'}}}

test('ready foreign formula review becomes a normal semantic metric.create command',()=>{
  const ws=workspace(),review=reviewForeignFormulaProposal(ws,proposal()),command=buildForeignFormulaMetricCommand(ws,review,{updatedAt:'2026-08-15'})
  assert.equal(review.status,'ready')
  assert.equal(command.type,'metric.create')
  assert.equal(command.metric.formula,'SUM(Regions.Revenue)')
  assert.equal(command.metric.value,42)
  assert.equal(command.metric.previous,42)
  assert.match(command.metric.source,/model\.xlsx/)
  assert.equal(command.metric.id,foreignFormulaMetricId(review))
})

test('foreign formula metric builder rejects unproven formulas and id collisions',()=>{
  const ws=workspace(),review=reviewForeignFormulaProposal(ws,proposal())
  assert.throws(()=>buildForeignFormulaMetricCommand(ws,{...review,status:'unsupported'}),/reviewed as ready/)
  const id=ws.metrics[0].id
  assert.throws(()=>buildForeignFormulaMetricCommand(ws,review,{id}),/already exists/)
})
