import assert from 'node:assert/strict'
import test from 'node:test'
import { proposeForeignFormulaTranslations, translateForeignFormula, translatableForeignFormulaProposals } from '../src/foreignFormulaTranslation.ts'
import { withImportedTables } from '../src/importedTables.ts'
import { cloneSeedWorkspace } from '../src/model.ts'

test('simple Excel structured aggregates translate to Frame semantic formulas',()=>{
  assert.deepEqual(translateForeignFormula('=SUM(Regions[Revenue])'),{status:'translatable',sourceFormula:'=SUM(Regions[Revenue])',frameFormula:'SUM(Regions.Revenue)',functionName:'SUM',tableName:'Regions',fieldName:'Revenue',reason:'Simple structured aggregate can map directly to a Frame semantic aggregate.'})
  assert.equal(translateForeignFormula("AVERAGE('Pipeline'[ARR])").frameFormula,'AVERAGE(Pipeline.ARR)')
  assert.equal(translateForeignFormula('COUNT(Customers[Id])').frameFormula,'COUNT(Customers.Id)')
})

test('cell refs external refs volatile functions arithmetic and unsupported functions remain inert',()=>{
  for(const formula of ['SUM(B2:B10)','SUM(Sheet2!B2:B10)','NOW()','INDIRECT("B2")','SUM(Regions[Revenue])+1','XLOOKUP(A2,Table[Id],Table[ARR])'])assert.equal(translateForeignFormula(formula).status,'unsupported',formula)
  assert.match(translateForeignFormula('SUM(Sheet2!B2:B10)').reason,/context/)
})

test('workspace proposal scan retains source cell context and separates translatable formulas',()=>{
  const workspace=withImportedTables(cloneSeedWorkspace(),[{id:'table:calc',label:'Calc',source:'model.xlsx',importedAt:'now',columns:[{id:'metric',label:'Metric',type:'number'}],rows:[{id:'row:1',values:{metric:42}},{id:'row:2',values:{metric:17}}],formulaByCell:{'row:1\u0000metric':'SUM(Regions[Revenue])','row:2\u0000metric':'B2+C2'}}])
  const proposals=proposeForeignFormulaTranslations(workspace)
  assert.equal(proposals.length,2)
  assert.equal(proposals[0].tableLabel,'Calc')
  assert.equal(proposals[0].source,'model.xlsx')
  assert.equal(proposals[0].translation.frameFormula,'SUM(Regions.Revenue)')
  assert.equal(translatableForeignFormulaProposals(workspace).length,1)
})
