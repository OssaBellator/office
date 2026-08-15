import { useEffect, useMemo, useState } from 'react'
import { GitBranch, History, RotateCcw, X } from 'lucide-react'
import {
  collectVersionSnapshots,
  getVersionedHistory,
  type VersionedWorkspaceSession,
} from '../versioning'
import { planTransactionRevert } from '../revert'
import { type WorkspaceVersionValue } from '../workspaceCompare'
import { compareWorkspaceStatesWithReview } from '../workspaceReviewCompare'

export function HistoryBrowser({
  session,
  onClose,
  onRevert,
}: {
  session: VersionedWorkspaceSession
  onClose: () => void
  onRevert: (transactionId: string) => void
}) {
  const history = useMemo(() => getVersionedHistory(session), [session])
  const snapshots = useMemo(() => collectVersionSnapshots(session), [session])
  const [selectedId, setSelectedId] = useState<string | null>(history[0]?.transaction.id ?? null)
  const [fromVersion, setFromVersion] = useState(Math.max(0, snapshots.length - 2))
  const [toVersion, setToVersion] = useState(Math.max(0, snapshots.length - 1))

  useEffect(() => {
    if (selectedId && history.some((entry) => entry.transaction.id === selectedId)) return
    setSelectedId(history[0]?.transaction.id ?? null)
  }, [history, selectedId])

  useEffect(() => {
    setFromVersion(Math.max(0, snapshots.length - 2))
    setToVersion(Math.max(0, snapshots.length - 1))
  }, [snapshots.length])

  const selected = history.find((entry) => entry.transaction.id === selectedId)
  const selectedDiffs = selected ? compareWorkspaceStatesWithReview(selected.transaction.before, selected.transaction.after) : []
  const compareDiffs = snapshots[fromVersion] && snapshots[toVersion] ? compareWorkspaceStatesWithReview(snapshots[fromVersion].workspace, snapshots[toVersion].workspace) : []
  const revertPlan = selected && (selected.status === 'applied' || selected.status === 'current') ? planTransactionRevert(session, selected.transaction.id) : null

  return (
    <div className="history-backdrop" onMouseDown={onClose}>
      <section className="history-browser" onMouseDown={(event) => event.stopPropagation()} aria-label="Semantic version history">
        <header className="history-browser-header">
          <div>
            <span className="history-browser-kicker"><History size={13} /> Semantic history</span>
            <h2>Workspace versions</h2>
            <p>{session.ledger.length} recorded revision{session.ledger.length === 1 ? '' : 's'} · next revision v{session.nextRevision}</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close history"><X size={16} /></button>
        </header>

        <div className="history-browser-body">
          <aside className="version-list">
            {history.length === 0 ? <div className="version-empty">Structured edits will appear here.</div> : history.map(({ transaction, status }) => (
              <button key={transaction.id} className={selectedId === transaction.id ? 'version-row active' : 'version-row'} onClick={() => setSelectedId(transaction.id)}>
                <span className={`version-status ${status}`} />
                <div><strong>v{transaction.revision} · {transaction.summary}</strong><span>{status}{transaction.kind === 'revert' ? ` · reverts v${session.ledger.find((item) => item.id === transaction.reverts)?.revision ?? '?'}` : ''}</span></div>
                {status === 'branch' && <GitBranch size={13} />}
              </button>
            ))}
          </aside>

          <main className="history-detail">
            {selected ? <>
              <div className="history-detail-heading">
                <div><span>REVISION {selected.transaction.revision}</span><h3>{selected.transaction.summary}</h3><p>{selected.status} · {selected.transaction.kind} · {formatTimestamp(selected.transaction.createdAt)}</p></div>
                {revertPlan && <button className="secondary-button" disabled={!revertPlan.canRevert} onClick={() => onRevert(selected.transaction.id)} title={revertPlan.canRevert ? 'Revert this change as a new revision' : revertPlan.conflicts[0]?.message}><RotateCcw size={14} /> Revert change</button>}
              </div>

              {revertPlan && !revertPlan.canRevert && <div className="revert-conflict"><strong>Revert needs review</strong>{revertPlan.conflicts.map((item) => <span key={`${item.objectId}:${item.field}`}>{item.message}</span>)}</div>}
              <DiffList title="Changes in this revision" diffs={selectedDiffs} />

              <section className="version-compare">
                <div className="compare-heading">
                  <div><strong>Compare versions</strong><span>Inspect semantic differences between any recorded snapshots, including imported review provenance.</span></div>
                  <div className="compare-selects">
                    <select value={fromVersion} onChange={(event) => setFromVersion(Number(event.target.value))}>{snapshots.map((snapshot, index) => <option value={index} key={snapshot.id}>{snapshot.label}</option>)}</select>
                    <span>→</span>
                    <select value={toVersion} onChange={(event) => setToVersion(Number(event.target.value))}>{snapshots.map((snapshot, index) => <option value={index} key={snapshot.id}>{snapshot.label}</option>)}</select>
                  </div>
                </div>
                <DiffList title={`${compareDiffs.length} semantic difference${compareDiffs.length === 1 ? '' : 's'}`} diffs={compareDiffs} compact />
              </section>
            </> : <div className="history-detail-empty">No structured revisions yet.</div>}
          </main>
        </div>
      </section>
    </div>
  )
}

function DiffList({ title, diffs, compact = false }: { title: string; diffs: ReturnType<typeof compareWorkspaceStatesWithReview>; compact?: boolean }) {
  return <section className={compact ? 'diff-section compact' : 'diff-section'}><div className="diff-section-title">{title}</div>{diffs.length === 0 ? <div className="diff-empty">No semantic differences.</div> : diffs.map((diff, index) => <div className="version-diff" key={`${diff.objectId}:${diff.field}:${index}`}><div><strong>{diff.label}</strong><span>{diff.field} · {diff.change}</span></div><code>{formatValue(diff.before)}</code><span>→</span><code>{formatValue(diff.after)}</code></div>)}</section>
}
function formatValue(value: WorkspaceVersionValue) { if (value === null) return '—'; const text = String(value).replace(/\s+/g, ' ').trim(); return text.length > 90 ? `${text.slice(0, 87)}…` : text }
function formatTimestamp(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString() }
