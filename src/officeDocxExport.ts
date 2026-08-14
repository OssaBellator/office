import { createStoredZip, type OfficeExportFile } from './officeExportLegacy.ts'
import { formatMetric, type WorkspaceState } from './model.ts'
import { getSemanticDocument, resolveSemanticClaim } from './semanticDocument.ts'

const DOCX_MIME='application/vnd.openxmlformats-officedocument.wordprocessingml.document'
function xml(value:unknown){return String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;')}
function slug(value:string){return value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'workspace'}
function wordParagraph(text:string,options:{style?:string;numId?:number;level?:number}={}){
  const styleXml=options.style?`<w:pStyle w:val="${xml(options.style)}"/>`:''
  const numbering=options.numId?`<w:numPr><w:ilvl w:val="${options.level??0}"/><w:numId w:val="${options.numId}"/></w:numPr>`:''
  const pPr=styleXml||numbering?`<w:pPr>${styleXml}${numbering}</w:pPr>`:''
  return `<w:p>${pPr}<w:r><w:t xml:space="preserve">${xml(text)}</w:t></w:r></w:p>`
}
function wordTable(rows:string[][]){if(!rows.length)return'';return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="D9DEE7"/><w:left w:val="single" w:sz="4" w:color="D9DEE7"/><w:bottom w:val="single" w:sz="4" w:color="D9DEE7"/><w:right w:val="single" w:sz="4" w:color="D9DEE7"/><w:insideH w:val="single" w:sz="4" w:color="E4E8EE"/><w:insideV w:val="single" w:sz="4" w:color="E4E8EE"/></w:tblBorders></w:tblPr>${rows.map((row)=>`<w:tr>${row.map((cell)=>`<w:tc><w:tcPr><w:tcW w:w="2400" w:type="dxa"/></w:tcPr>${wordParagraph(cell)}</w:tc>`).join('')}</w:tr>`).join('')}</w:tbl>`}

function body(workspace:WorkspaceState){
  const semantic=getSemanticDocument(workspace),parts:string[]=[wordParagraph(workspace.document.title,{style:'Title'}),wordParagraph(workspace.document.summary,{style:'Subtitle'})]
  for(const block of semantic.blocks){
    if(block.type==='paragraph'){
      const style=block.style==='heading-1'?'Heading1':block.style==='heading-2'?'Heading2':block.style==='heading-3'?'Heading3':undefined
      const numId=block.style==='bullet'?1:block.style==='numbered'?2:undefined
      parts.push(wordParagraph(block.text,{style,numId}))
      if(block.source)parts.push(wordParagraph(`Imported from ${block.source}`,{style:'Caption'}))
    }
    if(block.type==='claim'){
      const claim=semantic.claims.find((item)=>item.id===block.claimId)
      if(claim){
        const resolved=resolveSemanticClaim(workspace,claim.id)
        parts.push(wordParagraph('Evidence claim',{style:'Heading2'}),wordParagraph(`${claim.statement} [${resolved.status}]`),wordParagraph(claim.rationale))
        for(const citationId of claim.citationIds){const citation=semantic.citations.find((item)=>item.id===citationId);if(citation)parts.push(wordParagraph(`Source: ${citation.label} — ${citation.locator}`,{style:'Caption'}))}
      }
    }
    if(block.type==='metric-embed'){
      const rows=[['Metric','Value','Definition'],...block.metricIds.flatMap((id)=>{const metric=workspace.metrics.find((item)=>item.id===id);return metric?[[metric.label,formatMetric(metric),metric.formula??'Manual']]:[]})]
      parts.push(wordParagraph(block.label,{style:'Heading2'}),wordTable(rows))
    }
    if(block.type==='decision-embed'){
      const decision=workspace.decisions.find((item)=>item.id===block.decisionId)
      if(decision)parts.push(wordParagraph('Decision',{style:'Heading2'}),wordParagraph(`${decision.title} — ${decision.status}`),wordParagraph(decision.rationale),wordParagraph(`Owner: ${decision.owner}`,{style:'Caption'}))
    }
    const reviews=semantic.annotations.filter((annotation)=>annotation.blockId===block.id)
    if(reviews.length){
      parts.push(wordParagraph('Review',{style:'Heading3'}))
      for(const review of reviews)parts.push(wordParagraph(`${review.kind.toUpperCase()} · ${review.owner} · ${review.status}: ${review.body}`))
    }
  }
  return parts.join('')
}

const styles='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:sz w:val="36"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:rPr><w:color w:val="667085"/><w:sz w:val="22"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:sz w:val="30"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:sz w:val="26"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:sz w:val="22"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Caption"><w:name w:val="caption"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:rPr><w:i/><w:color w:val="7A8492"/><w:sz w:val="18"/></w:rPr></w:style></w:styles>'
const numbering='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="720"/></w:tabs><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum><w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="720"/></w:tabs><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num><w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num></w:numbering>'

export function exportWorkspaceDocxRich(workspace:WorkspaceState):OfficeExportFile{
  const contentTypes='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>'
  const rels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'
  const document=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body(workspace)}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`
  const documentRels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>'
  return{filename:`frame-${slug(workspace.title)}.docx`,mimeType:DOCX_MIME,bytes:createStoredZip({'[Content_Types].xml':contentTypes,'_rels/.rels':rels,'word/document.xml':document,'word/_rels/document.xml.rels':documentRels,'word/styles.xml':styles,'word/numbering.xml':numbering})}
}
