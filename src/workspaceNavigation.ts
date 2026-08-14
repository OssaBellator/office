import { getImportedTables } from './importedTables.ts'
import { getPresentationState } from './presentationState.ts'
import { getSemanticDocument } from './semanticDocument.ts'
import type { Surface, WorkspaceState } from './model.ts'

export type WorkspaceObjectLocation = {
  objectId: string
  label: string
  surface: Surface
  secondarySurfaces: Surface[]
  focus: string
}

function preferredSurface(surfaces: Surface[], objectId: string): Surface {
  if (objectId.startsWith('scene:')) return 'present'
  if (objectId.startsWith('region:') || objectId.startsWith('plan:') || objectId.startsWith('metric:') || objectId.startsWith('chart:') || objectId.startsWith('relationship:') || objectId.startsWith('table:')) return 'data'
  if (objectId.startsWith('block:') || objectId.startsWith('claim:') || objectId.startsWith('citation:') || objectId.startsWith('annotation:') || objectId.startsWith('decision:') || objectId.startsWith('source:')) return 'docs'
  return surfaces[0] ?? 'docs'
}

export function locateWorkspaceObject(workspace: WorkspaceState, objectId: string): WorkspaceObjectLocation {
  const graphObject = workspace.graph.objects.find((object) => object.id === objectId)
  if (graphObject) {
    const surface = preferredSurface(graphObject.surfaces, objectId)
    return { objectId, label:graphObject.label, surface, secondarySurfaces:graphObject.surfaces.filter((item) => item !== surface), focus:objectId }
  }
  if (objectId.startsWith('relationship:')) {
    const relationship = workspace.relationships.find((item) => item.id === objectId)
    if (relationship) return { objectId, label:relationship.label, surface:'data', secondarySurfaces:[], focus:objectId }
  }
  if (objectId.startsWith('table:')) {
    const id=objectId.replace(/^table:/,'')
    const table=getImportedTables(workspace).find((item)=>item.id===id)
    if(table)return{objectId,label:table.label,surface:'data',secondarySurfaces:[],focus:objectId}
  }
  if (objectId.startsWith('source:')) {
    const source = workspace.sources.find((item) => item.id === objectId)
    if (source) return { objectId, label:source.label, surface:'docs', secondarySurfaces:['data'], focus:objectId }
  }
  const semantic = getSemanticDocument(workspace)
  const block = semantic.blocks.find((item) => item.id === objectId)
  if (block) return { objectId, label:block.type === 'paragraph' ? 'Strategy paragraph' : block.type, surface:'docs', secondarySurfaces:[], focus:objectId }
  const sceneId = objectId.replace(/^scene:/,'')
  if (getPresentationState(workspace).order.includes(sceneId as never)) return { objectId, label:`Board narrative · ${sceneId}`, surface:'present', secondarySurfaces:[], focus:objectId }
  throw new Error(`Unknown workspace object: ${objectId}`)
}

export function buildWorkspaceDeepLink(workspaceId: string, location: WorkspaceObjectLocation) {
  const params = new URLSearchParams({ surface:location.surface, object:location.objectId })
  return `frame://workspace/${encodeURIComponent(workspaceId)}?${params.toString()}`
}

export function resolveWorkspaceDeepLink(url: string) {
  const parsed = new URL(url)
  if (parsed.protocol !== 'frame:' || parsed.hostname !== 'workspace') throw new Error('Not a Frame workspace deep link')
  const workspaceId = decodeURIComponent(parsed.pathname.replace(/^\//,''))
  const surface = parsed.searchParams.get('surface')
  const objectId = parsed.searchParams.get('object')
  if (!workspaceId || !objectId || !['docs','data','present'].includes(surface ?? '')) throw new Error('Invalid Frame workspace deep link')
  return { workspaceId, surface:surface as Surface, objectId }
}
