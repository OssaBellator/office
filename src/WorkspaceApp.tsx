import { useEffect, useState } from 'react'
import {
  Check,
  ChevronRight,
  Database,
  FileText,
  Grid3X3,
  Link2,
  MoreHorizontal,
  Play,
  Plus,
  Presentation,
  Search,
  Share2,
  Sparkles,
  Table2,
} from 'lucide-react'
import {
  cloneSeedWorkspace,
  createWorkspaceSession,
  executeWorkspaceCommand,
  redoWorkspaceSession,
  undoWorkspaceSession,
  type RegionRow,
  type Surface,
  type WorkspaceCommand,
  type WorkspaceSession,
  type WorkspaceState,
} from './model'
import { previewWorkspaceCommand } from './commandPreview'
import {
  hydrateWorkspaceSession,
  LEGACY_WORKSPACE_STORAGE_KEY,
  serializeWorkspaceSession,
  SESSION_STORAGE_KEY,
} from './sessionStore'
import { CommandPalette } from './components/CommandPalette'
import { ContextPanel } from './components/ContextPanel'
import { DataSurface } from './components/DataSurface'
import { DocsSurface } from './components/DocsSurface'
import { PresentSurface } from './components/PresentSurface'
import './model-view.css'

type NavItem = {
  id: Surface
  label: string
  icon: typeof FileText
  meta: string
}

const navItems: NavItem[] = [
  { id: 'docs', label: 'Strategy', icon: FileText, meta: 'Doc' },
  { id: 'data', label: 'Financial model', icon: Table2, meta: 'Data' },
  { id: 'present', label: 'Board narrative', icon: Presentation, meta: 'Present' },
]

function loadSession(): WorkspaceSession {
  try {
    const rawSession = localStorage.getItem(SESSION_STORAGE_KEY)
    if (rawSession) return hydrateWorkspaceSession(JSON.parse(rawSession))

    const legacyWorkspace = localStorage.getItem(LEGACY_WORKSPACE_STORAGE_KEY)
    return hydrateWorkspaceSession(null, legacyWorkspace ? JSON.parse(legacyWorkspace) : cloneSeedWorkspace())
  } catch {
    return createWorkspaceSession(cloneSeedWorkspace())
  }
}

function isEditingText(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || target.isContentEditable
}

