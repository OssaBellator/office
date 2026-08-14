import { useEffect, useState } from 'react'
import {
  ArrowUpRight,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock3,
  Command,
  Database,
  FileText,
  Grid3X3,
  LayoutTemplate,
  Link2,
  MoreHorizontal,
  Play,
  Plus,
  Presentation,
  RefreshCw,
  Search,
  Share2,
  Sparkles,
  Table2,
  X,
} from 'lucide-react'
import {
  formatMetric,
  metricDelta,
  seedWorkspace,
  type RegionRow,
  type Surface,
  type WorkspaceState,
} from './model'

const STORAGE_KEY = 'frame-workspace-v1'

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

function loadWorkspace(): WorkspaceState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : seedWorkspace
  } catch {
    return seedWorkspace
  }
}

export default function App() {
  const [surface, setSurface] = useState<Surface>('docs')
  const [workspace, setWorkspace] = useState<WorkspaceState>(loadWorkspace)
  const [commandOpen, setCommandOpen] = useState(false)
  const [contextOpen, setContextOpen] = useState(true)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace))
  }, [workspace])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandOpen((value) => !value)
      }
      if (event.key === 'Escape') setCommandOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const updateDocument = (field: keyof WorkspaceState['document'], value: string) => {
    setWorkspace((current) => ({
      ...current,
      document: { ...current.document, [field]: value },
    }))
  }

  const updateRegion = (id: string, field: keyof RegionRow, value: string | number) => {
    setWorkspace((current) => {
      const regions = current.regions.map((row) =>
        row.id === id ? { ...row, [field]: value } : row,
      )
      const totalRevenue = regions.reduce((sum, row) => sum + row.revenue, 0)
      const metrics = current.metrics.map((metric) =>
        metric.id === 'revenue'
          ? { ...metric, value: Number(totalRevenue.toFixed(1)), updatedAt: 'just now' }
          : metric,
      )
      return { ...current, regions, metrics }
    })
  }

  const approveDecision = () => {
    setWorkspace((current) => ({
      ...current,
      decisions: current.decisions.map((decision) =>
        decision.id === 'launch' ? { ...decision, status: 'approved' as const } : decision,
      ),
    }))
    setCommandOpen(false)
  }

  const restoreDemo = () => {
    setWorkspace(seedWorkspace)
    setCommandOpen(false)
  }

  const addEvidence = () => {
    setWorkspace((current) => ({
      ...current,
      document: {
        ...current.document,
        body: `${current.document.body}\n\nEvidence to validate: APAC growth is currently 31%, the strongest regional rate in the model.`,
      },
    }))
    setCommandOpen(false)
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-row">
          <div className="brand-mark">F</div>
          <div className="brand-name">Frame</div>
        </div>

        <button className="search-button" onClick={() => setCommandOpen(true)}>
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
          <div className="sidebar-section-title">
            Sources <Plus size={14} />
          </div>
          <div className="source-row">
            <Database size={14} /> Finance model
          </div>
          <div className="source-row">
            <Link2 size={14} /> Customer research
          </div>
        </div>

        <div className="sidebar-footer">
          <div className="avatar">OB</div>
          <div>
            <strong>Ossa</strong>
            <span>Workspace owner</span>
          </div>
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
            <button className="icon-button" aria-label="Toggle context" onClick={() => setContextOpen((value) => !value)}>
              <Grid3X3 size={16} />
            </button>
            <button className="secondary-button"><Share2 size={15} /> Share</button>
            {surface === 'present' && <button className="primary-button"><Play size={14} /> Present</button>}
          </div>
        </header>

        <div className={contextOpen ? 'workbench with-context' : 'workbench'}>
          <section className="canvas-area">
            {surface === 'docs' && (
              <DocsSurface workspace={workspace} updateDocument={updateDocument} onOpenData={() => setSurface('data')} />
            )}
            {surface === 'data' && <DataSurface workspace={workspace} updateRegion={updateRegion} />}
            {surface === 'present' && <PresentSurface workspace={workspace} />}
          </section>

          {contextOpen && <ContextPanel workspace={workspace} surface={surface} onClose={() => setContextOpen(false)} />}
        </div>
      </main>

      <button className="ai-fab" onClick={() => setCommandOpen(true)} aria-label="Open Frame command palette">
        <Sparkles size={18} />
      </button>

      {commandOpen && (
        <CommandPalette
          surface={surface}
          onClose={() => setCommandOpen(false)}
          onAddEvidence={addEvidence}
          onApprove={approveDecision}
          onRestore={restoreDemo}
          onSwitch={setSurface}
        />
      )}
    </div>
  )
}

