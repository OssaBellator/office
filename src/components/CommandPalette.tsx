import { CheckCircle2, ChevronRight, Command, LayoutTemplate, RefreshCw, Sparkles, Table2 } from 'lucide-react'
import type { Surface } from '../model'

export function CommandPalette({
  surface,
  onClose,
  onAddEvidence,
  onApprove,
  onRestore,
  onSwitch,
}: {
  surface: Surface
  onClose: () => void
  onAddEvidence: () => void
  onApprove: () => void
  onRestore: () => void
  onSwitch: (surface: Surface) => void
}) {
  return (
    <div className="command-backdrop" onMouseDown={onClose}>
      <div className="command-palette" onMouseDown={(event) => event.stopPropagation()}>
        <div className="command-input-row">
          <Sparkles size={18} />
          <input autoFocus placeholder="Ask Frame to change, analyse, or transform…" />
          <kbd>ESC</kbd>
        </div>
        <div className="command-context">
          <span>Working in</span>
          <strong>{surface === 'docs' ? 'Strategy' : surface === 'data' ? 'Financial model' : 'Board narrative'}</strong>
        </div>
        <div className="command-group">
          <span>SUGGESTED ACTIONS</span>
          <button onClick={onAddEvidence}><Sparkles size={16} /><div><strong>Add evidence to the strategy</strong><small>Creates one reversible semantic transaction</small></div><ChevronRight size={15} /></button>
          <button onClick={onApprove}><CheckCircle2 size={16} /><div><strong>Approve the APAC decision</strong><small>Updates the shared decision object everywhere</small></div><ChevronRight size={15} /></button>
          <button onClick={() => { onSwitch('data'); onClose() }}><Table2 size={16} /><div><strong>Open the underlying model</strong><small>Inspect data, formulas, and downstream consumers</small></div><ChevronRight size={15} /></button>
          <button onClick={() => { onSwitch('present'); onClose() }}><LayoutTemplate size={16} /><div><strong>Turn this into a board narrative</strong><small>Switch to the linked presentation view</small></div><ChevronRight size={15} /></button>
        </div>
        <div className="command-footer">
          <span><Command size={13} /> Changes are deterministic and undoable.</span>
          <button onClick={onRestore}><RefreshCw size={13} /> Reset demo</button>
        </div>
      </div>
    </div>
  )
}
