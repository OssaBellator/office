import assert from 'node:assert/strict'
import test from 'node:test'
import { planGoogleWorkspaceImport } from '../src/googleWorkspaceImport.ts'
import { cloneSeedWorkspace } from '../src/model.ts'
import { getSemanticDocument } from '../src/semanticDocument.ts'
import { createVersionedWorkspaceSession, executeVersionedWorkspaceCommand } from '../src/versioning.ts'

const encoder=new TextEncoder()
function u16(value){return[value&255,(value>>8)&255]}
function u32(value){return[value&255,(value>>8)&255,(value>>16)&255,(value>>24)&255]}
function docx(text){
  const name='word/document.xml',nameBytes=encoder.encode(name),data=encoder.encode(`<w:document><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`)
  const local=Uint8Array.from([...u32(0x04034b50),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(data.length),...u32(data.length),...u16(nameBytes.length),...u16(0),...nameBytes,...data])
  const central=Uint8Array.from([...u32(0x02014b50),...u16(20),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(data.length),...u32(data.length),...u16(nameBytes.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(0),...nameBytes])
  const end=Uint8Array.from([...u32(0x06054b50),...u16(0),...u16(0),...u16(1),...u16(1),...u32(central.length),...u32(local.length),...u16(0)])
  const bytes=new Uint8Array(local.length+central.length+end.length);bytes.set(local);bytes.set(central,local.length);bytes.set(end,local.length+central.length);return bytes
}

function applyPlan(session,plan){let next=session;for(const command of plan.commands)next=executeVersionedWorkspaceCommand(next,command);return next}

test('re-importing the same Google Doc replaces its prior imported semantic blocks',async()=>{
  let revision=0
  const provider={exportFile:async()=>docx(revision++===0?'First Google revision':'Second Google revision')}
  let session=createVersionedWorkspaceSession(cloneSeedWorkspace())
  const file={id:'google-doc-1',name:'Shared strategy',kind:'document'}
  const first=await planGoogleWorkspaceImport(session.present,file,provider)
  session=applyPlan(session,first)
  assert.equal(getSemanticDocument(session.present).blocks.filter((block)=>block.type==='paragraph'&&block.source==='Shared strategy.docx').length,1)

  const second=await planGoogleWorkspaceImport(session.present,file,provider)
  assert.equal(second.commands.some((command)=>command.type==='document.block.remove'),true)
  session=applyPlan(session,second)
  const imported=getSemanticDocument(session.present).blocks.filter((block)=>block.type==='paragraph'&&block.source==='Shared strategy.docx')
  assert.equal(imported.length,1)
  assert.equal(imported[0].text,'Second Google revision')
  assert.equal(getSemanticDocument(session.present).blocks.some((block)=>block.type==='paragraph'&&block.text==='First Google revision'),false)
})