function DocsSurface({
  workspace,
  updateDocument,
  onOpenData,
}: {
  workspace: WorkspaceState
  updateDocument: (field: keyof WorkspaceState['document'], value: string) => void
  onOpenData: () => void
}) {
  const revenue = workspace.metrics.find((metric) => metric.id === 'revenue')!
  const growth = workspace.metrics.find((metric) => metric.id === 'growth')!
  const decision = workspace.decisions[0]

  return (
    <div className="document-wrap">
      <article className="document-page">
        <input
          className="doc-eyebrow"
          value={workspace.document.eyebrow}
          onChange={(event) => updateDocument('eyebrow', event.target.value)}
          aria-label="Document status"
        />
        <textarea
          className="doc-title"
          value={workspace.document.title}
          onChange={(event) => updateDocument('title', event.target.value)}
          aria-label="Document title"
          rows={2}
        />
        <textarea
          className="doc-summary"
          value={workspace.document.summary}
          onChange={(event) => updateDocument('summary', event.target.value)}
          aria-label="Executive summary"
          rows={3}
        />

        <div className="doc-divider" />
        <h2>The opportunity</h2>
        <textarea
          className="doc-body"
          value={workspace.document.body}
          onChange={(event) => updateDocument('body', event.target.value)}
          aria-label="Document body"
          rows={7}
        />

        <div className="live-object-header">
          <div>
            <span className="object-kicker"><Link2 size={12} /> Live from financial model</span>
            <h2>Business snapshot</h2>
          </div>
          <button className="text-button" onClick={onOpenData}>Open model <ArrowUpRight size={13} /></button>
        </div>

        <div className="metric-grid">
          {workspace.metrics.map((metric) => (
            <div className="metric-card" key={metric.id}>
              <span>{metric.label}</span>
              <strong>{formatMetric(metric)}</strong>
              <small className={metricDelta(metric) >= 0 ? 'positive' : 'negative'}>
                {metricDelta(metric) >= 0 ? '↑' : '↓'} {Math.abs(metricDelta(metric)).toFixed(1)} vs prior
              </small>
            </div>
          ))}
        </div>

        <div className="insight-callout">
          <Sparkles size={17} />
          <div>
            <strong>Frame insight</strong>
            <p>
              Revenue is now {formatMetric(revenue)} with {formatMetric(growth)} YoY growth. APAC is the fastest-growing
              region, which supports the expansion recommendation but deserves a margin check before approval.
            </p>
          </div>
        </div>

        <h2>Decision</h2>
        <div className="decision-card">
          {decision.status === 'approved' ? <CheckCircle2 size={19} /> : <Circle size={19} />}
          <div>
            <strong>{decision.title}</strong>
            <p>{decision.rationale}</p>
            <span>{decision.status === 'approved' ? 'Approved' : 'Pending approval'} · Owner: {decision.owner}</span>
          </div>
        </div>
      </article>
    </div>
  )
}

