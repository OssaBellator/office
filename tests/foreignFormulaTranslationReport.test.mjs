import assert from 'node:assert/strict'
import test from 'node:test'
import { buildForeignFormulaTranslationReport } from '../src/foreignFormulaTranslationReport.ts'
import { withImportedTables } from '../src/importedTables.ts'
import { cloneSeedWorkspace } from '../src/model.ts'

test('foreign formula translation report separates ready promoted and unsupported candidates',()=>{
  const workspace=withImportedTables(cloneSeedWorkspace(),[
    {id:'table:pipeline',label:'Pipeline',source:'sales.xlsx',importedAt:'now',columns:[{id:'arr',label:'ARR',type:'number'}],rows:[{id:'p1',values:{arr:2.4}}]},
    {id:'table:calc',label:'Calc',source:'model.xlsx',importedAt:'now',columns:[{id:'metric',label:'Metric',type:'number'}],rows:[{id:'r1',values:{metric:42}},{id:'r2',values:{metric:5}},{id:'r3',values:{metric:9}}],formulaByCell:{'r1\u0000metric':'SUM(Regions[Revenue])','r2\u0000metric':'SUM(Pipeline[ARR])','r3\u0000metric':'B2+C2'}},
  ])
  const report=buildForeignFormulaTranslationReport(workspace)
  assert.equal(report.total,3)
  assert.equal(report.ready,1)
  assert.equal(report.requiresModelPromotion,1)
  assert.equal(report.unsupported,1)
  assert.deepEqual(report.readyFrameFormulas,['SUM(Regions.Revenue)'])
  assert.equal(report.blockers.length,2)
  assert.deepEqual(report.sources,['model.xlsx'])
})
