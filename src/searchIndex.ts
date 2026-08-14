import { formatMetric, type Surface, type WorkspaceState } from './model.ts'
import { buildAllPresentationScenes } from './presentationModel.ts'
import { getSemanticDocument, resolveSemanticClaim } from './semanticDocument.ts'

export type SearchObjectKind = 'document'|'block'|'claim'|'citation'|'metric'|'region'|'plan'|'decision'|'chart'|'relationship'|'source'|'scene'|'review'
export type WorkspaceSearchRecord = {
  id: string
  kind: SearchObjectKind
  title: string
  text: string
  surfaces: Surface[]
}
export type WorkspaceSearchResult = WorkspaceSearchRecord & { score: number; matchedTerms: string[] }

function normalize(value: string) { return value.toLowerCase().replace(/[^a-z0-9%$]+/g,' ').trim() }
function record(id:string,kind:SearchObjectKind,title:string,text:string,surfaces:Surface[]):WorkspaceSearchRecord{return{id,kind,title,text,surfaces}}

export function buildWorkspaceSearchIndex(workspace: WorkspaceState): WorkspaceSearchRecord[] {
  const semantic = getSemanticDocument(workspace)
  const records: WorkspaceSearchRecord[] = [
    record('document:strategy','document',workspace.document.title,`${workspace.document.eyebrow} ${workspace.document.summary}`,['docs']),
  ]
  for (const block of semantic.blocks) {
    if (block.type === 'paragraph') records.push(record(block.id,'block','Strategy paragraph',block.text,['docs']))
    if (block.type === 'claim') {
      const claim = semantic.claims.find((item) => item.id === block.claimId)
      if (claim) { const resolved=resolveSemanticClaim(workspace,claim.id);records.push(record(claim.id,'claim',claim.statement,`${claim.rationale} ${claim.confidence} ${resolved.status} ${resolved.sourceLabels.join(' ')}`,['docs'])) }
    }
    if (block.type === 'metric-embed') records.push(record(block.id,'block',block.label,block.metricIds.join(' '),['docs']))
    if (block.type === 'decision-embed') records.push(record(block.id,'block','Decision embed',block.decisionId,['docs']))
  }
  for (const citation of semantic.citations) records.push(record(citation.id,'citation',citation.label,`${citation.locator} ${citation.sourceId} ${citation.evidenceObjectId}`,['docs']))
  for (const annotation of semantic.annotations) records.push(record(annotation.id,'review',`${annotation.kind} · ${annotation.owner}`,`${annotation.body} ${annotation.status} ${annotation.blockId}`,['docs']))
  for (const metric of workspace.metrics) records.push(record(`metric:${metric.id}`,'metric',metric.label,`${formatMetric(metric)} ${metric.formula ?? ''} ${metric.source}`,['data','docs','present']))
  for (const row of workspace.regions) records.push(record(`region:${row.id}`,'region',row.region,`revenue ${row.revenue} growth ${row.growth}% margin ${row.margin}%`,['data']))
  for (const row of workspace.plans) records.push(record(`plan:${row.id}`,'plan',`${row.region} plan`,`revenue ${row.revenue}`,['data']))
  for (const decision of workspace.decisions) records.push(record(`decision:${decision.id}`,'decision',decision.title,`${decision.status} ${decision.owner} ${decision.rationale}`,['docs','present']))
  for (const chart of workspace.charts) records.push(record(`chart:${chart.id}`,'chart',chart.label,`${chart.kind} ${chart.relationshipId} ${chart.series.map((series)=>`${series.tableId}.${series.fieldId}`).join(' ')}`,['data','present']))
  for (const relationship of workspace.relationships) records.push(record(relationship.id,'relationship',relationship.label,`${relationship.fromTable}.${relationship.fromField} ${relationship.toTable}.${relationship.toField} ${relationship.cardinality}`,['data']))
  for (const source of workspace.sources) records.push(record(source.id,'source',source.label,`${source.type} ${source.locator} ${source.status}`,['docs','data']))
  for (const scene of buildAllPresentationScenes(workspace)) records.push(record(`scene:${scene.id}`,'scene',scene.title,`${scene.eyebrow} ${scene.note} ${scene.source}`,['present']))
  return records
}

function scoreRecord(record: WorkspaceSearchRecord, terms: string[]) {
  const title = normalize(record.title), text = normalize(record.text), id = normalize(record.id)
  let score = 0
  const matchedTerms: string[] = []
  for (const term of terms) {
    if (!term) continue
    if (title === term) { score += 12; matchedTerms.push(term); continue }
    if (title.startsWith(term)) { score += 8; matchedTerms.push(term); continue }
    if (title.includes(term)) { score += 6; matchedTerms.push(term); continue }
    if (id.includes(term)) { score += 4; matchedTerms.push(term); continue }
    if (text.includes(term)) { score += 2; matchedTerms.push(term); continue }
  }
  if (matchedTerms.length !== terms.length) return null
  return { score, matchedTerms }
}

export function searchWorkspace(workspace: WorkspaceState, query: string, options: { limit?: number; surface?: Surface; kinds?: SearchObjectKind[] } = {}): WorkspaceSearchResult[] {
  const terms = normalize(query).split(/\s+/).filter(Boolean)
  if (!terms.length) return []
  return buildWorkspaceSearchIndex(workspace)
    .filter((item) => !options.surface || item.surfaces.includes(options.surface))
    .filter((item) => !options.kinds || options.kinds.includes(item.kind))
    .flatMap((item) => { const scored=scoreRecord(item,terms);return scored?[{...item,...scored}]:[] })
    .sort((left,right) => right.score - left.score || left.title.localeCompare(right.title))
    .slice(0, options.limit ?? 20)
}