function DataSurface({
  workspace,
  updateRegion,
}: {
  workspace: WorkspaceState
  updateRegion: (id: string, field: keyof RegionRow, value: string | number) => void
}) {
  const total = workspace.regions.reduce((sum, row) => sum + row.revenue, 0)
  const maxRevenue = Math.max(...workspace.regions.map((row) => row.revenue))

  return (
    <div className="data-view">
      <div className="surface-heading">
        <div>
          <span className="surface-kicker">Financial model</span>
          <h1>Revenue model</h1>
          <p>Typed table · Changes flow into the strategy and board narrative.</p>
        </div>
        <button className="secondary-button"><Plus size={15} /> Add view</button>
      </div>

      <div className="data-tabs">
        <button className="active"><Table2 size={14} /> Grid</button>
        <button><Database size={14} /> Model</button>
        <button><BarChart3 size={14} /> Analyse</button>
      </div>

      <div className="sheet-card">
        <div className="sheet-toolbar">
          <div><span className="status-dot" /> Regions</div>
          <span>4 rows · 4 typed fields</span>
        </div>
        <div className="sheet-scroll">
          <table>
            <thead>
              <tr>
                <th><span>A</span> Region <small>Text</small></th>
                <th><span>B</span> Revenue <small>USD · millions</small></th>
                <th><span>C</span> Growth <small>Percent</small></th>
                <th><span>D</span> Margin <small>Percent</small></th>
              </tr>
            </thead>
            <tbody>
              {workspace.regions.map((row) => (
                <tr key={row.id}>
                  <td>
                    <input value={row.region} onChange={(event) => updateRegion(row.id, 'region', event.target.value)} />
                  </td>
                  <td>
                    <div className="number-input"><span>$</span><input type="number" step="0.1" value={row.revenue} onChange={(event) => updateRegion(row.id, 'revenue', Number(event.target.value))} /><span>M</span></div>
                  </td>
                  <td><div className="number-input"><input type="number" step="1" value={row.growth} onChange={(event) => updateRegion(row.id, 'growth', Number(event.target.value))} /><span>%</span></div></td>
                  <td><div className="number-input"><input type="number" step="0.1" value={row.margin} onChange={(event) => updateRegion(row.id, 'margin', Number(event.target.value))} /><span>%</span></div></td>
                </tr>
              ))}
              <tr className="total-row">
                <td>Total</td>
                <td>${total.toFixed(1)}M</td>
                <td>—</td>
                <td>—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="analysis-grid">
        <section className="analysis-card">
          <div className="card-heading">
            <div><span>Revenue by region</span><strong>${total.toFixed(1)}M</strong></div>
            <MoreHorizontal size={16} />
          </div>
          <div className="bar-list">
            {workspace.regions.map((row) => (
              <div className="bar-row" key={row.id}>
                <span>{row.region}</span>
                <div className="bar-track"><div className="bar-fill" style={{ width: `${(row.revenue / maxRevenue) * 100}%` }} /></div>
                <strong>${row.revenue.toFixed(1)}M</strong>
              </div>
            ))}
          </div>
        </section>
        <section className="analysis-card insight-panel">
          <div className="insight-icon"><Sparkles size={18} /></div>
          <span>Analysis</span>
          <h3>APAC combines the highest growth with below-average margin.</h3>
          <p>That makes expansion attractive, but the strategy should include a margin-protection assumption rather than extrapolating growth alone.</p>
          <button className="text-button">Show calculations <ChevronRight size={13} /></button>
        </section>
      </div>
    </div>
  )
}

