import { CopyCheck, FileClock, Fingerprint } from 'lucide-react'
import type { SourceRevisionLedger } from '../sourceRevisionLedger'

export function SourceRevisionPanel({ledger,limit=8}:{ledger:SourceRevisionLedger;limit?:number}){
  const revisions=[...ledger.revisions].slice(-Math.max(0,limit)).reverse()
  return <section className="source-revision-panel">
    <header><div><FileClock size={14}/><div><span>SOURCE REVISIONS</span><strong>Office import identity</strong></div></div><small>{ledger.revisions.length} receipt{ledger.revisions.length===1?'':'s'}</small></header>
    {revisions.length?<div className="source-revision-list">{revisions.map((receipt)=><article key={`${receipt.sourceIdentity}:${receipt.createdAt}:${receipt.fileName}`}><span className="source-revision-icon"><Fingerprint size={12}/></span><div><strong>{receipt.fileName}</strong><span>{receipt.kind.toUpperCase()} · {receipt.importedItems} items · {receipt.warningCount} warnings</span><code title={receipt.sha256}>{receipt.sha256.slice(0,12)}…</code></div></article>)}</div>:<div className="source-revision-empty"><CopyCheck size={14}/><span>No cryptographic Office import receipts recorded yet.</span></div>}
  </section>
}
