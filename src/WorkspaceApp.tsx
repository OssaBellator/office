import { useEffect, useState } from 'react'
import {
  Check, ChevronRight, Clock3, Database, FileText, Grid3X3, Link2, MoreHorizontal,
  Play, Plus, Presentation, Search, Sparkles, Table2,
} from 'lucide-react'
import { cloneSeedWorkspace, type PlanRow, type RegionRow, type SourceRecord, type Surface, type WorkspaceState } from './model'
import { previewVersionedCommand } from './semanticPreview'
import { parsePaletteIntent } from './intent'
import { makeGrowthEvidenceInsertion } from './semanticDocument'
import { exportWorkspaceSession, importWorkspaceSession } from './workspaceIO'
import {
  createVersionedWorkspaceSession,
  executeVersionedWorkspaceCommand,
  redoVersionedWorkspaceSession,
  undoVersionedWorkspaceSession,
  type VersionedWorkspaceSession,
} from './versioning'
import { revertVersionedTransaction } from './revert'
import type { VersionedWorkspaceCommand } from './semanticCommands'
import {
  hydrateWorkspaceSession, LEGACY_WORKSPACE_STORAGE_KEY, serializeWorkspaceSession, SESSION_STORAGE_KEY,
} from './sessionStore'
import { CommandPalette } from './components/CommandPalette'
import { ContextPanel } from './components/ContextPanel'
import { DataSurface } from './components/DataSurface'
import { DocsSurface } from './components/DocsSurface'
import { HistoryBrowser } from './components/HistoryBrowser'
import { PresentSurface } from './components/PresentSurface'
import { PresentationPlayer } from './components/PresentationPlayer'
import './model-view.css'
import './history-browser.css'

type NavItem = { id: Surface; label: string; icon: typeof FileText; meta: string }
const navItems: NavItem[] = [
  { id: 'docs', label: 'Strategy', icon: FileText, meta: 'Doc' },
  { id: 'data', label: 'Financial model', icon: Table2, meta: 'Data' },
  { id: 'present', label: 'Board narrative', icon: Presentation, meta: 'Present' },
]

function loadSession(): VersionedWorkspaceSession {
  try {
    const rawSession = localStorage.getItem(SESSION_STORAGE_KEY)
    if (rawSession) return hydrateWorkspaceSession(JSON.parse(rawSession))
    const legacyWorkspace = localStorage.getItem(LEGACY_WORKSPACE_STORAGE_KEY)
    return hydrateWorkspaceSession(null, legacyWorkspace ? JSON.parse(legacyWorkspace) : cloneSeedWorkspace())
  } catch {
    return createVersionedWorkspaceSession(cloneSeedWorkspace())
  }
}

function isEditingText(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable
}

