import { formatMetric, type WorkspaceState } from './model.ts'
import { getImportedTables, type ImportedDataTable } from './importedTables.ts'
import { buildPresentationScenes } from './presentationModel.ts'
import { getSemanticDocument, resolveSemanticClaim } from './semanticDocument.ts'

export type OfficeExportFile = { filename:string; mimeType:string; bytes:Uint8Array }

const DOCX_MIME='application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const PPTX_MIME='application/vnd.openxmlformats-officedocument.presentationml.presentation'
const XLSX_MIME='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const encoder=new TextEncoder()

function xml(value:unknown){return String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;')}
function slug(value:string){return value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'workspace'}
function u16(value:number){return [value&255,(value>>>8)&255]}
function u32(value:number){return [value&255,(value>>>8)&255,(value>>>16)&255,(value>>>24)&255]}

let crcTable:Uint32Array|undefined
function crc32(bytes:Uint8Array){
  if(!crcTable){crcTable=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;crcTable[n]=c>>>0}}
  let crc=0xffffffff
  for(const byte of bytes)crc=crcTable[(crc^byte)&255]^(crc>>>8)
  return (crc^0xffffffff)>>>0
}

export function createStoredZip(files:Record<string,string|Uint8Array>):Uint8Array{
  const locals:Uint8Array[]=[],centrals:Uint8Array[]=[]
  let offset=0
  for(const [name,value] of Object.entries(files)){
    const nameBytes=encoder.encode(name),data=typeof value==='string'?encoder.encode(value):value,checksum=crc32(data),flags=0x0800
    const local=Uint8Array.from([...u32(0x04034b50),...u16(20),...u16(flags),...u16(0),...u16(0),...u16(0),...u32(checksum),...u32(data.length),...u32(data.length),...u16(nameBytes.length),...u16(0),...nameBytes,...data])
    const central=Uint8Array.from([...u32(0x02014b50),...u16(20),...u16(20),...u16(flags),...u16(0),...u16(0),...u16(0),...u32(checksum),...u32(data.length),...u32(data.length),...u16(nameBytes.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(offset),...nameBytes])
    locals.push(local);centrals.push(central);offset+=local.length
  }
  const centralSize=centrals.reduce((sum,item)=>sum+item.length,0)
  const end=Uint8Array.from([...u32(0x06054b50),...u16(0),...u16(0),...u16(centrals.length),...u16(centrals.length),...u32(centralSize),...u32(offset),...u16(0)])
  const result=new Uint8Array(offset+centralSize+end.length);let cursor=0
  for(const part of [...locals,...centrals,end]){result.set(part,cursor);cursor+=part.length}
  return result
}

function wordParagraph(text:string,style?:string){const styleXml=style?`<w:pPr><w:pStyle w:val="${xml(style)}"/></w:pPr>`:'';return `<w:p>${styleXml}<w:r><w:t xml:space="preserve">${xml(text)}</w:t></w:r></w:p>`}
function wordTable(rows:string[][]){if(!rows.length)return'';return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="D9DEE7"/><w:left w:val="single" w:sz="4" w:color="D9DEE7"/><w:bottom w:val="single" w:sz="4" w:color="D9DEE7"/><w:right w:val="single" w:sz="4" w:color="D9DEE7"/><w:insideH w:val="single" w:sz="4" w:color="E4E8EE"/><w:insideV w:val="single" w:sz="4" w:color="E4E8EE"/></w:tblBorders></w:tblPr>${rows.map((row)=>`<w:tr>${row.map((cell)=>`<w:tc><w:tcPr><w:tcW w:w="2400" w:type="dxa"/></w:tcPr>${wordParagraph(cell)}</w:tc>`).join('')}</w:tr>`).join('')}</w:tbl>`}

function docxBody(workspace:WorkspaceState){
  const semantic=getSemanticDocument(workspace),parts:string[]=[wordParagraph(workspace.document.title,'Title'),wordParagraph(workspace.document.summary,'Subtitle')]
  let numbered=0
  for(const block of semantic.blocks){
    if(block.type==='paragraph'){
      const style=block.style==='heading-1'?'Heading1':block.style==='heading-2'?'Heading2':block.style==='heading-3'?'Heading3':undefined
      const prefix=block.style==='bullet'?'• ':block.style==='numbered'?`${++numbered}. `:''
      parts.push(wordParagraph(`${prefix}${block.text}`,style))
      if(block.source)parts.push(wordParagraph(`Imported from ${block.source}`,'Caption'))
    }
    if(block.type==='claim'){
      const claim=semantic.claims.find((item)=>item.id===block.claimId)
      if(claim){const resolved=resolveSemanticClaim(workspace,claim.id);parts.push(wordParagraph('Evidence claim','Heading2'),wordParagraph(`${claim.statement} [${resolved.status}]`),wordParagraph(claim.rationale));for(const citationId of claim.citationIds){const citation=semantic.citations.find((item)=>item.id===citationId);if(citation)parts.push(wordParagraph(`Source: ${citation.label} — ${citation.locator}`,'Caption'))}}
    }
    if(block.type==='metric-embed'){
      const rows=[['Metric','Value','Definition'],...block.metricIds.flatMap((id)=>{const metric=workspace.metrics.find((item)=>item.id===id);return metric?[[metric.label,formatMetric(metric),metric.formula??'Manual']]:[]})]
      parts.push(wordParagraph(block.label,'Heading2'),wordTable(rows))
    }
    if(block.type==='decision-embed'){
      const decision=workspace.decisions.find((item)=>item.id===block.decisionId)
      if(decision)parts.push(wordParagraph('Decision','Heading2'),wordParagraph(`${decision.title} — ${decision.status}`),wordParagraph(decision.rationale),wordParagraph(`Owner: ${decision.owner}`,'Caption'))
    }
  }
  return parts.join('')
}

export function exportWorkspaceDocx(workspace:WorkspaceState):OfficeExportFile{
  const contentTypes='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>'
  const rels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'
  const document=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${docxBody(workspace)}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`
  const documentRels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'
  const styles='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:sz w:val="36"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:rPr><w:color w:val="667085"/><w:sz w:val="22"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:sz w:val="30"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:sz w:val="26"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:sz w:val="22"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Caption"><w:name w:val="caption"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:rPr><w:i/><w:color w:val="7A8492"/><w:sz w:val="18"/></w:rPr></w:style></w:styles>'
  return{filename:`frame-${slug(workspace.title)}.docx`,mimeType:DOCX_MIME,bytes:createStoredZip({'[Content_Types].xml':contentTypes,'_rels/.rels':rels,'word/document.xml':document,'word/_rels/document.xml.rels':documentRels,'word/styles.xml':styles})}
}

function cellReference(column:number,row:number){let n=column+1,letters='';while(n){const r=(n-1)%26;letters=String.fromCharCode(65+r)+letters;n=Math.floor((n-1)/26)}return`${letters}${row}`}
function sheetXml(rows:Array<Array<string|number|null>>){return`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map((row,rowIndex)=>`<row r="${rowIndex+1}">${row.map((value,columnIndex)=>{if(value===null||value===undefined)return'';const ref=cellReference(columnIndex,rowIndex+1);return typeof value==='number'&&Number.isFinite(value)?`<c r="${ref}"><v>${value}</v></c>`:`<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`}).join('')}</row>`).join('')}</sheetData></worksheet>`}
function importedRows(table:ImportedDataTable):Array<Array<string|number|null>>{return[table.columns.map((column)=>column.label),...table.rows.map((row)=>table.columns.map((column)=>row.values[column.id]??null))]}

export function exportWorkspaceXlsx(workspace:WorkspaceState):OfficeExportFile{
  const tables=[
    {name:'Regions',rows:[['Region','Revenue','Growth','Margin'],...workspace.regions.map((row)=>[row.region,row.revenue,row.growth,row.margin] as Array<string|number|null>)]},
    {name:'Plan',rows:[['Region','Revenue'],...workspace.plans.map((row)=>[row.region,row.revenue] as Array<string|number|null>)]},
    ...getImportedTables(workspace).map((table)=>({name:table.label,rows:importedRows(table)})),
  ]
  const uniqueNames:string[]=[]
  for(const table of tables){let base=table.name.replace(/[\\/*?:[\]]/g,' ').trim().slice(0,31)||'Sheet',name=base,index=2;while(uniqueNames.includes(name)){const suffix=` ${index++}`;name=`${base.slice(0,31-suffix.length)}${suffix}`}uniqueNames.push(name)}
  const overrides=tables.map((_,index)=>`<Override PartName="/xl/worksheets/sheet${index+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')
  const contentTypes=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${overrides}</Types>`
  const rootRels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'
  const workbook=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${uniqueNames.map((name,index)=>`<sheet name="${xml(name)}" sheetId="${index+1}" r:id="rId${index+1}"/>`).join('')}</sheets></workbook>`
  const workbookRels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${tables.map((_,index)=>`<Relationship Id="rId${index+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index+1}.xml"/>`).join('')}</Relationships>`
  const files:Record<string,string>={'[Content_Types].xml':contentTypes,'_rels/.rels':rootRels,'xl/workbook.xml':workbook,'xl/_rels/workbook.xml.rels':workbookRels}
  tables.forEach((table,index)=>{files[`xl/worksheets/sheet${index+1}.xml`]=sheetXml(table.rows)})
  return{filename:`frame-${slug(workspace.title)}.xlsx`,mimeType:XLSX_MIME,bytes:createStoredZip(files)}
}

function pptTextBox(id:number,name:string,text:string,x:number,y:number,cx:number,cy:number,fontSize=2400,bold=false){return`<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${xml(name)}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square"/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" sz="${fontSize}"${bold?' b="1"':''}/><a:t>${xml(text)}</a:t></a:r><a:endParaRPr lang="en-US" sz="${fontSize}"/></a:p></p:txBody></p:sp>`}
function slideXml(title:string,body:string[]){const bodyText=body.join('\n');return`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${pptTextBox(2,'Title',title,685800,457200,7772400,1143000,3000,true)}${bodyText?pptTextBox(3,'Body',bodyText,685800,1828800,7772400,4114800,1800,false):''}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`}
const blankLayout='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1"><p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>'
const slideMaster='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMap accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" bg1="lt1" bg2="lt2" folHlink="folHlink" hlink="hlink" tx1="dk1" tx2="dk2"/><p:sldLayoutIdLst><p:sldLayoutId id="1" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>'
const theme='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Frame"><a:themeElements><a:clrScheme name="Frame"><a:dk1><a:srgbClr val="111827"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="374151"/></a:dk2><a:lt2><a:srgbClr val="F3F4F6"/></a:lt2><a:accent1><a:srgbClr val="4F46E5"/></a:accent1><a:accent2><a:srgbClr val="0F766E"/></a:accent2><a:accent3><a:srgbClr val="B45309"/></a:accent3><a:accent4><a:srgbClr val="BE123C"/></a:accent4><a:accent5><a:srgbClr val="7C3AED"/></a:accent5><a:accent6><a:srgbClr val="0369A1"/></a:accent6><a:hlink><a:srgbClr val="2563EB"/></a:hlink><a:folHlink><a:srgbClr val="7C3AED"/></a:folHlink></a:clrScheme><a:fontScheme name="Frame"><a:majorFont><a:latin typeface="Aptos Display"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Aptos"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="Frame"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>'

export function exportWorkspacePptx(workspace:WorkspaceState):OfficeExportFile{
  const scenes=buildPresentationScenes(workspace)
  const slideOverrides=scenes.map((_,index)=>`<Override PartName="/ppt/slides/slide${index+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('')
  const contentTypes=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>${slideOverrides}</Types>`
  const rootRels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>'
  const presentation=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${scenes.map((_,index)=>`<p:sldId id="${256+index}" r:id="rId${index+2}"/>`).join('')}</p:sldIdLst><p:sldSz cx="9144000" cy="5143500" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/><p:defaultTextStyle/></p:presentation>`
  const presentationRels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>${scenes.map((_,index)=>`<Relationship Id="rId${index+2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${index+1}.xml"/>`).join('')}</Relationships>`
  const masterRels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>'
  const layoutRels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>'
  const files:Record<string,string>={'[Content_Types].xml':contentTypes,'_rels/.rels':rootRels,'ppt/presentation.xml':presentation,'ppt/_rels/presentation.xml.rels':presentationRels,'ppt/slideMasters/slideMaster1.xml':slideMaster,'ppt/slideMasters/_rels/slideMaster1.xml.rels':masterRels,'ppt/slideLayouts/slideLayout1.xml':blankLayout,'ppt/slideLayouts/_rels/slideLayout1.xml.rels':layoutRels,'ppt/theme/theme1.xml':theme}
  scenes.forEach((scene,index)=>{files[`ppt/slides/slide${index+1}.xml`]=slideXml(scene.title,[...(scene.body??[]),scene.note?`Speaker note: ${scene.note}`:'',`Source: ${scene.source}`].filter(Boolean));files[`ppt/slides/_rels/slide${index+1}.xml.rels`]='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>'})
  return{filename:`frame-${slug(workspace.title)}.pptx`,mimeType:PPTX_MIME,bytes:createStoredZip(files)}
}
