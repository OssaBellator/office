import { useEffect, useMemo, useState } from 'react'
import { Check, CheckCircle2, ChevronLeft, ChevronRight, Circle, Link2, Plus, Sparkles } from 'lucide-react'
import { formatMetric, type WorkspaceState } from '../model'
import { buildPresentationScenes } from '../presentationModel'

export function PresentSurface({ workspace }: { workspace: WorkspaceState }) {
  const [selected, setSelected] = useState(1)
  const scenes = useMemo(() => buildPresentationScenes(workspace), [workspace])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') setSelected((current) => Math.min(scenes.length - 1, current + 1))
      if (event.key === 'ArrowLeft') setSelected((current) => Math.max(0, current - 1))
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [scenes.length])

  const scene = scenes[selected]
  const go = (delta: number) => setSelected((current) => Math.max(0, Math.min(scenes.length - 1, current + delta)))

  return (
    <div className="present-view">
      <div className="surface-heading compact">
        <div><span className="surface-kicker">Board narrative · 8 min</span><h1>From fragmented files to connected work</h1></div>
        <div className="narrative-health"><Check size={13} /> Storyline connected · scene {selected + 1}/{scenes.length}</div>
      </div>

      <div className="storyboard">
        <div className="story-rail">
          <span>STORY</span>
          {scenes.map((item, index) => <button className={index === selected ? 'story-thumb active' : 'story-thumb'} key={item.id} onClick={() => setSelected(index)}><small>{String(index + 1).padStart(2, '0')}</small><strong>{item.title}</strong></button>)}
          <button className="add-slide" title="Scene creation will use semantic components in the next milestone"><Plus size={15} /> Add scene</button>
        </div>

        <div className="slide-stage">
          <div className={`slide-canvas semantic-scene scene-${scene.id}`}>
            <div className="slide-brand">FRAME / FY27</div>
            {scene.id === 'thesis' && <ThesisScene workspace={workspace} />}
            {scene.id === 'performance' && <PerformanceScene workspace={workspace} />}
            {scene.id === 'signal' && <SignalScene workspace={workspace} />}
            {scene.id === 'decision' && <DecisionScene workspace={workspace} />}
            <div className="slide-source"><Link2 size={11} /> {scene.source}</div>
          </div>
          <div className="slide-nav-row"><button disabled={selected === 0} onClick={() => go(-1)}><ChevronLeft size={14} /> Previous</button><span>{scene.eyebrow}</span><button disabled={selected === scenes.length - 1} onClick={() => go(1)}>Next <ChevronRight size={14} /></button></div>
          <div className="slide-note"><Sparkles size={15} /><span><strong>Speaker cue</strong> — {scene.note}</span></div>
        </div>
      </div>
    </div>
  )
}

function ThesisScene({ workspace }: { workspace: WorkspaceState }) {
  return <><span className="slide-kicker">01 — THESIS</span><h2 className="scene-thesis-title">{workspace.document.title}</h2><p className="scene-thesis-summary">{workspace.document.summary}</p><div className="scene-pill-row"><span>Docs</span><span>Data</span><span>Present</span><strong>One object model</strong></div></>
}
function PerformanceScene({ workspace }: { workspace: WorkspaceState }) {
  const revenue = workspace.metrics.find((metric) => metric.id === 'revenue')!, growth = workspace.metrics.find((metric) => metric.id === 'growth')!, maxRevenue = Math.max(...workspace.regions.map((row) => row.revenue))
  return <><span className="slide-kicker">02 — PERFORMANCE</span><div className="slide-hero-metric">{formatMetric(revenue)}</div><h2>Q2 revenue, growing {formatMetric(growth)} year over year.</h2><div className="slide-chart">{workspace.regions.map((row) => <div className="slide-bar-wrap" key={row.id}><div className="slide-bar" style={{ height: `${Math.max(22, (row.revenue / maxRevenue) * 130)}px` }} /><span>{abbreviate(row.region)}</span></div>)}</div></>
}
function SignalScene({ workspace }: { workspace: WorkspaceState }) {
  const fastest = workspace.regions.reduce((best, row) => row.growth > best.growth ? row : best), averageMargin = workspace.regions.reduce((sum, row) => sum + row.margin, 0) / workspace.regions.length
  return <><span className="slide-kicker">03 — SIGNAL</span><div className="signal-layout"><div><div className="signal-number">{fastest.growth}%</div><h2>{fastest.region} growth</h2><p>Fastest regional growth in the current model.</p></div><div className="signal-cards"><div><span>Revenue</span><strong>${fastest.revenue.toFixed(1)}M</strong></div><div><span>Gross margin</span><strong>{fastest.margin.toFixed(1)}%</strong><small>{fastest.margin < averageMargin ? `${(averageMargin - fastest.margin).toFixed(1)}pts below regional avg` : `${(fastest.margin - averageMargin).toFixed(1)}pts above regional avg`}</small></div></div></div></>
}
function DecisionScene({ workspace }: { workspace: WorkspaceState }) {
  const decision = workspace.decisions[0], approved = decision.status === 'approved'
  return <><span className="slide-kicker">04 — DECISION</span><div className={approved ? 'decision-status approved' : 'decision-status pending'}>{approved ? <CheckCircle2 size={14} /> : <Circle size={14} />}{approved ? 'Approved' : 'Approval requested'}</div><h2 className="decision-scene-title">{decision.title}</h2><p className="decision-scene-rationale">{decision.rationale}</p><div className="decision-owner"><span>Owner</span><strong>{decision.owner}</strong></div></>
}
function abbreviate(region: string) { if (region === 'North America') return 'NA'; if (region === 'Latin America') return 'LATAM'; return region }
