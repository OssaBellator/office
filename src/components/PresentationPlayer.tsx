import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import type { WorkspaceState } from '../model'
import { buildPresentationScenes } from '../presentationModel'
import { SemanticScene } from './SemanticScene'

export function PresentationPlayer({ workspace, onClose }: { workspace: WorkspaceState; onClose: () => void }) {
  const scenes = useMemo(() => buildPresentationScenes(workspace), [workspace])
  const [selected, setSelected] = useState(0)
  const scene = scenes[selected]
  const go = (delta: number) => setSelected((current) => Math.max(0, Math.min(scenes.length - 1, current + delta)))

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowRight' || event.key === ' ' || event.key === 'PageDown') { event.preventDefault(); go(1) }
      if (event.key === 'ArrowLeft' || event.key === 'PageUp') { event.preventDefault(); go(-1) }
      if (event.key === 'Home') setSelected(0)
      if (event.key === 'End') setSelected(scenes.length - 1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [scenes.length, onClose])

  return (
    <div className="presentation-player" role="dialog" aria-label="Presentation mode">
      <div className="presentation-player-toolbar">
        <div><strong>Board narrative</strong><span>{selected + 1} / {scenes.length}</span></div>
        <button onClick={onClose} aria-label="Exit presentation"><X size={18} /></button>
      </div>
      <div className="presentation-player-stage">
        <SemanticScene workspace={workspace} scene={scene} className="presentation-player-slide" />
      </div>
      <div className="presentation-player-footer">
        <button disabled={selected === 0} onClick={() => go(-1)}><ChevronLeft size={16} /> Previous</button>
        <div><strong>{scene.eyebrow}</strong><span>{scene.note}</span></div>
        <button disabled={selected === scenes.length - 1} onClick={() => go(1)}>Next <ChevronRight size={16} /></button>
      </div>
    </div>
  )
}
