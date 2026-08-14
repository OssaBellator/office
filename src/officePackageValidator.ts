import { readOfficeXml, readOfficeZip } from './officeArchive.ts'
import { resolvePackagePath } from './officeParsers.ts'

export type OfficePackageIssue={kind:'missing-content-type'|'missing-relationship-target'|'duplicate-relationship-id'|'missing-package-part'|'invalid-package-path';part:string;detail:string}
export type OfficePackageValidation={valid:boolean;issues:OfficePackageIssue[];partCount:number;relationshipCount:number}

function attribute(fragment:string,name:string){return fragment.match(new RegExp(`(?:^|\\s)(?:[\\w.-]+:)?${name}="([^"]*)"`,'i'))?.[1]}
function sourcePartForRels(path:string){
  if(path==='_rels/.rels')return''
  const match=path.match(/^(.*\/)?_rels\/([^/]+)\.rels$/)
  if(!match)return null
  return `${match[1]??''}${match[2]}`
}
function extension(path:string){const name=path.split('/').at(-1)??'',index=name.lastIndexOf('.');return index>=0?name.slice(index+1).toLowerCase():''}
function normalizeTarget(sourcePart:string,target:string){return resolvePackagePath(sourcePart||'__root__',target).replace(/^__root__\/?/,'')}

export async function validateOfficePackage(input:ArrayBuffer|Uint8Array):Promise<OfficePackageValidation>{
  const entries=await readOfficeZip(input),issues:OfficePackageIssue[]=[]
  const contentTypes=readOfficeXml(entries,'[Content_Types].xml')
  if(!contentTypes)issues.push({kind:'missing-package-part',part:'[Content_Types].xml',detail:'OOXML package is missing [Content_Types].xml'})
  const defaults=new Set<string>(),overrides=new Set<string>()
  if(contentTypes){
    for(const match of contentTypes.matchAll(/<(?:\w+:)?Default\b([^>]*)\/?\s*>/gi)){const ext=attribute(match[1],'Extension')?.toLowerCase();if(ext)defaults.add(ext)}
    for(const match of contentTypes.matchAll(/<(?:\w+:)?Override\b([^>]*)\/?\s*>/gi)){const part=attribute(match[1],'PartName')?.replace(/^\//,'');if(part)overrides.add(part)}
  }
  for(const path of entries.keys()){
    if(path==='[Content_Types].xml')continue
    if(path.startsWith('/')||path.split('/').some((segment)=>segment==='..'))issues.push({kind:'invalid-package-path',part:path,detail:'Package part path is absolute or contains parent traversal'})
    if(contentTypes&&!overrides.has(path)&&!defaults.has(extension(path)))issues.push({kind:'missing-content-type',part:path,detail:`No content type Override or Default covers ${path}`})
  }

  let relationshipCount=0
  for(const path of entries.keys()){
    if(!path.endsWith('.rels'))continue
    const rels=readOfficeXml(entries,path);if(!rels)continue
    const sourcePart=sourcePartForRels(path)
    if(sourcePart===null)continue
    const ids=new Set<string>()
    for(const match of rels.matchAll(/<(?:\w+:)?Relationship\b([^>]*)\/?\s*>/gi)){
      relationshipCount+=1
      const id=attribute(match[1],'Id')??'',target=attribute(match[1],'Target')??'',targetMode=attribute(match[1],'TargetMode')??''
      if(id&&ids.has(id))issues.push({kind:'duplicate-relationship-id',part:path,detail:`Relationship ${id} is declared more than once`})
      if(id)ids.add(id)
      if(!target||targetMode.toLowerCase()==='external')continue
      const resolved=normalizeTarget(sourcePart,target)
      if(!entries.has(resolved))issues.push({kind:'missing-relationship-target',part:path,detail:`${id||'relationship'} targets missing part ${resolved}`})
    }
  }
  return{valid:issues.length===0,issues,partCount:entries.size,relationshipCount}
}
