import assert from 'node:assert/strict'
import test from 'node:test'
import { planSynchronizedOfficeImport } from '../src/officeImportFacade.ts'
import { cloneSeedWorkspace } from '../src/model.ts'
import { getSemanticDocument, withSemanticDocument } from '../src/semanticDocument.ts'

const encoder=new TextEncoder()
function u16(value){return[value&255,(value>>8)&255]}
function u32(value){return[value&255,(value>>8)&255,(value>>16)&255,(value>>24)&255]}
function docx(text){const name='word/document.xml',n=encoder.encode(name),d=encoder.encode(`<w:document><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`),local=Uint8Array.from([...u32(0x04034b50),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(d.length),...u32(d.length),...u16(n.length),...u16(0),...n,...d]),central=Uint8Array.from([...u32(0x02014b50),...u16(20),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(d.length),...u32(d.length),...u16(n.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(0),...n]),end=Uint8Array.from([...u32(0x06054b50),...u16(0),...u16(0),...u16(1),...u16(1),...u32(central.length),...u32(local.length),...u16(0)]),bytes=new Uint8Array(local.length+central.length+end.length);bytes.set(local);bytes.set(central,local.length);bytes.set(end,local.length+central.length);return bytes}

test('canonical Office import facade synchronizes a newer source revision automatically',async()=>{
  let workspace=cloneSeedWorkspace()
  const semantic=getSemanticDocument(workspace)
  semantic.blocks.push({id:'block:prior-office',type:'paragraph',text:'Prior revision',source:'strategy.docx'})
  workspace=withSemanticDocument(workspace,semantic)
  const plan=await planSynchronizedOfficeImport(workspace,docx('New revision'),'strategy.docx')
  assert.equal(plan.commands.some((command)=>command.type==='document.block.remove'&&command.blockId==='block:prior-office'),true)
  assert.equal(plan.commands.some((command)=>command.type==='document.block.insert'&&command.block.text==='New revision'),true)
})
