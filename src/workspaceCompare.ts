import type { WorkspaceState } from './model.ts'

export type WorkspaceVersionDiff = { objectId: string; label: string; field: string; before: string | number | null; after: string | number | null; change: 'changed' | 'added' | 'removed' }
function objectLabel(workspace: WorkspaceState, objectId: string) { return workspace.graph.objects.find((object) => object.id === objectId)?.label ?? objectId }
function add(diffs: WorkspaceVersionDiff[], workspace: WorkspaceState, objectId: string, field: string, before: string | number | null | undefined, after: string | number | null | undefined) {
  const left = before ?? null, right = after ?? null
  if (Object.is(left, right)) return
  diffs.push({ objectId, label: objectLabel(workspace, objectId), field, before: left, after: right, change: left === null ? 'added' : right === null ? 'removed' : 'changed' })
}

export function compareWorkspaceStates(before: WorkspaceState, after: WorkspaceState): WorkspaceVersionDiff[] {
  const diffs: WorkspaceVersionDiff[] = []
  add(diffs, after, 'workspace', 'title', before.title, after.title)
  for (const field of ['eyebrow','title','summary','body'] as const) add(diffs, after, 'document:strategy', field, before.document[field], after.document[field])
  for (const id of new Set([...before.metrics.map((x)=>x.id),...after.metrics.map((x)=>x.id)])) {
    const l=before.metrics.find((x)=>x.id===id),r=after.metrics.find((x)=>x.id===id); if(!l||!r){add(diffs,after,`metric:${id}`,'object',l?JSON.stringify(l):null,r?JSON.stringify(r):null);continue}
    add(diffs,after,`metric:${id}`,'value',l.value,r.value); add(diffs,after,`metric:${id}`,'formula',l.formula,r.formula); add(diffs,after,`metric:${id}`,'source',l.source,r.source)
  }
  for (const id of new Set([...before.regions.map((x)=>x.id),...after.regions.map((x)=>x.id)])) {
    const l=before.regions.find((x)=>x.id===id),r=after.regions.find((x)=>x.id===id); if(!l||!r){add(diffs,after,`region:${id}`,'object',l?JSON.stringify(l):null,r?JSON.stringify(r):null);continue}
    for(const field of ['region','revenue','growth','margin'] as const)add(diffs,after,`region:${id}`,field,l[field],r[field])
  }
  for (const id of new Set([...before.decisions.map((x)=>x.id),...after.decisions.map((x)=>x.id)])) {
    const l=before.decisions.find((x)=>x.id===id),r=after.decisions.find((x)=>x.id===id); if(!l||!r){add(diffs,after,`decision:${id}`,'object',l?JSON.stringify(l):null,r?JSON.stringify(r):null);continue}
    for(const field of ['title','status','owner','rationale'] as const)add(diffs,after,`decision:${id}`,field,l[field],r[field])
  }
  for (const id of new Set([...before.sources.map((x)=>x.id),...after.sources.map((x)=>x.id)])) {
    const l=before.sources.find((x)=>x.id===id),r=after.sources.find((x)=>x.id===id); if(!l||!r){add(diffs,after,id,'object',l?JSON.stringify(l):null,r?JSON.stringify(r):null);continue}
    add(diffs,after,id,'status',l.status,r.status); add(diffs,after,id,'locator',l.locator,r.locator)
  }
  return diffs
}
