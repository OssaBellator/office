import type { WorkspaceState } from './model.ts'
import { getImportedTables, importedTableCellKey } from './importedTables.ts'
import { getPresentationState } from './presentationState.ts'
import { getSemanticDocument } from './semanticDocument.ts'

export type WorkspaceVersionValue = string | number | boolean | null
export type WorkspaceVersionDiff = { objectId: string; label: string; field: string; before: WorkspaceVersionValue; after: WorkspaceVersionValue; change: 'changed' | 'added' | 'removed' }
function objectLabel(workspace: WorkspaceState, objectId: string) { return workspace.graph.objects.find((object) => object.id === objectId)?.label ?? objectId }
function add(diffs: WorkspaceVersionDiff[], workspace: WorkspaceState, objectId: string, field: string, before: WorkspaceVersionValue | undefined, after: WorkspaceVersionValue | undefined) {
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
    if(l.type==='paragraph'&&r.type==='paragraph'){
      add(diffs,after,id,'text',l.text,r.text)
      add(diffs,after,id,'style',l.style??'body',r.style??'body')
      add(diffs,after,id,'source',l.source??null,r.source??null)
    } else add(diffs,after,id,'content',JSON.stringify(l),JSON.stringify(r))
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
  for (const id of new Set([...beforePresentation.order,...afterPresentation.order])) add(diffs, after, `scene:${id}`, 'speakerNote', beforePresentation.notes[id] ?? null, afterPresentation.notes[id] ?? null)
  const beforeImportedScenes=beforePresentation.importedScenes??[],afterImportedScenes=afterPresentation.importedScenes??[]
  for(const id of new Set([...beforeImportedScenes.map((scene)=>scene.id),...afterImportedScenes.map((scene)=>scene.id)])){
    const l=beforeImportedScenes.find((scene)=>scene.id===id),r=afterImportedScenes.find((scene)=>scene.id===id)
    if(!l||!r){add(diffs,after,`scene:${id}`,'importedSlide',l?JSON.stringify(l):null,r?JSON.stringify(r):null);continue}
    add(diffs,after,`scene:${id}`,'title',l.title,r.title);add(diffs,after,`scene:${id}`,'body',l.body.join('\n'),r.body.join('\n'));add(diffs,after,`scene:${id}`,'source',l.source,r.source);add(diffs,after,`scene:${id}`,'importedNote',l.note??null,r.note??null)
  }

  const beforeTables=getImportedTables(before),afterTables=getImportedTables(after)
  for(const id of new Set([...beforeTables.map((table)=>table.id),...afterTables.map((table)=>table.id)])){
    const l=beforeTables.find((table)=>table.id===id),r=afterTables.find((table)=>table.id===id)
    if(!l||!r){add(diffs,after,`table:${id}`,'importedTable',l?JSON.stringify(l):null,r?JSON.stringify(r):null);continue}
    add(diffs,after,`table:${id}`,'label',l.label,r.label);add(diffs,after,`table:${id}`,'source',l.source,r.source);add(diffs,after,`table:${id}`,'sourceVisibility',l.sourceVisibility??'visible',r.sourceVisibility??'visible');add(diffs,after,`table:${id}`,'sourceDateSystem',l.sourceDateSystem??'1900',r.sourceDateSystem??'1900')
    const beforeColumns=new Map(l.columns.map((column)=>[column.id,column])),afterColumns=new Map(r.columns.map((column)=>[column.id,column]))
    for(const columnId of new Set([...beforeColumns.keys(),...afterColumns.keys()])){
      const lc=beforeColumns.get(columnId),rc=afterColumns.get(columnId)
      if(!lc||!rc){add(diffs,after,`table:${id}:column:${columnId}`,'column',lc?JSON.stringify(lc):null,rc?JSON.stringify(rc):null);continue}
      add(diffs,after,`table:${id}:column:${columnId}`,'label',lc.label,rc.label);add(diffs,after,`table:${id}:column:${columnId}`,'type',lc.type,rc.type)
    }
    const beforeRows=new Map(l.rows.map((row)=>[row.id,row])),afterRows=new Map(r.rows.map((row)=>[row.id,row]))
    for(const rowId of new Set([...beforeRows.keys(),...afterRows.keys()])){
      const lr=beforeRows.get(rowId),rr=afterRows.get(rowId)
      if(!lr||!rr){add(diffs,after,`table:${id}:${rowId}`,'row',lr?JSON.stringify(lr.values):null,rr?JSON.stringify(rr.values):null);continue}
      for(const columnId of new Set([...Object.keys(lr.values),...Object.keys(rr.values)])){
        const label=afterColumns.get(columnId)?.label??beforeColumns.get(columnId)?.label??columnId
        add(diffs,after,`table:${id}:${rowId}`,label,lr.values[columnId]??null,rr.values[columnId]??null)
        const cellKey=importedTableCellKey(rowId,columnId)
        add(diffs,after,`table:${id}:${rowId}`,`${label} formula`,l.formulaByCell?.[cellKey]??null,r.formulaByCell?.[cellKey]??null)
        const leftFormat=l.numberFormatByCell?.[cellKey],rightFormat=r.numberFormatByCell?.[cellKey]
        add(diffs,after,`table:${id}:${rowId}`,`${label} number format`,leftFormat?JSON.stringify(leftFormat):null,rightFormat?JSON.stringify(rightFormat):null)
        const leftLink=l.linkByCell?.[cellKey],rightLink=r.linkByCell?.[cellKey]
        add(diffs,after,`table:${id}:${rowId}`,`${label} hyperlink`,leftLink?JSON.stringify(leftLink):null,rightLink?JSON.stringify(rightLink):null)
      }
    }
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
