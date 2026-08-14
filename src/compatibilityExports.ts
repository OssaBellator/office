import { formatMetric, type WorkspaceState } from './model.ts'
import { buildPresentationScenes } from './presentationModel.ts'
import { getSemanticDocument, resolveSemanticClaim } from './semanticDocument.ts'

export type WorkspaceExportBundle = {
  'strategy.md': string
  'regions.csv': string
  'plan.csv': string
  'board-narrative.md': string
}

function csvCell(value: string | number) {
  const text = String(value)
  if (!/[",\n\r]/.test(text)) return text
  return `"${text.replace(/"/g, '""')}"`
}

function csv(rows: Array<Array<string | number>>) {
  return `${rows.map((row) => row.map(csvCell).join(',')).join('\n')}\n`
}

export function exportRegionsCsv(workspace: WorkspaceState) {
  return csv([
    ['Region','Revenue','Growth','Margin'],
    ...workspace.regions.map((row) => [row.region,row.revenue,row.growth,row.margin]),
  ])
}

export function exportPlanCsv(workspace: WorkspaceState) {
  return csv([
    ['Region','Revenue'],
    ...workspace.plans.map((row) => [row.region,row.revenue]),
  ])
}

function annotationMarkdown(kind: string, status: string, owner: string, body: string) {
  const marker = kind === 'task' ? (status === 'resolved' ? '[x]' : '[ ]') : kind === 'approval' ? (status === 'approved' ? '✅' : '⏳') : '💬'
  return `- ${marker} **${kind}** · ${owner} · ${status}: ${body}`
}

export function exportStrategyMarkdown(workspace: WorkspaceState) {
  const semantic = getSemanticDocument(workspace)
  const lines: string[] = [`# ${workspace.document.title}`, '', workspace.document.summary, '']
  for (const block of semantic.blocks) {
    if (block.type === 'paragraph') lines.push(block.text, '')
    if (block.type === 'claim') {
      const claim = semantic.claims.find((item) => item.id === block.claimId)
      if (claim) {
        const resolved = resolveSemanticClaim(workspace, claim.id)
        lines.push(`> **${resolved.status.toUpperCase()} · ${claim.confidence} confidence** — ${claim.statement}`, `> ${claim.rationale}`, '')
        const citations = claim.citationIds.map((id) => semantic.citations.find((item) => item.id === id)).filter(Boolean)
        for (const citation of citations) {
          const source = workspace.sources.find((item) => item.id === citation!.sourceId)
          lines.push(`- Source: **${source?.label ?? citation!.sourceId}** — ${citation!.locator} (${source?.status ?? 'missing'})`)
        }
        if (citations.length) lines.push('')
      }
    }
    if (block.type === 'metric-embed') {
      lines.push(`## ${block.label}`, '', '| Metric | Value | Definition |', '| --- | ---: | --- |')
      for (const metricId of block.metricIds) {
        const metric = workspace.metrics.find((item) => item.id === metricId)
        if (metric) lines.push(`| ${metric.label} | ${formatMetric(metric)} | ${metric.formula ?? 'Manual'} |`)
      }
      lines.push('')
    }
    if (block.type === 'decision-embed') {
      const decision = workspace.decisions.find((item) => item.id === block.decisionId)
      if (decision) lines.push('## Decision', '', `**${decision.title}** — ${decision.status}`, '', decision.rationale, '', `Owner: ${decision.owner}`, '')
    }
    const reviews = semantic.annotations.filter((annotation) => annotation.blockId === block.id)
    if (reviews.length) {
      lines.push('### Review')
      for (const review of reviews) lines.push(annotationMarkdown(review.kind, review.status, review.owner, review.body))
      lines.push('')
    }
  }
  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`
}

export function exportPresentationMarkdown(workspace: WorkspaceState) {
  const scenes = buildPresentationScenes(workspace)
  const lines = [`# ${workspace.title} — Board narrative`, '']
  for (const scene of scenes) {
    lines.push(`## ${scene.eyebrow} — ${scene.title}`, '', `Source: ${scene.source}`, '', `Speaker note: ${scene.note}`, '')
  }
  return `${lines.join('\n').trim()}\n`
}

export function exportWorkspaceBundle(workspace: WorkspaceState): WorkspaceExportBundle {
  return {
    'strategy.md': exportStrategyMarkdown(workspace),
    'regions.csv': exportRegionsCsv(workspace),
    'plan.csv': exportPlanCsv(workspace),
    'board-narrative.md': exportPresentationMarkdown(workspace),
  }
}
