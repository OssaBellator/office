import assert from 'node:assert/strict'
import test from 'node:test'
import { withImportedTables } from '../src/importedTables.ts'
import { cloneSeedWorkspace } from '../src/model.ts'
import { createVersionedWorkspaceSession, executeVersionedWorkspaceCommand } from '../src/versioning.ts'
import { semanticWorkspaceFingerprint } from '../src/workspaceFingerprint.ts'

test('semantic workspace fingerprint is deterministic for equivalent state', () => {
  const left = createVersionedWorkspaceSession(cloneSeedWorkspace()).present
  const right = structuredClone(left)
  assert.equal(semanticWorkspaceFingerprint(left), semanticWorkspaceFingerprint(right))
})

test('semantic workspace fingerprint changes when meaningful workspace state changes', () => {
  const base = createVersionedWorkspaceSession(cloneSeedWorkspace())
  const changed = executeVersionedWorkspaceCommand(base, { type:'region.update', regionId:'apac', field:'revenue', value:10 })
  assert.notEqual(semanticWorkspaceFingerprint(base.present), semanticWorkspaceFingerprint(changed.present))
})

test('semantic workspace fingerprint ignores transient change-event history', () => {
  const left = createVersionedWorkspaceSession(cloneSeedWorkspace()).present
  const right = structuredClone(left)
  right.history.push({ id:'event:test', changedAt:'later', summary:'Only history', changedObjectIds:[], affectedObjectIds:[] })
  assert.equal(semanticWorkspaceFingerprint(left), semanticWorkspaceFingerprint(right))
})

test('semantic workspace fingerprint includes authored document and presentation state', () => {
  let session = createVersionedWorkspaceSession(cloneSeedWorkspace())
  const before = semanticWorkspaceFingerprint(session.present)
  session = executeVersionedWorkspaceCommand(session, { type:'presentation.note.update', sceneId:'performance', note:'Authored note' })
  assert.notEqual(semanticWorkspaceFingerprint(session.present), before)
})

test('semantic workspace fingerprint changes for imported review-note provenance', () => {
  const table={id:'table:pipeline',label:'Pipeline',source:'pipeline.xlsx',importedAt:'now',columns:[{id:'arr',label:'ARR',type:'number'}],rows:[{id:'row:1',values:{arr:2.4}}]}
  const left=withImportedTables(cloneSeedWorkspace(),[{...table,commentByCell:{'row:1\u0000arr':{text:'Validate renewal',author:'Alice'}}}])
  const right=withImportedTables(cloneSeedWorkspace(),[{...table,commentByCell:{'row:1\u0000arr':{text:'Validated with Finance',author:'Alice'}}}])
  assert.notEqual(semanticWorkspaceFingerprint(left),semanticWorkspaceFingerprint(right))
})

test('semantic workspace fingerprint changes for imported threaded-review replies and resolution state', () => {
  const table={id:'table:pipeline',label:'Pipeline',source:'pipeline.xlsx',importedAt:'now',columns:[{id:'arr',label:'ARR',type:'number'}],rows:[{id:'row:1',values:{arr:2.4}}]}
  const root={id:'thread:1',personId:'person:alice',author:'Alice',text:'Validate renewal',done:false}
  const left=withImportedTables(cloneSeedWorkspace(),[{...table,threadByCell:{'row:1\u0000arr':{comments:[root,{id:'thread:2',personId:'person:bob',author:'Bob',text:'Checking',parentId:'thread:1'}]}}}])
  const changedReply=withImportedTables(cloneSeedWorkspace(),[{...table,threadByCell:{'row:1\u0000arr':{comments:[root,{id:'thread:2',personId:'person:bob',author:'Bob',text:'Validated',parentId:'thread:1'}]}}}])
  const resolved=withImportedTables(cloneSeedWorkspace(),[{...table,threadByCell:{'row:1\u0000arr':{comments:[{...root,done:true},{id:'thread:2',personId:'person:bob',author:'Bob',text:'Checking',parentId:'thread:1'}]}}}])
  assert.notEqual(semanticWorkspaceFingerprint(left),semanticWorkspaceFingerprint(changedReply))
  assert.notEqual(semanticWorkspaceFingerprint(left),semanticWorkspaceFingerprint(resolved))
})
