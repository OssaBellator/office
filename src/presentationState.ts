import type { DependencyEdge, WorkspaceObject, WorkspaceState } from './model.ts'

export type BuiltInPresentationSceneId = 'thesis' | 'performance' | 'signal' | 'decision'
export type ImportedPresentationSceneId = `imported:${string}`
export type PresentationSceneId = BuiltInPresentationSceneId | ImportedPresentationSceneId
export type ImportedPresentationScene = {
  id: ImportedPresentationSceneId
  title: string
  body: string[]
  source: string
  note?: string
}
export type PresentationState = {
  order: PresentationSceneId[]
  hiddenSceneIds: PresentationSceneId[]
  notes: Partial<Record<PresentationSceneId, string>>
  importedScenes?: ImportedPresentationScene[]
}

type PersistedPresentationState = Partial<PresentationState>
type ExtendedWorkspaceState = WorkspaceState & { presentationState?: PersistedPresentationState }

const defaultOrder: BuiltInPresentationSceneId[] = ['thesis', 'performance', 'signal', 'decision']

function validBuiltInSceneId(value: unknown): value is BuiltInPresentationSceneId {
  return value === 'thesis' || value === 'performance' || value === 'signal' || value === 'decision'
}
function validImportedScene(value: unknown): value is ImportedPresentationScene {
  if (!value || typeof value !== 'object') return false
  const scene = value as Partial<ImportedPresentationScene>
  return typeof scene.id === 'string' && scene.id.startsWith('imported:') && typeof scene.title === 'string' && Array.isArray(scene.body) && scene.body.every((item) => typeof item === 'string') && typeof scene.source === 'string' && (scene.note === undefined || typeof scene.note === 'string')
}

function normalizePresentationState(value?: PersistedPresentationState): PresentationState {
  const importedScenes: ImportedPresentationScene[] = []
  const importedIds = new Set<string>()
  for (const candidate of value?.importedScenes ?? []) {
    if (!validImportedScene(candidate) || importedIds.has(candidate.id)) continue
    importedIds.add(candidate.id)
    importedScenes.push(structuredClone(candidate))
  }
  const validSceneId = (candidate: unknown): candidate is PresentationSceneId => validBuiltInSceneId(candidate) || (typeof candidate === 'string' && importedIds.has(candidate))
  const seen = new Set<PresentationSceneId>()
  const order = (value?.order ?? []).filter(validSceneId).filter((id) => { if (seen.has(id)) return false; seen.add(id); return true })
  for (const id of defaultOrder) if (!seen.has(id)) { seen.add(id); order.push(id) }
  for (const scene of importedScenes) if (!seen.has(scene.id)) { seen.add(scene.id); order.push(scene.id) }
  const hiddenSceneIds = [...new Set((value?.hiddenSceneIds ?? []).filter(validSceneId))]
  const notes: PresentationState['notes'] = {}
  for (const id of order) {
    const note = value?.notes?.[id]
    if (typeof note === 'string' && note.trim()) notes[id] = note
  }
  return { order, hiddenSceneIds, notes, importedScenes }
}

export function getPresentationState(workspace: WorkspaceState): PresentationState {
  return normalizePresentationState((workspace as ExtendedWorkspaceState).presentationState)
}

function ensurePresentationGraph(workspace: WorkspaceState, state: PresentationState) {
  const importedPrefix = 'scene:imported:'
  const objects = workspace.graph.objects.filter((object) => !object.id.startsWith(importedPrefix))
  const edges = workspace.graph.edges.filter((edge) => !edge.from.startsWith(importedPrefix) && !edge.to.startsWith(importedPrefix))
  const objectIds = new Set(objects.map((object) => object.id))
  const edgeKeys = new Set(edges.map((edge) => `${edge.from}|${edge.to}|${edge.relation}`))
  const addObject = (object: WorkspaceObject) => { if (!objectIds.has(object.id)) { objectIds.add(object.id); objects.push(object) } }
  const addEdge = (edge: DependencyEdge) => { const key = `${edge.from}|${edge.to}|${edge.relation}`; if (!edgeKeys.has(key)) { edgeKeys.add(key); edges.push(edge) } }
  addObject({ id:'scene:thesis', kind:'scene', label:'Board narrative · Thesis', surfaces:['present'] })
  addObject({ id:'scene:signal', kind:'scene', label:'Board narrative · Signal', surfaces:['present'] })
  addEdge({ from:'document:strategy', to:'scene:thesis', relation:'renders', description:'Strategy thesis renders in the opening scene' })
  addEdge({ from:'metric:growth', to:'scene:signal', relation:'renders', description:'Growth evidence informs the signal scene' })
  for (const scene of state.importedScenes ?? []) addObject({ id:`scene:${scene.id}`, kind:'scene', label:`Imported slide · ${scene.title}`, surfaces:['present'] })
  return { objects, edges }
}

export function withPresentationState(workspace: WorkspaceState, state: PresentationState): WorkspaceState {
  const normalized = normalizePresentationState(state)
  return {
    ...workspace,
    graph: ensurePresentationGraph(workspace, normalized),
    presentationState: normalized,
  } as WorkspaceState
}

export function materializePresentationState(workspace: WorkspaceState): WorkspaceState {
  return withPresentationState(workspace, getPresentationState(workspace))
}
