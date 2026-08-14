import { getImportedTables } from './importedTables.ts'
import type { WorkspaceState } from './model.ts'
import { createStoredZip, exportWorkspaceDocx, exportWorkspacePptx, exportWorkspaceXlsx, type OfficeExportFile } from './officeExport.ts'
import { readOfficeXml, readOfficeZip } from './officeArchive.ts'
import { getPresentationState } from './presentationState.ts'
import { getSemanticDocument } from './semanticDocument.ts'
import { semanticWorkspaceFingerprint } from './workspaceFingerprint.ts'

export const FRAME_INTEROP_MANIFEST_PATH='frame/interop.xml'
export const FRAME_INTEROP_RELATIONSHIP='https://frame.local/relationships/interoperability-manifest'
export const FRAME_INTEROP_CONTENT_TYPE='application/vnd.frame.interoperability+xml'

export type FrameInteropManifest={
  version:1
  generator:'Frame'
  kind:'docx'|'pptx'|'xlsx'
  workspaceFingerprint:string
  workspaceTitle:string
  semanticDocument:ReturnType<typeof getSemanticDocument>
  importedTables:ReturnType<typeof getImportedTables>
  presentation:ReturnType<typeof getPresentationState>
}

function xml(value:string){return value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;')}
function decodeXml(value:string){return value.replace(/&#x([0-9a-f]+);/gi,(_,hex)=>String.fromCodePoint(Number.parseInt(hex,16))).replace(/&#(\d+);/g,(_,decimal)=>String.fromCodePoint(Number(decimal))).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&')}
function u16(bytes:Uint8Array,offset:number){return bytes[offset]|bytes[offset+1]<<8}
function u32(bytes:Uint8Array,offset:number){return(bytes[offset]|bytes[offset+1]<<8|bytes[offset+2]<<16|bytes[offset+3]<<24)>>>0}

function storedZipEntries(bytes:Uint8Array){
  const result=new Map<string,Uint8Array>(),decoder=new TextDecoder(),view=bytes
  let offset=0
  while(offset+30<=view.length&&u32(view,offset)===0x04034b50){
    const flags=u16(view,offset+6),method=u16(view,offset+8),compressedSize=u32(view,offset+18),nameLength=u16(view,offset+26),extraLength=u16(view,offset+28)
    if(flags&0x08)throw new Error('Frame manifest embedding requires generated ZIP entries with sizes in local headers')
    if(method!==0)throw new Error('Frame manifest embedding expects Frame-generated stored ZIP entries')
    const nameStart=offset+30,nameEnd=nameStart+nameLength,dataStart=nameEnd+extraLength,dataEnd=dataStart+compressedSize
    if(dataEnd>view.length)throw new Error('Frame-generated Office ZIP entry exceeds package bounds')
    result.set(decoder.decode(view.slice(nameStart,nameEnd)),view.slice(dataStart,dataEnd))
    offset=dataEnd
  }
  return result
}

function injectBeforeClosingTag(xmlText:string,closingTag:string,fragment:string){const index=xmlText.lastIndexOf(closingTag);if(index<0)throw new Error(`Office package metadata is missing ${closingTag}`);return`${xmlText.slice(0,index)}${fragment}${xmlText.slice(index)}`}
function manifestXml(manifest:FrameInteropManifest){return`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><frame:interop xmlns:frame="https://frame.local/interoperability" version="1"><frame:payload>${xml(JSON.stringify(manifest))}</frame:payload></frame:interop>`}

export function createFrameInteropManifest(workspace:WorkspaceState,kind:FrameInteropManifest['kind']):FrameInteropManifest{
  return{version:1,generator:'Frame',kind,workspaceFingerprint:semanticWorkspaceFingerprint(workspace),workspaceTitle:workspace.title,semanticDocument:getSemanticDocument(workspace),importedTables:getImportedTables(workspace),presentation:getPresentationState(workspace)}
}

export function embedFrameInteropManifest(file:OfficeExportFile,workspace:WorkspaceState,kind:FrameInteropManifest['kind']):OfficeExportFile{
  const entries=storedZipEntries(file.bytes)
  const decoder=new TextDecoder()
  const contentTypesRaw=entries.get('[Content_Types].xml'),relsRaw=entries.get('_rels/.rels')
  if(!contentTypesRaw||!relsRaw)throw new Error('Office export is missing package metadata required for Frame manifest embedding')
  const contentTypes=decoder.decode(contentTypesRaw),rels=decoder.decode(relsRaw)
  entries.set('[Content_Types].xml',new TextEncoder().encode(injectBeforeClosingTag(contentTypes,'</Types>',`<Override PartName="/${FRAME_INTEROP_MANIFEST_PATH}" ContentType="${FRAME_INTEROP_CONTENT_TYPE}"/>`)))
  entries.set('_rels/.rels',new TextEncoder().encode(injectBeforeClosingTag(rels,'</Relationships>',`<Relationship Id="frameInterop" Type="${FRAME_INTEROP_RELATIONSHIP}" Target="${FRAME_INTEROP_MANIFEST_PATH}"/>`)))
  entries.set(FRAME_INTEROP_MANIFEST_PATH,new TextEncoder().encode(manifestXml(createFrameInteropManifest(workspace,kind))))
  return{...file,bytes:createStoredZip(Object.fromEntries(entries))}
}

export function exportWorkspaceOfficeSetWithManifest(workspace:WorkspaceState){
  return[
    embedFrameInteropManifest(exportWorkspaceDocx(workspace),workspace,'docx'),
    embedFrameInteropManifest(exportWorkspacePptx(workspace),workspace,'pptx'),
    embedFrameInteropManifest(exportWorkspaceXlsx(workspace),workspace,'xlsx'),
  ]
}

export async function readFrameInteropManifest(input:ArrayBuffer|Uint8Array):Promise<FrameInteropManifest|null>{
  const entries=await readOfficeZip(input),value=readOfficeXml(entries,FRAME_INTEROP_MANIFEST_PATH)
  if(!value)return null
  const payload=value.match(/<frame:payload\b[^>]*>([\s\S]*?)<\/frame:payload>/i)?.[1]
  if(!payload)return null
  let parsed:unknown
  try{parsed=JSON.parse(decodeXml(payload))}catch{throw new Error('Frame interoperability manifest contains invalid JSON payload')}
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error('Frame interoperability manifest payload must be an object')
  const manifest=parsed as Partial<FrameInteropManifest>
  if(manifest.version!==1||manifest.generator!=='Frame'||!['docx','pptx','xlsx'].includes(String(manifest.kind)))throw new Error('Unsupported Frame interoperability manifest')
  if(typeof manifest.workspaceFingerprint!=='string'||typeof manifest.workspaceTitle!=='string')throw new Error('Frame interoperability manifest is missing workspace identity metadata')
  return manifest as FrameInteropManifest
}
