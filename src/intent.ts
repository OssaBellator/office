import { deriveGrowthLeaderClaim } from './knowledge.ts'
import { validateMetricFormula, type VersionedWorkspaceCommand } from './semanticCommands.ts'
import type { Surface, WorkspaceState } from './model.ts'

export type PaletteIntent =
  | { kind: 'command'; label: string; command: VersionedWorkspaceCommand }
  | { kind: 'navigate'; label: string; surface: Surface }
  | { kind: 'history'; label: string }
  | { kind: 'undo'; label: string }
  | { kind: 'redo'; label: string }
  | { kind: 'error'; message: string }
  | { kind: 'unknown'; message: string }

function normalize(value: string) { return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() }
function findRegion(workspace: WorkspaceState, input: string) {
  const wanted = normalize(input)
  return workspace.regions.find((row) => normalize(row.region) === wanted || normalize(row.id) === wanted)
    ?? workspace.regions.find((row) => normalize(row.region).includes(wanted) || wanted.includes(normalize(row.region)))
}

export function parsePaletteIntent(input: string, workspace: WorkspaceState): PaletteIntent {
  const query = input.trim()
  if (!query) return { kind: 'unknown', message: 'Type an action, for example “set APAC revenue to 10”.' }
  const simple = normalize(query)

  if (/^(undo|undo last change)$/.test(simple)) return { kind: 'undo', label: 'Undo last semantic change' }
  if (/^(redo|redo last change)$/.test(simple)) return { kind: 'redo', label: 'Redo last semantic change' }
  if (/^(show|open|view) history$/.test(simple) || simple === 'history') return { kind: 'history', label: 'Open semantic history' }

  const nav: Array<[RegExp, Surface, string]> = [
    [/(?:open|show|go to|view)\s+(?:the\s+)?(?:data|model|spreadsheet|financial model|sheet)s?$/i, 'data', 'Open financial model'],
    [/(?:open|show|go to|view)\s+(?:the\s+)?(?:slides|presentation|present|deck)$/i, 'present', 'Open board narrative'],
    [/(?:open|show|go to|view)\s+(?:the\s+)?(?:doc|docs|document|strategy)$/i, 'docs', 'Open strategy document'],
  ]
  for (const [pattern, surface, label] of nav) if (pattern.test(query)) return { kind: 'navigate', surface, label }

  if (/^(approve|approve the|approve apac|approve the apac)(?: expansion)? decision$/i.test(query) || /^approve decision$/i.test(query)) {
    return { kind: 'command', label: 'Approve APAC expansion decision', command: { type: 'decision.status', decisionId: 'launch', status: 'approved' } }
  }
  if (/^(unapprove|reopen|mark pending)(?: the)?(?: apac)?(?: expansion)? decision$/i.test(query)) {
    return { kind: 'command', label: 'Mark APAC expansion decision pending', command: { type: 'decision.status', decisionId: 'launch', status: 'pending' } }
  }

  if (/^(add|append|insert) evidence(?: to (?:the )?strategy)?$/i.test(query)) {
    const claim = deriveGrowthLeaderClaim(workspace)
    return { kind: 'command', label: 'Append live evidence to strategy', command: { type: 'document.append', text: `Evidence: ${claim.statement} ${claim.rationale}` } }
  }

  const titleMatch = query.match(/^(?:set|change|update)\s+(?:strategy\s+|document\s+)?title\s+(?:to\s+)?(.+)$/i)
  if (titleMatch) return { kind: 'command', label: 'Update strategy title', command: { type: 'document.update', field: 'title', value: titleMatch[1].trim() } }

  const appendMatch = query.match(/^(?:append|add)\s+(?:to\s+)?(?:the\s+)?strategy\s*:\s*(.+)$/i)
  if (appendMatch) return { kind: 'command', label: 'Append text to strategy', command: { type: 'document.append', text: appendMatch[1].trim() } }

  const sourceMatch = query.match(/^(?:mark|set)\s+(?:the\s+)?(?:finance(?: model)?|finance source)\s+(?:source\s+)?(?:as\s+)?(live|stale)$/i)
  if (sourceMatch) return { kind: 'command', label: `Mark Finance model ${sourceMatch[1].toLowerCase()}`, command: { type: 'source.status', sourceId: 'source:finance', status: sourceMatch[1].toLowerCase() as 'live' | 'stale' } }

  const formulaMatch = query.match(/^(?:set|change|update)\s+(?:the\s+)?revenue\s+formula\s+(?:to\s+)?(.+)$/i)
  if (formulaMatch) {
    const formula = formulaMatch[1].trim()
    try { validateMetricFormula(workspace, 'revenue', formula) }
    catch (error) { return { kind: 'error', message: error instanceof Error ? error.message : 'Invalid revenue formula' } }
    return { kind: 'command', label: 'Update revenue formula', command: { type: 'metric.formula', metricId: 'revenue', formula } }
  }

  const regionMatch = query.match(/^(?:set|change|update)\s+(.+?)\s+(revenue|growth|margin)\s+(?:to\s+)?\$?(-?(?:\d+(?:\.\d+)?|\.\d+))\s*(?:m|%|percent)?$/i)
  if (regionMatch) {
    const region = findRegion(workspace, regionMatch[1])
    if (!region) return { kind: 'error', message: `Unknown region: ${regionMatch[1].trim()}` }
    const field = regionMatch[2].toLowerCase() as 'revenue' | 'growth' | 'margin'
    return { kind: 'command', label: `Update ${region.region} ${field}`, command: { type: 'region.update', regionId: region.id, field, value: Number(regionMatch[3]) } }
  }

  return { kind: 'unknown', message: 'I can edit regional metrics, formulas, source freshness, strategy text, decisions, navigate views, and open history.' }
}
