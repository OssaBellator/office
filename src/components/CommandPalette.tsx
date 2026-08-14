import { CheckCircle2, ChevronRight, Command, LayoutTemplate, RefreshCw, Sparkles, Table2 } from 'lucide-react'
import type { Surface, WorkspaceCommandPreview } from '../model'

function displayValue(value: string | number | null) {
  if (value === null) return '—'
  return String(value)
}

export function CommandPalette({
  surface,
  preview,
  onClose,
  onStageEvidence,
  onStageApproval,
  onApplyPreview,
  onCancelPreview,
  onRestore,
  onSwitch,
}: {
  surface: Surface
  preview: WorkspaceCommandPreview | null
  onClose: () => void
  onStageEvidence: () => void
  onStageApproval: () => void
  onApplyPreview: () => void
  onCancelPreview: () => void
  onRestore: () => void
  onSwitch: (surface: Surface) => void
}) {
  return (
    <div className="command-backdrop" onMouseDown={onClose}>
      <div className="command-palette" onMouseDown={(event) => event.stopPropagation()}>
        <div className="command-input-row">
          <Sparkles size={18} />
          <input autoFocus={!preview} disabled={Boolean(preview)} placeholder="Ask Frame to change, analyse, or transform…" />
          <kbd>ESC</kbd>
        </div>
        <div className="command-context">
          <span>Working in</span>
          <strong>{surface === 'docs' ? 'Strategy' : surface === 'data' ? 'Financial model' : 'Board narrative'}</strong>
        </div>

        {preview ? (
          <div className="command-preview">
            <div className="preview-heading">
              <span>PROPOSED CHANGES</span>
              <strong>{preview.event.summary}</strong>
            </div>
            <div className="preview-diffs">
              {preview.diffs.map((diff) => (
                <div className="preview-diff" key={`${diff.objectId}:${diff.field}`}>
                  <div><strong>{diff.label}</strong><span>{diff.field}</span></div>
                  <div className="preview-values">
                    <span>{displayValue(diff.before)}</span>
                    <ChevronRight size={12} />
                    <strong>{displayValue(diff.after)}</strong>
                  </div>
                </div>
              ))}
            </div>
            <div className="preview-impact">
              <span>DOWNSTREAM IMPACT</span>
              <div>
                {preview.impacts.length === 0
                  ? <small>No downstream objects</small>
                  : preview.impacts.slice(0, 5).map((impact) => <small key={impact.id}>{impact.label}</small>)}
              </div>
            </div>
            <div className="preview-actions">
              <button className="secondary-button" onClick={onCancelPreview}>Back</button>
              <button className="primary-button" onClick={onApplyPreview}>Apply changes</button>
            </div>
          </div>
        ) : (
          <div className="command-group">
            <span>SUGGESTED ACTIONS</span>
            <button onClick={onStageEvidence}><Sparkles size={16} /><div><strong>Add evidence to the strategy</strong><small>Preview a reversible semantic transaction</small></div><ChevronRight size={15} /></button>
            <button onClick={onStageApproval}><CheckCircle2 size={16} /><div><strong>Approve the APAC decision</strong><small>Preview downstream changes before applying</small></div><ChevronRight size={15} /></button>
            <button onClick={() => { onSwitch('data'); onClose() }}><Table2 size={16} /><div><strong>Open the underlying model</strong><small>Inspect data, formulas, and downstream consumers</small></div><ChevronRight size={15} /></button>
            <button onClick={() => { onSwitch('present'); onClose() }}><LayoutTemplate size={16} /><div><strong>Turn this into a board narrative</strong><small>Switch to the linked presentation view</small></div><ChevronRight size={15} /></button>
          </div>
        )}

        <div className="command-footer">
          <span><Command size={13} /> Changes are deterministic, inspectable, and undoable.</span>
          <button onClick={onRestore}><RefreshCw size={13} /> Reset demo</button>
        </div>
      </div>
    </div>
  )
}
