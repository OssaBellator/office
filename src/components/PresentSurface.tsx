import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Plus, Sparkles } from 'lucide-react'
import type { WorkspaceState } from '../model'
import { buildPresentationScenes } from '../presentationModel'
import { SemanticScene } from './SemanticScene'

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
          <SemanticScene workspace={workspace} scene={scene} />
          <div className="slide-nav-row"><button disabled={selected === 0} onClick={() => go(-1)}><ChevronLeft size={14} /> Previous</button><span>{scene.eyebrow}</span><button disabled={selected === scenes.length - 1} onClick={() => go(1)}>Next <ChevronRight size={14} /></button></div>
          <div className="slide-note"><Sparkles size={15} /><span><strong>Speaker cue</strong> — {scene.note}</span></div>
        </div>
      </div>
    </div>
  )
}
