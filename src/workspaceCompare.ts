import type { WorkspaceState } from './model.ts'
import { getPresentationState } from './presentationState.ts'
import { getSemanticDocument } from './semanticDocument.ts'

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

  const beforeSemantic = getSemanticDocument(before), afterSemantic = getSemanticDocument(after)
  for (const id of new Set([...beforeSemantic.blocks.map((x)=>x.id),...afterSemantic.blocks.map((x)=>x.id)])) {
    const l=beforeSemantic.blocks.find((x)=>x.id===id),r=afterSemantic.blocks.find((x)=>x.id===id)
    if(!l||!r){add(diffs,after,id,'block',l?JSON.stringify(l):null,r?JSON.stringify(r):null);continue}
    add(diffs,after,id,'type',l.type,r.type)
    if(l.type==='paragraph'&&r.type==='paragraph')add(diffs,after,id,'text',l.text,r.text)
    else add(diffs,after,id,'content',JSON.stringify(l),JSON.stringify(r))
    add(diffs,after,id,'position',beforeSemantic.blocks.findIndex((x)=>x.id===id),afterSemantic.blocks.findIndex((x)=>x.id===id))
  }
  for (const id of new Set([...beforeSemantic.claims.map((x)=>x.id),...afterSemantic.claims.map((x)=>x.id)])) {
    const l=beforeSemantic.claims.find((x)=>x.id===id),r=afterSemantic.claims.find((x)=>x.id===id)
    if(!l||!r){add(diffs,after,id,'claim',l?JSON.stringify(l):null,r?JSON.stringify(r):null);continue}
    add(diffs,after,id,'statement',l.statement,r.statement);add(diffs,after,id,'rationale',l.rationale,r.rationale);add(diffs,after,id,'confidence',l.confidence,r.confidence);add(diffs,after,id,'citations',l.citationIds.join(', '),r.citationIds.join(', '))
  }
  for (const id of new Set([...beforeSemantic.citations.map((x)=>x.id),...afterSemantic.citations.map((x)=>x.id)])) {
    const l=beforeSemantic.citations.find((x)=>x.id===id),r=afterSemantic.citations.find((x)=>x.id===id)
    if(!l||!r){add(diffs,after,id,'citation',l?JSON.stringify(l):null,r?JSON.stringify(r):null);continue}
    add(diffs,after,id,'label',l.label,r.label);add(diffs,after,id,'locator',l.locator,r.locator);add(diffs,after,id,'source',l.sourceId,r.sourceId);add(diffs,after,id,'evidence',l.evidenceObjectId,r.evidenceObjectId)
  }
  for (const id of new Set([...beforeSemantic.annotations.map((x)=>x.id),...afterSemantic.annotations.map((x)=>x.id)])) {
    const l=beforeSemantic.annotations.find((x)=>x.id===id),r=afterSemantic.annotations.find((x)=>x.id===id)
    if(!l||!r){add(diffs,after,id,'annotation',l?JSON.stringify(l):null,r?JSON.stringify(r):null);continue}
    add(diffs,after,id,'body',l.body,r.body);add(diffs,after,id,'owner',l.owner,r.owner);add(diffs,after,id,'status',l.status,r.status);add(diffs,after,id,'block',l.blockId,r.blockId)
  }

  const beforePresentation = getPresentationState(before), afterPresentation = getPresentationState(after)
  add(diffs, after, 'presentation:story', 'order', beforePresentation.order.join(' → '), afterPresentation.order.join(' → '))
  add(diffs, after, 'presentation:story', 'hiddenScenes', beforePresentation.hiddenSceneIds.join(', '), afterPresentation.hiddenSceneIds.join(', '))
  for (const id of new Set([...beforePresentation.order,...afterPresentation.order])) {
    add(diffs, after, `scene:${id}`, 'speakerNote', beforePresentation.notes[id] ?? null, afterPresentation.notes[id] ?? null)
  }

  for (const id of new Set([...before.charts.map((x)=>x.id),...after.charts.map((x)=>x.id)])) {
    const l=before.charts.find((x)=>x.id===id),r=after.charts.find((x)=>x.id===id)
    if(!l||!r){add(diffs,after,`chart:${id}`,'object',l?JSON.stringify(l):null,r?JSON.stringify(r):null);continue}
    add(diffs,after,`chart:${id}`,'label',l.label,r.label);add(diffs,after,`chart:${id}`,'kind',String(l.kind),String(r.kind));add(diffs,after,`chart:${id}`,'relationship',l.relationshipId,r.relationshipId);add(diffs,after,`chart:${id}`,'definition',JSON.stringify({category:l.category,series:l.series}),JSON.stringify({category:r.category,series:r.series}))
  }
  for (const id of new Set([...before.metrics.map((x)=>x.id),...after.metrics.map((x)=>x.id)])) {
    const l=before.metrics.find((x)=>x.id===id),r=after.metrics.find((x)=>x.id===id); if(!l||!r){add(diffs,after,`metric:${id}`,'object',l?JSON.stringify(l):null,r?JSON.stringify(r):null);continue}
    add(diffs,after,`metric:${id}`,'value',l.value,r.value); add(diffs,after,`metric:${id}`,'formula',l.formula,r.formula); add(diffs,after,`metric:${id}`,'source',l.source,r.source)
  }
  for (const id of new Set([...before.regions.map((x)=>x.id),...after.regions.map((x)=>x.id)])) {
    const l=before.regions.find((x)=>x.id===id),r=after.regions.find((x)=>x.id===id); if(!l||!r){add(diffs,after,`region:${id}`,'object',l?JSON.stringify(l):null,r?JSON.stringify(r):null);continue}
    for(const field of ['region','revenue','growth','margin'] as const)add(diffs,after,`region:${id}`,field,l[field],r[field])
  }
  for (const id of new Set([...before.plans.map((x)=>x.id),...after.plans.map((x)=>x.id)])) {
    const l=before.plans.find((x)=>x.id===id),r=after.plans.find((x)=>x.id===id); if(!l||!r){add(diffs,after,`plan:${id}`,'object',l?JSON.stringify(l):null,r?JSON.stringify(r):null);continue}
    for(const field of ['region','revenue'] as const)add(diffs,after,`plan:${id}`,field,l[field],r[field])
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