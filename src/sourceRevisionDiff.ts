import type { OfficeImportReceipt } from './officeImportReceipt.ts'

export type SourceRevisionDiff={
  relation:'identical-content'|'same-name-revision'|'different-source'
  fileNameChanged:boolean
  kindChanged:boolean
  byteDelta:number
  importedItemDelta:number
  warningDelta:number
  commandTypeDeltas:Record<string,number>
  previousSha256:string
  nextSha256:string
}

function normalizedName(value:string){return value.trim().toLowerCase()}

export function compareSourceRevisions(previous:OfficeImportReceipt,next:OfficeImportReceipt):SourceRevisionDiff{
  const allCommandTypes=new Set([...Object.keys(previous.commandTypes),...Object.keys(next.commandTypes)])
  const commandTypeDeltas:Record<string,number>={}
  for(const type of allCommandTypes){
    const delta=(next.commandTypes[type]??0)-(previous.commandTypes[type]??0)
    if(delta!==0)commandTypeDeltas[type]=delta
  }
  const sameContent=previous.sourceIdentity===next.sourceIdentity
  const sameName=normalizedName(previous.fileName)===normalizedName(next.fileName)
  return{
    relation:sameContent?'identical-content':sameName&&previous.kind===next.kind?'same-name-revision':'different-source',
    fileNameChanged:!sameName,
    kindChanged:previous.kind!==next.kind,
    byteDelta:next.byteLength-previous.byteLength,
    importedItemDelta:next.importedItems-previous.importedItems,
    warningDelta:next.warningCount-previous.warningCount,
    commandTypeDeltas,
    previousSha256:previous.sha256,
    nextSha256:next.sha256,
  }
}

export function summarizeSourceRevisionDiff(diff:SourceRevisionDiff){
  if(diff.relation==='identical-content')return'Content is byte-identical to the prior Office import.'
  const changes=[
    diff.byteDelta?`${diff.byteDelta>0?'+':''}${diff.byteDelta} bytes`:null,
    diff.importedItemDelta?`${diff.importedItemDelta>0?'+':''}${diff.importedItemDelta} imported items`:null,
    diff.warningDelta?`${diff.warningDelta>0?'+':''}${diff.warningDelta} fidelity warnings`:null,
    ...Object.entries(diff.commandTypeDeltas).map(([type,delta])=>`${delta>0?'+':''}${delta} ${type}`),
  ].filter(Boolean)
  return changes.length?`Office source revision changes: ${changes.join(' · ')}`:'Office bytes changed, but the planned semantic shape is unchanged.'
}
