import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Eye, EyeOff, Sparkles } from 'lucide-react'
import type { WorkspaceState } from '../model'
import { buildAllPresentationScenes, buildPresentationScenes, type PresentationSceneId } from '../presentationModel'
import { getPresentationState } from '../presentationState'
import type { VersionedWorkspaceCommand } from '../semanticCommands'
import { SemanticScene } from './SemanticScene'

export function PresentSurface({ workspace, focusedObjectId, onPresentationCommand }: { workspace: WorkspaceState; focusedObjectId?: string | null; onPresentationCommand: (command: VersionedWorkspaceCommand) => void }) {
  const visibleScenes = useMemo(() => buildPresentationScenes(workspace), [workspace])
  const allScenes = useMemo(() => buildAllPresentationScenes(workspace), [workspace])
  const presentation = getPresentationState(workspace)
  const [selectedId, setSelectedId] = useState<PresentationSceneId>(visibleScenes[1]?.id ?? visibleScenes[0]?.id ?? 'thesis')
  const selectedIndex = Math.max(0, visibleScenes.findIndex((scene) => scene.id === selectedId))
  const scene = visibleScenes[selectedIndex] ?? visibleScenes[0]
  const [noteDraft, setNoteDraft] = useState(scene?.note ?? '')

  useEffect(() => {
    if (!visibleScenes.some((item) => item.id === selectedId) && visibleScenes[0]) setSelectedId(visibleScenes[0].id)
  }, [selectedId, visibleScenes])
  useEffect(() => {
    if (!focusedObjectId?.startsWith('scene:')) return
    const id = focusedObjectId.replace(/^scene:/, '') as PresentationSceneId
    if (visibleScenes.some((item) => item.id === id)) setSelectedId(id)
  }, [focusedObjectId, visibleScenes])
  useEffect(() => setNoteDraft(scene?.note ?? ''), [scene?.id, scene?.note])
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && ['input','textarea','select'].includes(event.target.tagName.toLowerCase())) return
      if (event.key === 'ArrowRight') setSelectedId(visibleScenes[Math.min(visibleScenes.length - 1, selectedIndex + 1)]?.id ?? selectedId)
      if (event.key === 'ArrowLeft') setSelectedId(visibleScenes[Math.max(0, selectedIndex - 1)]?.id ?? selectedId)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedId, selectedIndex, visibleScenes])

  if (!scene) return null
  const go = (delta: number) => setSelectedId(visibleScenes[Math.max(0, Math.min(visibleScenes.length - 1, selectedIndex + delta))]?.id ?? selectedId)
  const move = (id: PresentationSceneId, delta: number) => {
    const index = presentation.order.indexOf(id)
    onPresentationCommand({ type: 'presentation.scene.move', sceneId: id, toIndex: index + delta })
  }
  const toggleVisibility = (id: PresentationSceneId) => {
    const visible = !presentation.hiddenSceneIds.includes(id)
    onPresentationCommand({ type: 'presentation.scene.visibility', sceneId: id, visible: !visible })
  }
  const commitNote = () => { if (noteDraft !== scene.note) onPresentationCommand({ type: 'presentation.note.update', sceneId: scene.id, note: noteDraft }) }

  return <div className="present-view">
    <div className="surface-heading compact"><div><span className="surface-kicker">Board narrative · authored live</span><h1>From fragmented files to connected work</h1></div><div className="narrative-health"><Check size={13} /> {visibleScenes.length} visible scenes · semantic storyline</div></div>
    <div className="storyboard">
      <div className="story-rail authored-story-rail">
        <span>STORY</span>
        {allScenes.map((item, index) => {
          const hidden = presentation.hiddenSceneIds.includes(item.id)
          const active = !hidden && item.id === scene.id
          const visibleCount = presentation.order.length - presentation.hiddenSceneIds.length
          return <div className={`authored-story-item ${active ? 'active' : ''} ${hidden ? 'hidden' : ''}`} data-frame-object={`scene:${item.id}`} key={item.id}>
            <button className="story-thumb" disabled={hidden} onClick={() => setSelectedId(item.id)}><small>{String(index + 1).padStart(2, '0')}</small><strong>{item.title}</strong></button>
            <div className="story-item-actions"><button disabled={index === 0} onClick={() => move(item.id, -1)} title="Move scene up"><ChevronUp size={12} /></button><button disabled={index === allScenes.length - 1} onClick={() => move(item.id, 1)} title="Move scene down"><ChevronDown size={12} /></button><button disabled={!hidden && visibleCount <= 1} onClick={() => toggleVisibility(item.id)} title={hidden ? 'Show scene' : 'Hide scene'}>{hidden ? <Eye size={12} /> : <EyeOff size={12} />}</button></div>
          </div>
        })}
        <div className="story-authoring-summary"><strong>{presentation.order.length} semantic scenes</strong><span>Reorder and visibility are versioned; scene content stays live.</span></div>
      </div>
      <div className="slide-stage" data-frame-object={`scene:${scene.id}:stage`}>
        <SemanticScene workspace={workspace} scene={scene} />
        <div className="slide-nav-row"><button disabled={selectedIndex === 0} onClick={() => go(-1)}><ChevronLeft size={14} /> Previous</button><span>{scene.eyebrow}</span><button disabled={selectedIndex === visibleScenes.length - 1} onClick={() => go(1)}>Next <ChevronRight size={14} /></button></div>
        <div className="slide-note editable-slide-note"><Sparkles size={15} /><div><strong>Speaker cue</strong><textarea value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} onBlur={commitNote} rows={3} aria-label={`${scene.id} speaker note`} /><small>Clear the note to return to the live generated cue.</small></div></div>
      </div>
    </div>
  </div>
}
