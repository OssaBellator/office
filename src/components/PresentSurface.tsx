import { Check, Link2, Plus, Sparkles } from 'lucide-react'
import { formatMetric, type WorkspaceState } from '../model'

export function PresentSurface({ workspace }: { workspace: WorkspaceState }) {
  const revenue = workspace.metrics.find((metric) => metric.id === 'revenue')!
  const growth = workspace.metrics.find((metric) => metric.id === 'growth')!
  const apac = workspace.regions.find((row) => row.id === 'apac')!
  const slides = [
    { eyebrow: '01 · Thesis', title: workspace.document.title },
    { eyebrow: '02 · Performance', title: `${formatMetric(revenue)} revenue` },
    { eyebrow: '03 · Signal', title: `APAC is growing ${apac.growth}%` },
    { eyebrow: '04 · Decision', title: workspace.decisions[0].title },
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
