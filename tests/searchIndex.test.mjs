import assert from 'node:assert/strict'
import test from 'node:test'
import { withImportedTables } from '../src/importedTables.ts'
import { cloneSeedWorkspace } from '../src/model.ts'
import { createVersionedWorkspaceSession, executeVersionedWorkspaceCommand } from '../src/versioning.ts'
import { buildWorkspaceSearchIndex, searchWorkspace } from '../src/searchIndex.ts'

test('semantic search index includes cross-surface workspace object types', () => {
  const workspace = createVersionedWorkspaceSession(cloneSeedWorkspace()).present
  const kinds = new Set(buildWorkspaceSearchIndex(workspace).map((record) => record.kind))
  for (const kind of ['document','block','claim','citation','metric','region','plan','decision','chart','source','scene','review']) assert.equal(kinds.has(kind), true)
})

test('workspace search ranks exact semantic titles above body-text matches', () => {
  const workspace = createVersionedWorkspaceSession(cloneSeedWorkspace()).present
  const results = searchWorkspace(workspace, 'APAC')
  assert.equal(results[0].id, 'region:apac')
  assert.equal(results.some((result) => result.kind === 'decision'), true)
})

test('workspace search can find formulas and source/provenance text', () => {
  const workspace = createVersionedWorkspaceSession(cloneSeedWorkspace()).present
  assert.equal(searchWorkspace(workspace, 'Regions Revenue', { kinds:['metric'] }).some((result) => result.id === 'metric:revenue'), true)
  assert.equal(searchWorkspace(workspace, 'Finance model live', { kinds:['source'] })[0].id, 'source:finance')
})

test('workspace search finds imported document blocks by source filename', () => {
  let session=createVersionedWorkspaceSession(cloneSeedWorkspace())
  session=executeVersionedWorkspaceCommand(session,{type:'document.block.insert',block:{id:'block:imported-source',type:'paragraph',text:'Imported recommendation',style:'heading-2',source:'board-strategy.docx'}})
  const result=searchWorkspace(session.present,'board strategy docx',{kinds:['block']})[0]
  assert.equal(result.id,'block:imported-source')
})

test('workspace search finds imported Data by visibility, boolean, date-system and number-format provenance',()=>{
  const workspace=withImportedTables(cloneSeedWorkspace(),[{id:'table:flags',label:'Control flags',source:'model.xlsx',importedAt:'now',sourceVisibility:'veryHidden',sourceDateSystem:'1904',columns:[{id:'enabled',label:'Enabled',type:'boolean'},{id:'date',label:'Date',type:'number'}],rows:[{id:'row:1',values:{enabled:true,date:45000}}],numberFormatByCell:{'row:1\u0000date':{numFmtId:165,formatCode:'yyyy-mm-dd'}}}])
  const results=searchWorkspace(workspace,'very hidden boolean',{kinds:['table']})
  assert.equal(results[0].id,'table:table:flags')
  assert.equal(searchWorkspace(workspace,'true',{kinds:['table']})[0].id,'table:table:flags')
  assert.equal(searchWorkspace(workspace,'1904 yyyy mm dd',{kinds:['table']})[0].id,'table:table:flags')
})

test('workspace search respects surface and kind filters', () => {
  const workspace = createVersionedWorkspaceSession(cloneSeedWorkspace()).present
  const presentResults = searchWorkspace(workspace, 'revenue', { surface:'present' })
  assert.equal(presentResults.every((result) => result.surfaces.includes('present')), true)
  assert.equal(searchWorkspace(workspace, 'APAC', { kinds:['region'] }).every((result) => result.kind === 'region'), true)
})

test('workspace search reflects live semantic state changes', () => {
  let session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  session = executeVersionedWorkspaceCommand(session, { type:'presentation.note.update', sceneId:'performance', note:'Lead with enterprise retention risk.' })
  assert.equal(searchWorkspace(session.present, 'enterprise retention', { kinds:['scene'] })[0].id, 'scene:performance')
  session = executeVersionedWorkspaceCommand(session, { type:'source.status', sourceId:'source:finance', status:'stale' })
  assert.equal(searchWorkspace(session.present, 'stale', { kinds:['source'] })[0].id, 'source:finance')
})

test('empty queries return no semantic search results', () => {
  const workspace = createVersionedWorkspaceSession(cloneSeedWorkspace()).present
  assert.deepEqual(searchWorkspace(workspace, '   '), [])
})
