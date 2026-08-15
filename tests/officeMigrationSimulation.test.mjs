import assert from 'node:assert/strict'
import test from 'node:test'
import { cloneSeedWorkspace } from '../src/model.ts'
import { createStoredZip } from '../src/officeExport.ts'
import { simulateOfficeMigration } from '../src/officeMigrationSimulation.ts'

function docx(text){return createStoredZip({'[Content_Types].xml':'<Types/>','word/document.xml':`<w:document><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`})}

test('dry-run migration applies new sources in memory and skips byte-identical duplicates by default',async()=>{
  const bytes=docx('Imported strategy')
  const simulation=await simulateOfficeMigration(cloneSeedWorkspace(),[{name:'strategy.docx',bytes},{name:'copy.docx',bytes:bytes.slice()}])
  assert.equal(simulation.files[0].status,'applied')
  assert.equal(simulation.files[1].status,'duplicate-skipped')
  assert.equal(simulation.files[1].classification,'duplicate-content')
  assert.equal(simulation.session.past.length>0,true)
  assert.equal(simulation.ledger.revisions.length,2)
  assert.equal(simulation.session.present.document.title,cloneSeedWorkspace().document.title)
})

test('dry-run migration can deliberately include duplicate content for diagnostics',async()=>{
  const bytes=docx('Imported strategy')
  const simulation=await simulateOfficeMigration(cloneSeedWorkspace(),[{name:'strategy.docx',bytes},{name:'copy.docx',bytes:bytes.slice()}],{skipDuplicateContent:false})
  assert.deepEqual(simulation.files.map((item)=>item.status),['applied','applied'])
  assert.equal(simulation.session.past.length>=2,true)
})

test('dry-run migration reports invalid files without mutating the simulated session',async()=>{
  const initial=cloneSeedWorkspace(),simulation=await simulateOfficeMigration(initial,[{name:'broken.xlsx',bytes:new Uint8Array([1,2,3])}])
  assert.equal(simulation.files[0].status,'failed')
  assert.equal(simulation.session.past.length,0)
  assert.equal(simulation.formulaTranslation.total,0)
  assert.equal(simulation.importedReview.total,0)
})
