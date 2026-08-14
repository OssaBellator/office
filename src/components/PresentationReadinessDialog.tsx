import { AlertTriangle, CheckCircle2, Presentation, ShieldAlert, X } from 'lucide-react'
import type { WorkspaceReadiness } from '../workspaceDiagnostics'
import type { DocumentReviewGate } from '../reviewWorkflow'

export function PresentationReadinessDialog({ readiness, reviewGate, onClose, onOpenContext, onPresentAnyway }: {
  readiness: WorkspaceReadiness
  reviewGate: DocumentReviewGate
  onClose: () => void
  onOpenContext: () => void
  onPresentAnyway: () => void
}) {
  const blockers = [
    ...readiness.diagnostics.filter((item) => item.severity === 'error').map((item) => item.message),
    ...reviewGate.blockers.filter((message) => !readiness.diagnostics.some((item) => item.message.includes(message))),
  ]
  const warnings = [
    ...readiness.diagnostics.filter((item) => item.severity === 'warning').map((item) => item.message),
    ...reviewGate.warnings,
  ]
  return <div className="readiness-gate-backdrop" onMouseDown={onClose}>
    <section className="readiness-gate" onMouseDown={(event) => event.stopPropagation()} aria-label="Presentation readiness">
      <header><div className="readiness-gate-icon"><ShieldAlert size={19} /></div><div><span>REVIEW GATE</span><h2>Board narrative is not review-ready yet</h2><p>Frame found semantic issues that may make the presentation misleading or incomplete. You can address them first or explicitly continue.</p></div><button className="icon-button" onClick={onClose} aria-label="Close readiness gate"><X size={16} /></button></header>
      <div className="readiness-gate-summary"><div><strong>{blockers.length}</strong><span>blocker{blockers.length === 1 ? '' : 's'}</span></div><div><strong>{warnings.length}</strong><span>warning{warnings.length === 1 ? '' : 's'}</span></div><div><strong>{readiness.openApprovals}</strong><span>pending approval{readiness.openApprovals === 1 ? '' : 's'}</span></div></div>
      <div className="readiness-gate-list">
        {blockers.map((message, index) => <div className="readiness-gate-item blocker" key={`b:${index}`}><AlertTriangle size={14} /><div><strong>Blocker</strong><span>{message}</span></div></div>)}
        {warnings.map((message, index) => <div className="readiness-gate-item warning" key={`w:${index}`}><AlertTriangle size={14} /><div><strong>Warning</strong><span>{message}</span></div></div>)}
        {!blockers.length && !warnings.length && <div className="readiness-gate-item ready"><CheckCircle2 size={14} /><div><strong>Ready</strong><span>No review blockers remain.</span></div></div>}
      </div>
      <footer><button className="secondary-button" onClick={onOpenContext}>Open review context</button><button className="primary-button" onClick={onPresentAnyway}><Presentation size={14} /> Present anyway</button></footer>
    </section>
  </div>
}
