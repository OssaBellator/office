import type { DependencyEdge, WorkspaceObject, WorkspaceState } from './model.ts'

export type PresentationSceneId = 'thesis' | 'performance' | 'signal' | 'decision'
export type PresentationState = {
  order: PresentationSceneId[]
  hiddenSceneIds: PresentationSceneId[]
  notes: Partial<Record<PresentationSceneId, string>>
}

type PersistedPresentationState = Partial<PresentationState>
type ExtendedWorkspaceState = WorkspaceState & { presentationState?: PersistedPresentationState }

const defaultOrder: PresentationSceneId[] = ['thesis', 'performance', 'signal', 'decision']

function validSceneId(value: unknown): value is PresentationSceneId {
  return value === 'thesis' || value === 'performance' || value === 'signal' || value === 'decision'
}

function normalizePresentationState(value?: PersistedPresentationState): PresentationState {
  const seen = new Set<PresentationSceneId>()
  const order = (value?.order ?? []).filter(validSceneId).filter((id) => { if (seen.has(id)) return false; seen.add(id); return true })
  for (const id of defaultOrder) if (!seen.has(id)) order.push(id)
  const hiddenSceneIds = [...new Set((value?.hiddenSceneIds ?? []).filter(validSceneId))]
  const notes: PresentationState['notes'] = {}
  for (const id of defaultOrder) {
    const note = value?.notes?.[id]
    if (typeof note === 'string' && note.trim()) notes[id] = note
  }
  return { order, hiddenSceneIds, notes }
}

export function getPresentationState(workspace: WorkspaceState): PresentationState {
  return normalizePresentationState((workspace as ExtendedWorkspaceState).presentationState)
}

function ensurePresentationGraph(workspace: WorkspaceState) {
  const objects = [...workspace.graph.objects]
  const edges = [...workspace.graph.edges]
  const objectIds = new Set(objects.map((object) => object.id))
  const edgeKeys = new Set(edges.map((edge) => `${edge.from}|${edge.to}|${edge.relation}`))
  const addObject = (object: WorkspaceObject) => { if (!objectIds.has(object.id)) { objectIds.add(object.id); objects.push(object) } }
  const addEdge = (edge: DependencyEdge) => { const key = `${edge.from}|${edge.to}|${edge.relation}`; if (!edgeKeys.has(key)) { edgeKeys.add(key); edges.push(edge) } }
  addObject({ id:'scene:thesis', kind:'scene', label:'Board narrative · Thesis', surfaces:['present'] })
  addObject({ id:'scene:signal', kind:'scene', label:'Board narrative · Signal', surfaces:['present'] })
  addEdge({ from:'document:strategy', to:'scene:thesis', relation:'renders', description:'Strategy thesis renders in the opening scene' })
  addEdge({ from:'metric:growth', to:'scene:signal', relation:'renders', description:'Growth evidence informs the signal scene' })
  return { objects, edges }
}

export function withPresentationState(workspace: WorkspaceState, state: PresentationState): WorkspaceState {
  return {
    ...workspace,
    graph: ensurePresentationGraph(workspace),
    presentationState: normalizePresentationState(state),
  } as WorkspaceState
}

export function materializePresentationState(workspace: WorkspaceState): WorkspaceState {
  return withPresentationState(workspace, getPresentationState(workspace))
}
