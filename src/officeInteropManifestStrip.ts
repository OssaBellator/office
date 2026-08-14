import { createStoredZip, type OfficeExportFile } from './officeExport.ts'
import { FRAME_INTEROP_CONTENT_TYPE, FRAME_INTEROP_MANIFEST_PATH, FRAME_INTEROP_RELATIONSHIP } from './officeInteropManifest.ts'

function u16(bytes:Uint8Array,offset:number){return bytes[offset]|bytes[offset+1]<<8}
function u32(bytes:Uint8Array,offset:number){return(bytes[offset]|bytes[offset+1]<<8|bytes[offset+2]<<16|bytes[offset+3]<<24)>>>0}
function storedEntries(bytes:Uint8Array){
  const result=new Map<string,Uint8Array>(),decoder=new TextDecoder();let offset=0
  while(offset+30<=bytes.length&&u32(bytes,offset)===0x04034b50){
    const flags=u16(bytes,offset+6),method=u16(bytes,offset+8),size=u32(bytes,offset+18),nameLength=u16(bytes,offset+26),extraLength=u16(bytes,offset+28)
    if(flags&0x08||method!==0)throw new Error('Frame manifest stripping expects a Frame-generated stored Office package')
    const nameStart=offset+30,nameEnd=nameStart+nameLength,dataStart=nameEnd+extraLength,dataEnd=dataStart+size
    if(dataEnd>bytes.length)throw new Error('Office package entry exceeds bounds')
    result.set(decoder.decode(bytes.slice(nameStart,nameEnd)),bytes.slice(dataStart,dataEnd));offset=dataEnd
  }
  return result
}
function removeOverride(content:string){return content.replace(new RegExp(`<Override\\b(?=[^>]*PartName="/${FRAME_INTEROP_MANIFEST_PATH.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}")(?=[^>]*ContentType="${FRAME_INTEROP_CONTENT_TYPE.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}")[^>]*/>`,'gi'),'')}
function removeRelationship(content:string){return content.replace(new RegExp(`<Relationship\\b(?=[^>]*Type="${FRAME_INTEROP_RELATIONSHIP.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}")[^>]*/>`,'gi'),'')}

export function stripFrameInteropManifest(file:OfficeExportFile):OfficeExportFile{
  const entries=storedEntries(file.bytes),decoder=new TextDecoder(),encoder=new TextEncoder()
  if(!entries.has(FRAME_INTEROP_MANIFEST_PATH))return file
  entries.delete(FRAME_INTEROP_MANIFEST_PATH)
  const contentTypes=entries.get('[Content_Types].xml'),rels=entries.get('_rels/.rels')
  if(contentTypes)entries.set('[Content_Types].xml',encoder.encode(removeOverride(decoder.decode(contentTypes))))
  if(rels)entries.set('_rels/.rels',encoder.encode(removeRelationship(decoder.decode(rels))))
  return{...file,bytes:createStoredZip(Object.fromEntries(entries))}
}
