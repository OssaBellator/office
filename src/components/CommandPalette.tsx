import { useMemo, useState } from 'react'
import { CheckCircle2, ChevronRight, Command, LayoutTemplate, RefreshCw, Sparkles, Table2 } from 'lucide-react'
import type { Surface, WorkspaceState } from '../model'
import type { VersionedCommandPreview } from '../semanticPreview'
import { resolveUniversalQuery } from '../universalQuery'

function displayValue(value: string | number | null) {
  if (value === null) return '—'
  const text = String(value).replace(/\s+/g, ' ').trim()
  return text.length > 70 ? `${text.slice(0, 67)}…` : text
}

function shortText(value: string) {
  const text = value.replace(/\s+/g, ' ').trim()
  return text.length > 88 ? `${text.slice(0, 85)}…` : text
}

export function CommandPalette({
  workspace, surface, preview, onClose, onStageEvidence, onStageApproval, onApplyPreview,
  onCancelPreview, onSubmitQuery, onOpenObject, onRestore, onSwitch,
}: {
  workspace: WorkspaceState
  surface: Surface
  preview: VersionedCommandPreview | null
  onClose: () => void
  onStageEvidence: () => void
  onStageApproval: () => void
  onApplyPreview: () => void
  onCancelPreview: () => void
  onSubmitQuery: (query: string) => string | null
  onOpenObject: (objectId: string) => void
  onRestore: () => void
  onSwitch: (surface: Surface) => void
}) {
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [selectedSearchIndex, setSelectedSearchIndex] = useState(0)
  const resolved = useMemo(() => query.trim() ? resolveUniversalQuery(query, workspace) : null, [query, workspace])
  const search = resolved?.kind === 'search' ? resolved : null
  const submit = () => {
    if (search) {
      const result = search.results[selectedSearchIndex] ?? search.results[0]
      if (result) { onOpenObject(result.id); return }
      setError(search.message)
      return
    }
    setError(onSubmitQuery(query))
  }
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' && search?.results.length) {
      event.preventDefault(); setSelectedSearchIndex((index) => Math.min(search.results.length - 1, index + 1)); return
    }
    if (event.key === 'ArrowUp' && search?.results.length) {
      event.preventDefault(); setSelectedSearchIndex((index) => Math.max(0, index - 1)); return
    }
    if (event.key === 'Enter' && !preview) submit()
  }

  return (
    <div className="command-backdrop" onMouseDown={onClose}>
      <div className="command-palette" onMouseDown={(event) => event.stopPropagation()}>
        <div className="command-input-row">
          <Sparkles size={18} />
          <input
            autoFocus={!preview}
            disabled={Boolean(preview)}
            value={query}
            onChange={(event) => { setQuery(event.target.value); setError(null); setSelectedSearchIndex(0) }}
            onKeyDown={handleKeyDown}
            placeholder="Run a command or find any object in this workspace…"
          />
          <kbd>↵</kbd>
        </div>
        <div className="command-context">
          <span>Working in</span>
          <strong>{surface === 'docs' ? 'Strategy' : surface === 'data' ? 'Financial model' : 'Board narrative'}</strong>
          {query && !preview && <small>{search ? 'Semantic search' : 'Deterministic intent'}</small>}
        </div>

        {preview ? (
          <div className="command-preview">
            <div className="preview-heading"><span>PROPOSED CHANGES</span><strong>{preview.event.summary}</strong></div>
            <div className="preview-diffs">
              {preview.diffs.map((diff) => <div className="preview-diff" key={`${diff.objectId}:${diff.field}`}><div><strong>{diff.label}</strong><span>{diff.field}</span></div><div className="preview-values"><span>{displayValue(diff.before)}</span><ChevronRight size={12} /><strong>{displayValue(diff.after)}</strong></div></div>)}
            </div>
            <div className="preview-impact"><span>DOWNSTREAM IMPACT</span><div>{preview.impacts.length === 0 ? <small>No downstream objects</small> : preview.impacts.slice(0, 5).map((impact) => <small key={impact.id}>{impact.label}</small>)}</div></div>
            <div className="preview-actions"><button className="secondary-button" onClick={onCancelPreview}>Back</button><button className="primary-button" onClick={onApplyPreview}>Apply changes</button></div>
          </div>
        ) : (
          <>
            {error && <div className="command-error">{error}</div>}
            {query && search ? <div className="command-search-results"><span>{search.message.toUpperCase()}</span>{search.results.length ? search.results.map((result, index) => <button className={selectedSearchIndex === index ? 'command-search-result active' : 'command-search-result'} key={result.id} onMouseEnter={() => setSelectedSearchIndex(index)} onClick={() => onOpenObject(result.id)}><span className="command-search-kind">{result.kind.slice(0, 3)}</span><span className="command-search-copy"><strong>{result.title}</strong><small>{shortText(result.text)}</small></span><span className="command-search-surfaces">{result.surfaces.join(' · ')}</span></button>) : <div className="command-error">No connected workspace objects match “{query.trim()}”.</div>}</div> : query ? <div className="command-hints"><span>COMMAND READY · PRESS ENTER TO RUN OR PREVIEW</span><button onClick={() => setQuery('set APAC revenue to 10')}>set APAC revenue to 10</button><button onClick={() => setQuery('set revenue formula to SUM(Regions.Revenue WHERE Growth >= 20)')}>set revenue formula to …</button><button onClick={() => setQuery('approve decision')}>approve decision</button><button onClick={() => setQuery('show history')}>show history</button></div> : <div className="command-group">
              <span>SUGGESTED ACTIONS</span>
              <button onClick={onStageEvidence}><Sparkles size={16} /><div><strong>Add evidence to the strategy</strong><small>Preview a reversible semantic transaction</small></div><ChevronRight size={15} /></button>
              <button onClick={onStageApproval}><CheckCircle2 size={16} /><div><strong>Approve the APAC decision</strong><small>Preview downstream changes before applying</small></div><ChevronRight size={15} /></button>
              <button onClick={() => { onSwitch('data'); onClose() }}><Table2 size={16} /><div><strong>Open the underlying model</strong><small>Inspect data, formulas, and downstream consumers</small></div><ChevronRight size={15} /></button>
              <button onClick={() => { onSwitch('present'); onClose() }}><LayoutTemplate size={16} /><div><strong>Turn this into a board narrative</strong><small>Switch to the linked presentation view</small></div><ChevronRight size={15} /></button>
            </div>}
          </>
        )}

        <div className="command-footer"><span><Command size={13} /> Commands and search both resolve against semantic workspace objects.</span><button onClick={onRestore}><RefreshCw size={13} /> Reset demo</button></div>
      </div>
    </div>
  )
}
