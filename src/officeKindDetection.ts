import { readOfficeXml, readOfficeZip } from './officeArchive.ts'

export type DetectedOfficeKind='docx'|'pptx'|'xlsx'
export type OfficeKindDetection={kind:DetectedOfficeKind;confidence:'strong'|'content-type';evidence:string[]}

function contentTypeKind(contentTypes:string|null):DetectedOfficeKind|null{
  if(!contentTypes)return null
  if(/wordprocessingml\.document\.main\+xml/i.test(contentTypes))return'docx'
  if(/presentationml\.presentation\.main\+xml/i.test(contentTypes))return'pptx'
  if(/spreadsheetml\.sheet\.main\+xml/i.test(contentTypes))return'xlsx'
  return null
}

export async function detectOfficePackageKind(input:ArrayBuffer|Uint8Array):Promise<OfficeKindDetection>{
  const entries=await readOfficeZip(input),evidence:string[]=[]
  const candidates=new Set<DetectedOfficeKind>()
  if(entries.has('word/document.xml')){candidates.add('docx');evidence.push('word/document.xml')}
  if(entries.has('ppt/presentation.xml')||[...entries.keys()].some((path)=>/^ppt\/slides\/slide\d+\.xml$/i.test(path))){candidates.add('pptx');evidence.push(entries.has('ppt/presentation.xml')?'ppt/presentation.xml':'ppt/slides/slide*.xml')}
  if(entries.has('xl/workbook.xml')){candidates.add('xlsx');evidence.push('xl/workbook.xml')}
  if(candidates.size===1)return{kind:[...candidates][0],confidence:'strong',evidence}
  if(candidates.size>1)throw new Error(`OOXML package is ambiguous: it contains parts for ${[...candidates].join(', ')}`)
  const byContentType=contentTypeKind(readOfficeXml(entries,'[Content_Types].xml'))
  if(byContentType)return{kind:byContentType,confidence:'content-type',evidence:['[Content_Types].xml']}
  throw new Error('ZIP package does not contain a recognizable DOCX, PPTX, or XLSX document')
}

export function officeKindFromFileName(fileName:string):DetectedOfficeKind|null{
  const extension=fileName.trim().toLowerCase().split('.').pop()
  return extension==='docx'||extension==='pptx'||extension==='xlsx'?extension:null
}

export function normalizedOfficeFileName(fileName:string,kind:DetectedOfficeKind){
  const clean=fileName.trim()||`import.${kind}`
  const current=officeKindFromFileName(clean)
  if(current===kind)return clean
  const dot=clean.lastIndexOf('.'),stem=dot>0?clean.slice(0,dot):clean
  return `${stem}.${kind}`
}