function PresentSurface({ workspace }: { workspace: WorkspaceState }) {
  const revenue = workspace.metrics.find((metric) => metric.id === 'revenue')!
  const growth = workspace.metrics.find((metric) => metric.id === 'growth')!
  const apac = workspace.regions.find((row) => row.id === 'apac')!
  const slides = [
    { eyebrow: '01 · Thesis', title: workspace.document.title, body: 'One workspace model. Three purpose-built surfaces.' },
    { eyebrow: '02 · Performance', title: `${formatMetric(revenue)} revenue`, body: `${formatMetric(growth)} YoY growth · live from the financial model` },
    { eyebrow: '03 · Signal', title: `APAC is growing ${apac.growth}%`, body: `Revenue is $${apac.revenue.toFixed(1)}M with ${apac.margin.toFixed(1)}% gross margin.` },
    { eyebrow: '04 · Decision', title: workspace.decisions[0].title, body: workspace.decisions[0].rationale },
  ]

  return (
    <div className="present-view">
      <div className="surface-heading compact">
        <div>
          <span className="surface-kicker">Board narrative · 8 min</span>
          <h1>From fragmented files to connected work</h1>
        </div>
        <div className="narrative-health"><Check size={13} /> Storyline connected</div>
      </div>

      <div className="storyboard">
        <div className="story-rail">
          <span>STORY</span>
          {slides.map((slide, index) => (
            <button className={index === 1 ? 'story-thumb active' : 'story-thumb'} key={slide.eyebrow}>
              <small>{String(index + 1).padStart(2, '0')}</small>
              <strong>{slide.title}</strong>
            </button>
          ))}
          <button className="add-slide"><Plus size={15} /> Add scene</button>
        </div>

        <div className="slide-stage">
          <div className="slide-canvas">
            <div className="slide-brand">FRAME / FY27</div>
            <span className="slide-kicker">02 — PERFORMANCE</span>
            <div className="slide-hero-metric">{formatMetric(revenue)}</div>
            <h2>Q2 revenue, growing {formatMetric(growth)} year over year.</h2>
            <div className="slide-chart">
              {workspace.regions.map((row) => (
                <div className="slide-bar-wrap" key={row.id}>
                  <div className="slide-bar" style={{ height: `${40 + row.revenue * 5}px` }} />
                  <span>{row.region === 'North America' ? 'NA' : row.region === 'Latin America' ? 'LATAM' : row.region}</span>
                </div>
              ))}
            </div>
            <div className="slide-source"><Link2 size={11} /> Finance model · Revenue · Q2 FY27 · live</div>
          </div>
          <div className="slide-note">
            <Sparkles size={15} />
            <span><strong>Speaker cue</strong> — Lead with momentum, then use the next scene to explain why APAC changes the allocation decision.</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function ContextPanel({
  workspace,
  surface,
  onClose,
}: {
  workspace: WorkspaceState
  surface: Surface
  onClose: () => void
}) {
  const revenue = workspace.metrics.find((metric) => metric.id === 'revenue')!
  return (
    <aside className="context-panel">
      <div className="context-heading">
        <span>Context</span>
        <button className="icon-button small" onClick={onClose} aria-label="Close context"><X size={14} /></button>
      </div>

      <div className="context-section">
        <span className="context-label">Current view</span>
        <div className="context-view-card">
          {surface === 'docs' ? <FileText size={16} /> : surface === 'data' ? <Table2 size={16} /> : <Presentation size={16} />}
          <div>
            <strong>{surface === 'docs' ? 'Strategy document' : surface === 'data' ? 'Revenue model' : 'Board narrative'}</strong>
            <span>{surface === 'docs' ? '12 connected objects' : surface === 'data' ? '4 rows · 3 metrics' : '4 scenes · 3 live objects'}</span>
          </div>
        </div>
      </div>

      <div className="context-section">
        <span className="context-label">Connected object</span>
        <div className="object-detail">
          <div className="object-detail-title"><Database size={15} /><strong>{revenue.label}</strong></div>
          <div className="object-value">{formatMetric(revenue)}</div>
          <dl>
            <div><dt>Source</dt><dd>{revenue.source}</dd></div>
            <div><dt>Updated</dt><dd>{revenue.updatedAt}</dd></div>
            <div><dt>Used in</dt><dd>Strategy · Slide 2</dd></div>
          </dl>
        </div>
      </div>

      <div className="context-section">
        <span className="context-label">Activity</span>
        <div className="activity-row"><Clock3 size={14} /><div><strong>Revenue model updated</strong><span>Shared object propagated · just now</span></div></div>
        <div className="activity-row"><CheckCircle2 size={14} /><div><strong>Source link healthy</strong><span>No broken references</span></div></div>
      </div>
    </aside>
  )
}

function CommandPalette({
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
          <button onClick={onAddEvidence}><Sparkles size={16} /><div><strong>Add evidence to the strategy</strong><small>Draft a traceable supporting note from connected data</small></div><ChevronRight size={15} /></button>
          <button onClick={onApprove}><CheckCircle2 size={16} /><div><strong>Approve the APAC decision</strong><small>Update the shared decision object everywhere</small></div><ChevronRight size={15} /></button>
          <button onClick={() => { onSwitch('data'); onClose() }}><Table2 size={16} /><div><strong>Open the underlying data</strong><small>Inspect the values behind linked metrics</small></div><ChevronRight size={15} /></button>
          <button onClick={() => { onSwitch('present'); onClose() }}><LayoutTemplate size={16} /><div><strong>Turn this into a board narrative</strong><small>Switch to the linked presentation view</small></div><ChevronRight size={15} /></button>
        </div>
        <div className="command-footer">
          <span><Command size={13} /> Prototype actions are deterministic and preview-safe.</span>
          <button onClick={onRestore}><RefreshCw size={13} /> Reset demo</button>
        </div>
      </div>
    </div>
  )
}
