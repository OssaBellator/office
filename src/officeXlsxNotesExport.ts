import { getImportedTables, importedTableCellKey, type ImportedCellComment, type ImportedDataTable } from './importedTables.ts'
import type { WorkspaceState } from './model.ts'
import { readOfficeZip } from './officeArchive.ts'
import { createStoredZip, exportWorkspaceXlsx, type OfficeExportFile } from './officeExport.ts'

function xml(value:unknown){return String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;')}
function columnLetters(index:number){let value=index+1,result='';while(value){const remainder=(value-1)%26;result=String.fromCharCode(65+remainder)+result;value=Math.floor((value-1)/26)}return result}
function commentCells(table:ImportedDataTable){
  const cells:Array<{ref:string;row:number;column:number;comment:ImportedCellComment}>=[]
  table.rows.forEach((row,rowIndex)=>table.columns.forEach((column,columnIndex)=>{const comment=table.commentByCell?.[importedTableCellKey(row.id,column.id)];if(comment)cells.push({ref:`${columnLetters(columnIndex)}${rowIndex+2}`,row:rowIndex+1,column:columnIndex,comment})}))
  return cells
}
function commentsXml(cells:ReturnType<typeof commentCells>){
  const authors=[...new Set(cells.map((cell)=>cell.comment.author?.trim()||'Frame import'))]
  const authorId=new Map(authors.map((author,index)=>[author,index]))
  return`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><comments xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><authors>${authors.map((author)=>`<author>${xml(author)}</author>`).join('')}</authors><commentList>${cells.map((cell)=>{const author=cell.comment.author?.trim()||'Frame import';return`<comment ref="${cell.ref}" authorId="${authorId.get(author)}"><text><r><t xml:space="preserve">${xml(cell.comment.text)}</t></r></text></comment>`}).join('')}</commentList></comments>`
}
function vmlXml(cells:ReturnType<typeof commentCells>){
  return`<?xml version="1.0" encoding="UTF-8"?><xml xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><o:shapelayout v:ext="edit"><o:idmap v:ext="edit" data="1"/></o:shapelayout><v:shapetype id="_x0000_t202" coordsize="21600,21600" o:spt="202" path="m,l,21600r21600,l21600,xe"><v:stroke joinstyle="miter"/><v:path gradientshapeok="t" o:connecttype="rect"/></v:shapetype>${cells.map((cell,index)=>`<v:shape id="_x0000_s${1025+index}" type="#_x0000_t202" style="position:absolute;margin-left:80pt;margin-top:5pt;width:108pt;height:59.25pt;z-index:${index+1};visibility:hidden" fillcolor="#ffffe1" o:insetmode="auto"><v:fill color2="#ffffe1"/><v:shadow on="t" color="black" obscured="t"/><v:path o:connecttype="none"/><v:textbox style="mso-direction-alt:auto"><div style="text-align:left"/></v:textbox><x:ClientData ObjectType="Note"><x:MoveWithCells/><x:SizeWithCells/><x:Anchor>1, 15, 0, 2, 3, 15, 4, 4</x:Anchor><x:AutoFill>False</x:AutoFill><x:Row>${cell.row}</x:Row><x:Column>${cell.column}</x:Column></x:ClientData></v:shape>`).join('')}</xml>`
}
function nextRelationshipIds(xmlText:string|null){
  const used=new Set([...(xmlText??'').matchAll(/\bId="(rId\d+)"/g)].map((match)=>match[1]))
  let index=1
  const take=()=>{while(used.has(`rId${index}`))index+=1;const id=`rId${index++}`;used.add(id);return id}
  return{comments:take(),vml:take()}
}
function relationshipsXml(existing:string|null,commentsId:string,vmlId:string,commentIndex:number){
  const additions=`<Relationship Id="${commentsId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="../comments${commentIndex}.xml"/><Relationship Id="${vmlId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/vmlDrawing" Target="../drawings/vmlDrawing${commentIndex}.vml"/>`
  if(existing&&/<\/Relationships>\s*$/i.test(existing))return existing.replace(/<\/Relationships>\s*$/i,`${additions}</Relationships>`)
  return`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${additions}</Relationships>`
}
function addLegacyDrawing(sheetXml:string,relationshipId:string){
  if(/<legacyDrawing\b/i.test(sheetXml))return sheetXml
  return sheetXml.replace(/<\/worksheet>\s*$/i,`<legacyDrawing r:id="${relationshipId}"/></worksheet>`)
}
function addContentTypes(contentTypes:string,commentIndexes:number[]){
  let next=contentTypes
  if(!/<Default\b[^>]*Extension="vml"/i.test(next))next=next.replace(/<\/Types>\s*$/i,'<Default Extension="vml" ContentType="application/vnd.openxmlformats-officedocument.vmlDrawing"/></Types>')
  for(const index of commentIndexes){const part=`/xl/comments${index}.xml`;if(!next.includes(`PartName="${part}"`))next=next.replace(/<\/Types>\s*$/i,`<Override PartName="${part}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.comments+xml"/></Types>`)}
  return next
}

/**
 * Experimental compatibility projection that re-emits classic Excel notes.
 * Keep this opt-in until generated VML/comments parts are smoke-tested in current Excel.
 */
export async function exportWorkspaceXlsxWithClassicNotes(workspace:WorkspaceState):Promise<OfficeExportFile>{
  const base=exportWorkspaceXlsx(workspace),entries=await readOfficeZip(base.bytes),files:Record<string,string|Uint8Array>={}
  for(const [path,bytes] of entries)files[path]=bytes
  const imported=getImportedTables(workspace),commentIndexes:number[]=[]
  imported.forEach((table,tableIndex)=>{
    const cells=commentCells(table);if(!cells.length)return
    const sheetNumber=tableIndex+3,commentIndex=tableIndex+1,sheetPath=`xl/worksheets/sheet${sheetNumber}.xml`,relsPath=`xl/worksheets/_rels/sheet${sheetNumber}.xml.rels`
    const sheetBytes=entries.get(sheetPath);if(!sheetBytes)return
    const sheet=new TextDecoder().decode(sheetBytes),existingRels=entries.get(relsPath)?new TextDecoder().decode(entries.get(relsPath)):null,ids=nextRelationshipIds(existingRels)
    files[sheetPath]=addLegacyDrawing(sheet,ids.vml)
    files[relsPath]=relationshipsXml(existingRels,ids.comments,ids.vml,commentIndex)
    files[`xl/comments${commentIndex}.xml`]=commentsXml(cells)
    files[`xl/drawings/vmlDrawing${commentIndex}.vml`]=vmlXml(cells)
    commentIndexes.push(commentIndex)
  })
  const contentTypes=new TextDecoder().decode(entries.get('[Content_Types].xml')??new Uint8Array())
  files['[Content_Types].xml']=addContentTypes(contentTypes,commentIndexes)
  return{...base,filename:base.filename.replace(/\.xlsx$/i,'-with-notes.xlsx'),bytes:createStoredZip(files)}
}
