import { readOfficeXml, readOfficeZip } from './officeArchive.ts'
import { parsePackageRelationships, resolvePackagePath } from './officeParsers.ts'

export type XlsxNoteValidationIssue={sheetPath:string;kind:'missing-comments-part'|'missing-vml-part'|'missing-legacy-drawing'|'comment-shape-count-mismatch'|'invalid-comment-ref';detail:string}
export type XlsxNoteValidation={valid:boolean;noteSheets:number;comments:number;shapes:number;issues:XlsxNoteValidationIssue[]}

function relationshipsPath(sheetPath:string){const parts=sheetPath.split('/'),name=parts.pop()!;return[...parts,'_rels',`${name}.rels`].join('/')}
function relationshipBySuffix(xml:string|null,suffix:string){for(const relationship of parsePackageRelationships(xml).values())if(relationship.type.endsWith(`/${suffix}`))return relationship;return null}
function count(xml:string|null,pattern:RegExp){return xml?[...xml.matchAll(pattern)].length:0}

/** Checks the internal classic-note contract beyond generic OPC target validation. */
export async function validateXlsxClassicNotes(input:ArrayBuffer|Uint8Array):Promise<XlsxNoteValidation>{
  const entries=await readOfficeZip(input),issues:XlsxNoteValidationIssue[]=[]
  let noteSheets=0,comments=0,shapes=0
  for(const sheetPath of [...entries.keys()].filter((path)=>/^xl\/worksheets\/[^/]+\.xml$/i.test(path))){
    const sheet=readOfficeXml(entries,sheetPath),relsXml=readOfficeXml(entries,relationshipsPath(sheetPath)),commentsRel=relationshipBySuffix(relsXml,'comments'),vmlRel=relationshipBySuffix(relsXml,'vmlDrawing')
    if(!commentsRel&&!vmlRel&&!/<legacyDrawing\b/i.test(sheet??''))continue
    noteSheets+=1
    if(!commentsRel){issues.push({sheetPath,kind:'missing-comments-part',detail:'Worksheet note markup has no comments relationship.'});continue}
    if(!vmlRel){issues.push({sheetPath,kind:'missing-vml-part',detail:'Worksheet comments have no VML drawing relationship.'});continue}
    const commentsPath=resolvePackagePath(sheetPath,commentsRel.target),vmlPath=resolvePackagePath(sheetPath,vmlRel.target),commentsXml=readOfficeXml(entries,commentsPath),vmlBytes=entries.get(vmlPath),vmlXml=vmlBytes?new TextDecoder().decode(vmlBytes):null
    if(!commentsXml){issues.push({sheetPath,kind:'missing-comments-part',detail:`Comments part ${commentsPath} is missing.`});continue}
    if(!vmlXml){issues.push({sheetPath,kind:'missing-vml-part',detail:`VML note drawing ${vmlPath} is missing.`});continue}
    if(!/<legacyDrawing\b[^>]*r:id="[^"]+"/i.test(sheet??''))issues.push({sheetPath,kind:'missing-legacy-drawing',detail:'Worksheet lacks a legacyDrawing reference for its VML note drawing.'})
    const refs=[...commentsXml.matchAll(/<comment\b[^>]*\bref="([^"]+)"/gi)].map((match)=>match[1])
    comments+=refs.length
    const invalid=refs.filter((ref)=>!/^\$?[A-Z]+\$?\d+$/i.test(ref));for(const ref of invalid)issues.push({sheetPath,kind:'invalid-comment-ref',detail:`Comment reference ${ref} is not a single A1 cell.`})
    const shapeCount=count(vmlXml,/<v:shape\b[^>]*\btype="#_x0000_t202"/gi);shapes+=shapeCount
    if(shapeCount!==refs.length)issues.push({sheetPath,kind:'comment-shape-count-mismatch',detail:`Comments part has ${refs.length} comments but VML drawing has ${shapeCount} note shapes.`})
  }
  return{valid:issues.length===0,noteSheets,comments,shapes,issues}
}
