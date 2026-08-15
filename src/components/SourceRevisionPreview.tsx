import { CopyCheck, FileDiff, Fingerprint, Sparkles } from 'lucide-react'
import type { PreparedOfficeImport } from '../officeImportPreparation'
import { compareSourceRevisions, summarizeSourceRevisionDiff } from '../sourceRevisionDiff'

export function SourceRevisionPreview({prepared}:{prepared:PreparedOfficeImport}){
  const previous=prepared.previousFilenameRevision
  const diff=previous?compareSourceRevisions(previous,prepared.receipt):null
  const Icon=prepared.classification==='duplicate-content'?CopyCheck:prepared.classification==='filename-revision'?FileDiff:Sparkles
  const title=prepared.classification==='duplicate-content'?'Duplicate Office content':prepared.classification==='filename-revision'?'New source revision':'New Office source'
  const detail=prepared.classification==='duplicate-content'?'Frame has seen byte-identical content before. Applying it again may duplicate a semantic projection.':diff?summarizeSourceRevisionDiff(diff):'This content hash is new to the source-revision ledger.'
  return <section className={`source-revision-preview ${prepared.classification}`}>
    <header><span className="source-revision-preview-icon"><Icon size={15}/></span><div><span>SOURCE IDENTITY</span><strong>{title}</strong></div></header>
    <p>{detail}</p>
    <div className="source-revision-preview-fingerprint"><Fingerprint size={12}/><code>{prepared.receipt.sha256}</code></div>
    <div className="source-revision-preview-facts"><Fact label="File" value={prepared.receipt.fileName}/><Fact label="Format" value={prepared.receipt.kind.toUpperCase()}/><Fact label="Size" value={`${prepared.receipt.byteLength} bytes`}/><Fact label="Items" value={prepared.receipt.importedItems}/><Fact label="Warnings" value={prepared.receipt.warningCount}/></div>
  </section>
}
function Fact({label,value}:{label:string;value:string|number}){return <div><span>{label}</span><strong>{value}</strong></div>}
