import assert from 'node:assert/strict'
import test from 'node:test'
import { reviewForeignFormulaTranslations, reviewForeignFormulaProposal, readyForeignFormulaTranslations } from '../src/foreignFormulaReview.ts'
import { withImportedTables } from '../src/importedTables.ts'
import { cloneSeedWorkspace } from '../src/model.ts'

function proposal(formula,frameFormula,tableName,fieldName){return{tableId:'table:calc',tableLabel:'Calc',rowId:'row:1',columnId:'metric',columnLabel:'Metric',source:'model.xlsx',sourceFormula:formula,translation:{status:'translatable',sourceFormula:formula,frameFormula,functionName:'SUM',tableName,fieldName,reason:'candidate'}}}

test('formula review marks existing Frame table/field references ready',()=>{
  const review=reviewForeignFormulaProposal(cloneSeedWorkspace(),proposal('SUM(Regions[Revenue])','SUM(Regions.Revenue)','Regions','Revenue'))
  assert.equal(review.status,'ready')
  assert.equal(review.resolvedTable,'Regions')
  assert.equal(review.resolvedField,'Revenue')
})

test('formula review requires model promotion for retained imported Data references',()=>{
  const workspace=withImportedTables(cloneSeedWorkspace(),[{id:'table:pipeline',label:'Pipeline',source:'sales.xlsx',importedAt:'now',columns:[{id:'arr',label:'ARR',type:'number'}],rows:[{id:'row:1',values:{arr:2.4}}]}])
  const review=reviewForeignFormulaProposal(workspace,proposal('SUM(Pipeline[ARR])','SUM(Pipeline.ARR)','Pipeline','ARR'))
  assert.equal(review.status,'requires-model-promotion')
  assert.match(review.reason,/Promote\/model this table/)
})

test('formula review surfaces missing tables and fields instead of guessing',()=>{
  assert.equal(reviewForeignFormulaProposal(cloneSeedWorkspace(),proposal('SUM(Regions[Profit])','SUM(Regions.Profit)','Regions','Profit')).status,'missing-field')
  assert.equal(reviewForeignFormulaProposal(cloneSeedWorkspace(),proposal('SUM(Unknown[Revenue])','SUM(Unknown.Revenue)','Unknown','Revenue')).status,'missing-table')
})

test('workspace review only marks proven existing-model formulas ready',()=>{
  const workspace=withImportedTables(cloneSeedWorkspace(),[{id:'table:calc',label:'Calc',source:'model.xlsx',importedAt:'now',columns:[{id:'metric',label:'Metric',type:'number'}],rows:[{id:'row:1',values:{metric:42}},{id:'row:2',values:{metric:7}}],formulaByCell:{'row:1\u0000metric':'SUM(Regions[Revenue])','row:2\u0000metric':'SUM(Unknown[Revenue])'}}])
  const reviews=reviewForeignFormulaTranslations(workspace)
  assert.equal(reviews.length,2)
  assert.equal(readyForeignFormulaTranslations(workspace).length,1)
})