export default function WorkspaceApp() {
  const [surface, setSurface] = useState<Surface>('docs')
  const [session, setSession] = useState<VersionedWorkspaceSession>(loadSession)
  const [commandOpen, setCommandOpen] = useState(false)
  const [pendingCommand, setPendingCommand] = useState<VersionedWorkspaceCommand | null>(null)
  const [contextOpen, setContextOpen] = useState(true)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [workspaceNotice, setWorkspaceNotice] = useState<string | null>(null)
  const [presentationOpen, setPresentationOpen] = useState(false)
  const workspace = session.present
  const commandPreview = pendingCommand ? previewVersionedCommand(workspace, pendingCommand) : null

  useEffect(() => {
    localStorage.setItem(SESSION_STORAGE_KEY, serializeWorkspaceSession(session))
    localStorage.setItem(LEGACY_WORKSPACE_STORAGE_KEY, JSON.stringify(workspace))
  }, [session, workspace])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey
      const key = event.key.toLowerCase()
      if (modifier && key === 'k') { event.preventDefault(); setPendingCommand(null); setCommandOpen((value) => !value); return }
      if (modifier && event.shiftKey && key === 'h' && !isEditingText(event.target)) { event.preventDefault(); setHistoryOpen(true); return }
      if (modifier && key === 'z' && !isEditingText(event.target)) {
        event.preventDefault()
        setSession((current) => event.shiftKey ? redoVersionedWorkspaceSession(current) : undoVersionedWorkspaceSession(current))
        return
      }
      if (event.key === 'Escape') { setPendingCommand(null); setCommandOpen(false); setHistoryOpen(false); setPresentationOpen(false) }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const execute = (command: VersionedWorkspaceCommand) => setSession((current) => executeVersionedWorkspaceCommand(current, command))
  const commitDocument = (field: keyof WorkspaceState['document'], value: string) => execute({ type: 'document.update', field, value })
  const updateRegion = (id: string, field: keyof RegionRow, value: string | number) => execute({ type: 'region.update', regionId: id, field, value })
  const updatePlan = (id: string, field: keyof PlanRow, value: string | number) => execute({ type: 'plan.update', planId: id, field, value })
  const updateMetricFormula = (metricId: string, formula: string) => execute({ type: 'metric.formula', metricId, formula })
  const updateSourceStatus = (sourceId: string, status: SourceRecord['status']) => execute({ type: 'source.status', sourceId, status })

  const stageApproval = () => setPendingCommand({ type: 'decision.status', decisionId: 'launch', status: 'approved' })
  const stageEvidence = () => {
    const insertion = makeGrowthEvidenceInsertion(workspace)
    setPendingCommand({ type: 'document.block.insert', ...insertion })
  }
  const applyPendingCommand = () => { if (!pendingCommand) return; execute(pendingCommand); setPendingCommand(null); setCommandOpen(false) }
  const closeCommandPalette = () => { setPendingCommand(null); setCommandOpen(false) }
  const openCommandPalette = () => { setPendingCommand(null); setCommandOpen(true) }
  const restoreDemo = () => { setSession(createVersionedWorkspaceSession(cloneSeedWorkspace())); setPendingCommand(null); setCommandOpen(false); setHistoryOpen(false); setPresentationOpen(false) }
  const revertTransaction = (transactionId: string) => setSession((current) => revertVersionedTransaction(current, transactionId).session)
  const exportBackup = () => {
    const blob = new Blob([exportWorkspaceSession(session)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `frame-${workspace.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workspace'}.json`
    anchor.click()
    URL.revokeObjectURL(url)
    setWorkspaceNotice('Workspace backup exported')
  }
  const importBackup = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      try {
        const restored = importWorkspaceSession(await file.text())
        setSession(restored)
        setPendingCommand(null)
        setCommandOpen(false)
        setHistoryOpen(false)
        setPresentationOpen(false)
        setWorkspaceNotice(`Imported ${file.name}`)
      } catch (error) {
        setWorkspaceNotice(error instanceof Error ? error.message : 'Could not import workspace')
      }
    }
    input.click()
  }
  const runPaletteQuery = (query: string) => {
    const intent = parsePaletteIntent(query, workspace)
    switch (intent.kind) {
      case 'command': setPendingCommand(intent.command); return null
      case 'navigate': setSurface(intent.surface); closeCommandPalette(); return null
      case 'history': closeCommandPalette(); setHistoryOpen(true); return null
      case 'undo': setSession((current) => undoVersionedWorkspaceSession(current)); closeCommandPalette(); return null
      case 'redo': setSession((current) => redoVersionedWorkspaceSession(current)); closeCommandPalette(); return null
      case 'error': return intent.message
      case 'unknown': return intent.message
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-row"><div className="brand-mark">F</div><div className="brand-name">Frame</div></div>
        <button className="search-button" onClick={openCommandPalette}><Search size={15} /><span>Search or ask</span><kbd>⌘ K</kbd></button>
        <div className="workspace-label">Workspace</div>
        <button className="workspace-switcher"><div className="workspace-avatar">FY</div><div><strong>{workspace.title}</strong><span>Product & strategy</span></div><ChevronRight size={15} /></button>
        <nav className="surface-nav" aria-label="Workspace views">{navItems.map((item) => { const Icon = item.icon; return <button key={item.id} className={surface === item.id ? 'nav-item active' : 'nav-item'} onClick={() => setSurface(item.id)}><Icon size={16} /><span>{item.label}</span><small>{item.meta}</small></button> })}</nav>
        <div className="sidebar-section"><div className="sidebar-section-title">Sources <Plus size={14} /></div>{workspace.sources.map((source) => <div className="source-row" key={source.id}>{source.type === 'dataset' ? <Database size={14} /> : <Link2 size={14} />} {source.label}</div>)}</div>
        <div className="sidebar-footer"><div className="avatar">OB</div><div><strong>Ossa</strong><span>Workspace owner</span></div><MoreHorizontal size={16} /></div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="crumbs"><span>{workspace.title}</span><ChevronRight size={13} /><strong>{navItems.find((item) => item.id === surface)?.label}</strong></div>
          <div className="topbar-actions">
            <span className="saved-state"><Check size={13} /> {workspaceNotice ?? `Saved locally · v${session.past.at(-1)?.revision ?? 0}`}</span>
            <div className="history-actions" aria-label="Semantic history controls">
              <button disabled={session.past.length === 0} onClick={() => setSession((current) => undoVersionedWorkspaceSession(current))} title={session.past.at(-1) ? `Undo: ${session.past.at(-1)?.summary}` : 'Nothing to undo'}>↶ <span>Undo</span></button>
              <button disabled={session.future.length === 0} onClick={() => setSession((current) => redoVersionedWorkspaceSession(current))} title={session.future[0] ? `Redo: ${session.future[0].summary}` : 'Nothing to redo'}>↷ <span>Redo</span></button>
            </div>
            <button className="secondary-button history-open-button" onClick={() => setHistoryOpen(true)} title="Semantic history (Cmd/Ctrl + Shift + H)"><Clock3 size={14} /> History</button>
            <button className="icon-button" aria-label="Toggle context" onClick={() => setContextOpen((value) => !value)}><Grid3X3 size={16} /></button>
            <button className="secondary-button" onClick={exportBackup}>Export</button>
            <button className="secondary-button" onClick={importBackup}>Import</button>
            {surface === 'present' && <button className="primary-button" onClick={() => setPresentationOpen(true)}><Play size={14} /> Present</button>}
          </div>
        </header>

        <div className={contextOpen ? 'workbench with-context' : 'workbench'}>
          <section className="canvas-area">
            {surface === 'docs' && <DocsSurface workspace={workspace} commitDocument={commitDocument} onSemanticCommand={execute} onOpenData={() => setSurface('data')} />}
            {surface === 'data' && <DataSurface workspace={workspace} updateRegion={updateRegion} updatePlan={updatePlan} updateMetricFormula={updateMetricFormula} updateChartKind={(chartId, kind) => execute({ type: 'chart.kind', chartId, kind })} />}
            {surface === 'present' && <PresentSurface workspace={workspace} onPresentationCommand={execute} />}
          </section>
          {contextOpen && <ContextPanel workspace={workspace} surface={surface} transactions={session.past} onSetSourceStatus={updateSourceStatus} onClose={() => setContextOpen(false)} />}
        </div>
      </main>

      <button className="ai-fab" onClick={openCommandPalette} aria-label="Open Frame command palette"><Sparkles size={18} /></button>
      {commandOpen && <CommandPalette surface={surface} preview={commandPreview} onClose={closeCommandPalette} onStageEvidence={stageEvidence} onStageApproval={stageApproval} onApplyPreview={applyPendingCommand} onCancelPreview={() => setPendingCommand(null)} onSubmitQuery={runPaletteQuery} onRestore={restoreDemo} onSwitch={setSurface} />}
      {historyOpen && <HistoryBrowser session={session} onClose={() => setHistoryOpen(false)} onRevert={revertTransaction} />}
      {presentationOpen && <PresentationPlayer workspace={workspace} onClose={() => setPresentationOpen(false)} />}
    </div>
  )
}