export default function WorkspaceApp() {
  const [surface, setSurface] = useState<Surface>('docs')
  const [session, setSession] = useState<WorkspaceSession>(loadSession)
  const [commandOpen, setCommandOpen] = useState(false)
  const [pendingCommand, setPendingCommand] = useState<WorkspaceCommand | null>(null)
  const [contextOpen, setContextOpen] = useState(true)
  const workspace = session.present
  const commandPreview = pendingCommand ? previewWorkspaceCommand(workspace, pendingCommand) : null

  useEffect(() => {
    localStorage.setItem(SESSION_STORAGE_KEY, serializeWorkspaceSession(session))
    localStorage.setItem(LEGACY_WORKSPACE_STORAGE_KEY, JSON.stringify(workspace))
  }, [session, workspace])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey
      const key = event.key.toLowerCase()

      if (modifier && key === 'k') {
        event.preventDefault()
        setPendingCommand(null)
        setCommandOpen((value) => !value)
        return
      }

      if (modifier && key === 'z' && !isEditingText(event.target)) {
        event.preventDefault()
        setSession((current) => event.shiftKey ? redoWorkspaceSession(current) : undoWorkspaceSession(current))
        return
      }

      if (event.key === 'Escape') {
        setPendingCommand(null)
        setCommandOpen(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const updateDocument = (field: keyof WorkspaceState['document'], value: string) => {
    setSession((current) => ({
      ...current,
      present: {
        ...current.present,
        document: { ...current.present.document, [field]: value },
      },
      future: [],
    }))
  }

  const updateRegion = (id: string, field: keyof RegionRow, value: string | number) => {
    setSession((current) => executeWorkspaceCommand(current, {
      type: 'region.update',
      regionId: id,
      field,
      value,
    }))
  }

  const stageApproval = () => {
    setPendingCommand({
      type: 'decision.status',
      decisionId: 'launch',
      status: 'approved',
    })
  }

  const stageEvidence = () => {
    setPendingCommand({
      type: 'document.append',
      text: 'Evidence to validate: APAC growth is currently 31%, the strongest regional rate in the model.',
    })
  }

  const applyPendingCommand = () => {
    if (!pendingCommand) return
    setSession((current) => executeWorkspaceCommand(current, pendingCommand))
    setPendingCommand(null)
    setCommandOpen(false)
  }

  const closeCommandPalette = () => {
    setPendingCommand(null)
    setCommandOpen(false)
  }

  const openCommandPalette = () => {
    setPendingCommand(null)
    setCommandOpen(true)
  }

  const restoreDemo = () => {
    setSession(createWorkspaceSession(cloneSeedWorkspace()))
    setPendingCommand(null)
    setCommandOpen(false)
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-row">
          <div className="brand-mark">F</div>
          <div className="brand-name">Frame</div>
        </div>

        <button className="search-button" onClick={openCommandPalette}>
          <Search size={15} />
          <span>Search or ask</span>
          <kbd>⌘ K</kbd>
        </button>

        <div className="workspace-label">Workspace</div>
        <button className="workspace-switcher">
          <div className="workspace-avatar">FY</div>
          <div>
            <strong>{workspace.title}</strong>
            <span>Product & strategy</span>
          </div>
          <ChevronRight size={15} />
        </button>

        <nav className="surface-nav" aria-label="Workspace views">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                className={surface === item.id ? 'nav-item active' : 'nav-item'}
                onClick={() => setSurface(item.id)}
              >
                <Icon size={16} />
                <span>{item.label}</span>
                <small>{item.meta}</small>
              </button>
            )
          })}
        </nav>

        <div className="sidebar-section">
          <div className="sidebar-section-title">Sources <Plus size={14} /></div>
          {workspace.sources.map((source) => (
            <div className="source-row" key={source.id}>
              {source.type === 'dataset' ? <Database size={14} /> : <Link2 size={14} />} {source.label}
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <div className="avatar">OB</div>
          <div><strong>Ossa</strong><span>Workspace owner</span></div>
          <MoreHorizontal size={16} />
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="crumbs">
            <span>{workspace.title}</span>
            <ChevronRight size={13} />
            <strong>{navItems.find((item) => item.id === surface)?.label}</strong>
          </div>
          <div className="topbar-actions">
            <span className="saved-state"><Check size={13} /> Saved locally</span>
            <div className="history-actions" aria-label="Semantic history controls">
              <button
                disabled={session.past.length === 0}
                onClick={() => setSession((current) => undoWorkspaceSession(current))}
                title={session.past.at(-1) ? `Undo: ${session.past.at(-1)?.summary}` : 'Nothing to undo'}
              >↶ <span>Undo</span></button>
              <button
                disabled={session.future.length === 0}
                onClick={() => setSession((current) => redoWorkspaceSession(current))}
                title={session.future[0] ? `Redo: ${session.future[0].summary}` : 'Nothing to redo'}
              >↷ <span>Redo</span></button>
            </div>
            <button className="icon-button" aria-label="Toggle context" onClick={() => setContextOpen((value) => !value)}><Grid3X3 size={16} /></button>
            <button className="secondary-button"><Share2 size={15} /> Share</button>
            {surface === 'present' && <button className="primary-button"><Play size={14} /> Present</button>}
          </div>
        </header>

        <div className={contextOpen ? 'workbench with-context' : 'workbench'}>
          <section className="canvas-area">
            {surface === 'docs' && <DocsSurface workspace={workspace} updateDocument={updateDocument} onOpenData={() => setSurface('data')} />}
            {surface === 'data' && <DataSurface workspace={workspace} updateRegion={updateRegion} />}
            {surface === 'present' && <PresentSurface workspace={workspace} />}
          </section>
          {contextOpen && <ContextPanel workspace={workspace} surface={surface} transactions={session.past} onClose={() => setContextOpen(false)} />}
        </div>
      </main>

      <button className="ai-fab" onClick={openCommandPalette} aria-label="Open Frame command palette"><Sparkles size={18} /></button>

      {commandOpen && (
        <CommandPalette
          surface={surface}
          preview={commandPreview}
          onClose={closeCommandPalette}
          onStageEvidence={stageEvidence}
          onStageApproval={stageApproval}
          onApplyPreview={applyPendingCommand}
          onCancelPreview={() => setPendingCommand(null)}
          onRestore={restoreDemo}
          onSwitch={setSurface}
        />
      )}
    </div>
  )
}
