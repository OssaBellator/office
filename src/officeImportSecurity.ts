import { readOfficeZip } from './officeArchive.ts'

export type OfficeImportSecurityFinding={severity:'reject'|'notice';kind:'vba'|'activex'|'ole'|'external-template'|'custom-ui';part:string;detail:string}

export async function inspectOfficeImportSecurity(input:ArrayBuffer|Uint8Array):Promise<OfficeImportSecurityFinding[]>{
  const entries=await readOfficeZip(input),findings:OfficeImportSecurityFinding[]=[]
  for(const path of entries.keys()){
    const lower=path.toLowerCase()
    if(/(^|\/)vbaproject\.bin$/.test(lower)||/(^|\/)vbadata\.xml$/.test(lower))findings.push({severity:'reject',kind:'vba',part:path,detail:'VBA macro projects are not accepted by Frame Office import.'})
    else if(/(^|\/)activex\//.test(lower))findings.push({severity:'reject',kind:'activex',part:path,detail:'ActiveX controls are not accepted by Frame Office import.'})
    else if(/(^|\/)embeddings\//.test(lower)||/oleobject/i.test(lower))findings.push({severity:'notice',kind:'ole',part:path,detail:'Embedded OLE objects are not executed or imported.'})
    else if(/^customui\//.test(lower))findings.push({severity:'notice',kind:'custom-ui',part:path,detail:'Office custom ribbon/UI parts are ignored.'})
  }
  for(const path of entries.keys()){
    if(!path.endsWith('.rels'))continue
    const bytes=entries.get(path);if(!bytes?.length)continue
    const xml=new TextDecoder().decode(bytes)
    for(const match of xml.matchAll(/<Relationship\b([^>]*)\/?\s*>/gi)){
      const attrs=match[1],type=attrs.match(/(?:^|\s)Type="([^"]+)"/i)?.[1]??'',mode=attrs.match(/(?:^|\s)TargetMode="([^"]+)"/i)?.[1]??''
      if(mode.toLowerCase()==='external'&&/(attachedTemplate|externalLink|oleObject)/i.test(type))findings.push({severity:'notice',kind:'external-template',part:path,detail:'External Office relationships are not fetched or executed during import.'})
    }
  }
  return findings
}

export async function assertOfficeImportSafe(input:ArrayBuffer|Uint8Array){
  const findings=await inspectOfficeImportSecurity(input),rejected=findings.filter((finding)=>finding.severity==='reject')
  if(rejected.length)throw new Error(`Office import rejected: ${rejected.map((finding)=>`${finding.kind.toUpperCase()} part ${finding.part}`).join('; ')}. Save a macro/control-free DOCX, PPTX, or XLSX copy before importing.`)
  return findings
}
