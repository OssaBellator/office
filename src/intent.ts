import { deriveGrowthLeaderClaim } from './knowledge.ts'
import { getPresentationState, type PresentationSceneId } from './presentationState.ts'
import { makeGrowthEvidenceInsertion } from './semanticDocument.ts'
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
function semanticId(prefix: string) { return `${prefix}:${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}` }
function sceneId(value: string): PresentationSceneId | null {
  const normalized = normalize(value)
  if (normalized === 'thesis' || normalized === 'opening' || normalized === 'intro') return 'thesis'
  if (normalized === 'performance' || normalized === 'revenue') return 'performance'
  if (normalized === 'signal' || normalized === 'growth') return 'signal'
  if (normalized === 'decision' || normalized === 'approval') return 'decision'
  return null
}

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

  if (/^(?:\/claim|\/evidence|add|append|insert) evidence(?: to (?:the )?strategy)?$/i.test(query) || /^\/claim$/i.test(query)) {
    const insertion = makeGrowthEvidenceInsertion(workspace)
    return { kind: 'command', label: 'Insert grounded evidence claim', command: { type: 'document.block.insert', ...insertion } }
  }

  const slashParagraph = query.match(/^\/paragraph(?:\s+(.+))?$/i)
  if (slashParagraph) {
    return { kind: 'command', label: 'Insert paragraph block', command: { type: 'document.block.insert', block: { id: semanticId('block'), type: 'paragraph', text: slashParagraph[1]?.trim() || 'New paragraph' } } }
  }
  if (/^\/(?:metrics|metric|snapshot)$/i.test(query)) {
    return { kind: 'command', label: 'Insert live metric block', command: { type: 'document.block.insert', block: { id: semanticId('block'), type: 'metric-embed', label: 'Live metrics', metricIds: workspace.metrics.map((metric) => metric.id) } } }
  }
  if (/^\/decision$/i.test(query)) {
    const decision = workspace.decisions[0]
    if (!decision) return { kind: 'error', message: 'No shared decision exists in this workspace.' }
    return { kind: 'command', label: 'Insert decision block', command: { type: 'document.block.insert', block: { id: semanticId('block'), type: 'decision-embed', decisionId: decision.id } } }
  }

  const visibilityMatch = query.match(/^(hide|show)\s+(?:the\s+)?(thesis|opening|intro|performance|revenue|signal|growth|decision|approval)\s+scene$/i)
  if (visibilityMatch) {
    const id = sceneId(visibilityMatch[2])!
    const visible = visibilityMatch[1].toLowerCase() === 'show'
    return { kind: 'command', label: `${visible ? 'Show' : 'Hide'} ${id} scene`, command: { type: 'presentation.scene.visibility', sceneId: id, visible } }
  }
  const moveSceneMatch = query.match(/^move\s+(?:the\s+)?(thesis|opening|intro|performance|revenue|signal|growth|decision|approval)\s+scene\s+(first|last)$/i)
  if (moveSceneMatch) {
    const id = sceneId(moveSceneMatch[1])!
    const state = getPresentationState(workspace)
    const toIndex = moveSceneMatch[2].toLowerCase() === 'first' ? 0 : state.order.length - 1
    return { kind: 'command', label: `Move ${id} scene ${moveSceneMatch[2].toLowerCase()}`, command: { type: 'presentation.scene.move', sceneId: id, toIndex } }
  }
  const noteMatch = query.match(/^(?:set|update|change)\s+(?:the\s+)?(thesis|opening|intro|performance|revenue|signal|growth|decision|approval)\s+(?:scene\s+)?(?:speaker\s+)?note\s+(?:to\s+)?(.+)$/i)
  if (noteMatch) {
    const id = sceneId(noteMatch[1])!
    return { kind: 'command', label: `Update ${id} speaker note`, command: { type: 'presentation.note.update', sceneId: id, note: noteMatch[2].trim() } }
  }

  const titleMatch = query.match(/^(?:set|change|update)\s+(?:strategy\s+|document\s+)?title\s+(?:to\s+)?(.+)$/i)
  if (titleMatch) return { kind: 'command', label: 'Update strategy title', command: { type: 'document.update', field: 'title', value: titleMatch[1].trim() } }

  const appendMatch = query.match(/^(?:append|add)\s+(?:to\s+)?(?:the\s+)?strategy\s*:\s*(.+)$/i)
  if (appendMatch) return { kind: 'command', label: 'Append text to strategy', command: { type: 'document.append', text: appendMatch[1].trim() } }

  const sourceMatch = query.match(/^(?:mark|set)\s+(?:the\s+)?(?:finance(?: model)?|finance source)\s+(?:source\s+)?(?:as\s+)?(live|stale)$/i)
  if (sourceMatch) return { kind: 'command', label: `Mark Finance model ${sourceMatch[1].toLowerCase()}`, command: { type: 'source.status', sourceId: 'source:finance', status: sourceMatch[1].toLowerCase() as 'live' | 'stale' } }

  const chartMatch = query.match(/^(?:\/chart\s+|(?:set|change|update)\s+(?:the\s+)?(?:actual\s*(?:vs|versus)\s*plan|revenue(?:\s+comparison)?)\s+chart\s+(?:to\s+)?)(line|bars?|grouped bars?)$/i)
  if (chartMatch) {
    const chart = workspace.charts.find((candidate) => candidate.id === 'revenue-vs-plan')
    if (!chart) return { kind: 'error', message: 'The shared Actual vs plan chart is missing.' }
    const raw = chartMatch[1].toLowerCase()
    const kind = raw === 'line' ? 'line' as const : 'grouped-bar' as const
    return { kind: 'command', label: `Change ${chart.label} to ${kind === 'line' ? 'line' : 'grouped bars'}`, command: { type: 'chart.kind', chartId: chart.id, kind } }
  }

  const formulaMatch = query.match(/^(?:set|change|update)\s+(?:the\s+)?revenue\s+formula\s+(?:to\s+)?(.+)$/i)
  if (formulaMatch) {
    const formula = formulaMatch[1].trim()
    try { validateMetricFormula(workspace, 'revenue', formula) }
    catch (error) { return { kind: 'error', message: error instanceof Error ? error.message : 'Invalid revenue formula' } }
    return { kind: 'command', label: 'Update revenue formula', command: { type: 'metric.formula', metricId: 'revenue', formula } }
  }

  const planMatch = query.match(/^(?:set|change|update)\s+(.+?)\s+(?:revenue\s+)?plan\s+(?:to\s+)?\$?(-?(?:\d+(?:\.\d+)?|\.\d+))\s*m?$/i)
  if (planMatch) {
    const region = findRegion(workspace, planMatch[1])
    if (!region) return { kind: 'error', message: `Unknown region: ${planMatch[1].trim()}` }
    return { kind: 'command', label: `Update ${region.region} revenue plan`, command: { type: 'plan.update', planId: region.id, field: 'revenue', value: Number(planMatch[2]) } }
  }

  const regionMatch = query.match(/^(?:set|change|update)\s+(.+?)\s+(revenue|growth|margin)\s+(?:to\s+)?\$?(-?(?:\d+(?:\.\d+)?|\.\d+))\s*(?:m|%|percent)?$/i)
  if (regionMatch) {
    const region = findRegion(workspace, regionMatch[1])
    if (!region) return { kind: 'error', message: `Unknown region: ${regionMatch[1].trim()}` }
    const field = regionMatch[2].toLowerCase() as 'revenue' | 'growth' | 'margin'
    return {
      kind: 'command',
      label: `Update ${region.region} ${field}`,
      command: { type: 'region.update', regionId: region.id, field, value: Number(regionMatch[3]) },
    }
  }

  const leader = deriveGrowthLeaderClaim(workspace)
  return { kind: 'unknown', message: `I can insert semantic document blocks; edit actuals, plan values, formulas and the shared chart; reorder/hide scenes and edit speaker notes; manage source freshness and decisions; or navigate views. Current evidence leader: ${leader.statement}` }
}