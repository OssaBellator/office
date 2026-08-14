import { AlertTriangle, CheckCircle2, ChevronRight, GitBranch, Layers3, ShieldCheck, X } from 'lucide-react'
import type { AutomationGovernanceDecision } from '../automationGovernance'
import type { WorkspaceAutomationPlan } from '../automationPlan'

function displayValue(value: string | number | null) {
  if (value === null) return '—'
  const text = String(value).replace(/\s+/g, ' ').trim()
  return text.length > 80 ? `${text.slice(0, 77)}…` : text
}

export function BatchPreviewModal({ plan, governance, title, warnings = [], onApply, onClose }: { plan: WorkspaceAutomationPlan; governance?: AutomationGovernanceDecision; title: string; warnings?: string[]; onApply: () => void; onClose: () => void }) {
  const readinessImproved = plan.readinessAfter.errors < plan.readinessBefore.errors || plan.readinessAfter.warnings < plan.readinessBefore.warnings
  const readinessWorsened = plan.readinessAfter.errors > plan.readinessBefore.errors || plan.readinessAfter.warnings > plan.readinessBefore.warnings
  return <div className="batch-preview-backdrop" onMouseDown={onClose}>
    <section className="batch-preview" onMouseDown={(event) => event.stopPropagation()} aria-label="Semantic import preview">
      <header className="batch-preview-heading"><div><span>SEMANTIC PLAN</span><h2>{title}</h2><p>{plan.steps.length} command{plan.steps.length === 1 ? '' : 's'} will create normal versioned revisions. Nothing has been applied yet.</p></div><button className="icon-button" onClick={onClose} aria-label="Close preview"><X size={16} /></button></header>
      <div className="batch-summary-grid">
        <SummaryStat icon={Layers3} value={plan.diffs.length} label="semantic changes" />
        <SummaryStat icon={GitBranch} value={plan.impacts.length} label="downstream objects" />
        <SummaryStat icon={readinessWorsened ? AlertTriangle : CheckCircle2} value={`${plan.readinessAfter.errors}/${plan.readinessAfter.warnings}`} label="errors / warnings after" tone={readinessWorsened ? 'warning' : readinessImproved ? 'positive' : undefined} />
      </div>
      {governance && <div className={`batch-governance ${governance.risk}`}><ShieldCheck size={15} /><div><strong>{governance.risk.toUpperCase()} RISK · {governance.requiresApproval ? 'OWNER APPROVAL REQUIRED' : 'DIRECT APPLY ALLOWED'}</strong><span>{governance.reasons.length ? governance.reasons.join(' · ') : 'Plan contains only low-risk semantic mutations.'}</span></div></div>}
      {warnings.length > 0 && <div className="batch-import-warnings"><AlertTriangle size={15}/><div><strong>IMPORT FIDELITY</strong><ul>{warnings.map((warning,index)=><li key={`${index}:${warning}`}>{warning}</li>)}</ul></div></div>}
      <div className="batch-preview-body">
        <section><div className="batch-section-title"><span>CHANGES</span><small>{plan.diffs.length} total</small></div><div className="batch-diff-list">{plan.diffs.slice(0, 12).map((diff) => <div className="batch-diff" key={`${diff.objectId}:${diff.field}`}><div><strong>{diff.label}</strong><span>{diff.field}</span></div><div className="batch-diff-values"><span>{displayValue(diff.before)}</span><ChevronRight size={12} /><strong>{displayValue(diff.after)}</strong></div></div>)}{plan.diffs.length > 12 && <div className="batch-more">+ {plan.diffs.length - 12} more semantic changes</div>}</div></section>
        <section><div className="batch-section-title"><span>EXECUTION</span><small>ordered</small></div><div className="batch-step-list">{plan.steps.slice(0, 10).map((step) => <div className="batch-step" key={step.index}><span>{step.index + 1}</span><div><strong>{step.preview.event.summary}</strong><small>{step.preview.diffs.length} change{step.preview.diffs.length === 1 ? '' : 's'} · {step.preview.impacts.length} downstream</small></div></div>)}{plan.steps.length > 10 && <div className="batch-more">+ {plan.steps.length - 10} more steps</div>}</div></section>
      </div>
      <footer className="batch-preview-footer"><div><strong>Readiness</strong><span>{plan.readinessBefore.readyForReview ? 'Ready' : 'Needs review'} → {plan.readinessAfter.readyForReview ? 'Ready' : 'Needs review'}</span></div><div><button className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" onClick={onApply}>{governance?.requiresApproval ? 'Approve & apply' : 'Apply'} {plan.steps.length} changes</button></div></footer>
    </section>
  </div>
}

function SummaryStat({ icon: Icon, value, label, tone }: { icon: typeof Layers3; value: string | number; label: string; tone?: 'positive' | 'warning' }) {
  return <div className={`batch-summary-stat${tone ? ` ${tone}` : ''}`}><Icon size={15} /><div><strong>{value}</strong><span>{label}</span></div></div>
}
