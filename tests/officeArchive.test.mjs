import assert from 'node:assert/strict'
import test from 'node:test'
import { readOfficeZip, readOfficeXml } from '../src/officeArchive.ts'

const encoder=new TextEncoder()
function u16(value){return[value&255,(value>>8)&255]}
function u32(value){return[value&255,(value>>8)&255,(value>>16)&255,(value>>24)&255]}
function zipEntry(name,text,{flags=0,method=0,reportedCompressed,reportedUncompressed}={}){
  const nameBytes=encoder.encode(name),data=encoder.encode(text)
  const compressed=reportedCompressed??data.length,uncompressed=reportedUncompressed??data.length
  const local=Uint8Array.from([...u32(0x04034b50),...u16(20),...u16(flags),...u16(method),...u16(0),...u16(0),...u32(0),...u32(compressed),...u32(uncompressed),...u16(nameBytes.length),...u16(0),...nameBytes,...data])
  const central=Uint8Array.from([...u32(0x02014b50),...u16(20),...u16(20),...u16(flags),...u16(method),...u16(0),...u16(0),...u32(0),...u32(compressed),...u32(uncompressed),...u16(nameBytes.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(0),...nameBytes])
  const end=Uint8Array.from([...u32(0x06054b50),...u16(0),...u16(0),...u16(1),...u16(1),...u32(central.length),...u32(local.length),...u16(0)])
  const bytes=new Uint8Array(local.length+central.length+end.length);bytes.set(local,0);bytes.set(central,local.length);bytes.set(end,local.length+central.length);return bytes
}

test('Office archive keeps binary entry names without inflating unused media',async()=>{
  const bytes=zipEntry('ppt/media/image1.png','not-really-an-image')
  const entries=await readOfficeZip(bytes)
  assert.equal(entries.has('ppt/media/image1.png'),true)
  assert.equal(entries.get('ppt/media/image1.png').byteLength,0)
  assert.equal(readOfficeXml(entries,'ppt/media/image1.png'),null)
})

test('Office archive materializes XML entries normally',async()=>{
  const bytes=zipEntry('word/document.xml','<w:document/>')
  const entries=await readOfficeZip(bytes)
  assert.equal(readOfficeXml(entries,'word/document.xml'),'<w:document/>')
})

test('Office archive rejects encrypted entries',async()=>{
  await assert.rejects(()=>readOfficeZip(zipEntry('word/document.xml','<x/>',{flags:1})),/Password-protected/)
})

test('Office archive rejects XML entries whose advertised expansion exceeds the safe limit',async()=>{
  const huge=33*1024*1024
  await assert.rejects(()=>readOfficeZip(zipEntry('word/document.xml','<x/>',{reportedUncompressed:huge})),/too large to import safely/)
})

test('Office archive rejects payload ranges outside the package instead of slicing silently',async()=>{
  await assert.rejects(()=>readOfficeZip(zipEntry('word/document.xml','<x/>',{reportedCompressed:1000,reportedUncompressed:1000})),/payload/)
})
