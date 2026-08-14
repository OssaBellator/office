import { formatMetric, type WorkspaceState } from './model.ts'
import { deriveGrowthLeaderClaim } from './knowledge.ts'
import { getPresentationState, type PresentationSceneId } from './presentationState.ts'
import { ensureWorkspaceKpis, REVENUE_ATTAINMENT_METRIC_ID } from './workspaceKpis.ts'

export type { PresentationSceneId } from './presentationState.ts'
export type PresentationScene = { id: PresentationSceneId; eyebrow: string; title: string; note: string; source: string; body?: string[]; imported?: boolean }

function buildBaseScenes(input: WorkspaceState): PresentationScene[] {
  const workspace = ensureWorkspaceKpis(input)
  const state = getPresentationState(workspace)
  const revenue = workspace.metrics.find((metric) => metric.id === 'revenue')
  const growth = workspace.metrics.find((metric) => metric.id === 'growth')
  const decision = workspace.decisions[0]
  const planRevenue = workspace.metrics.find((metric) => metric.id === 'planRevenue')
  const variance = workspace.metrics.find((metric) => metric.id === 'variance')
  const attainment = workspace.metrics.find((metric) => metric.id === REVENUE_ATTAINMENT_METRIC_ID)
  const claim = deriveGrowthLeaderClaim(workspace)
  if (!revenue || !growth || !planRevenue || !variance || !attainment || !decision) throw new Error('Presentation requires revenue, plan, attainment, variance, growth, and decision objects')
  const leader = workspace.regions.find((row) => claim.evidenceObjectIds.includes(`region:${row.id}`))!

  return [
    { id:'thesis', eyebrow:'Thesis', title:workspace.document.title, note:'Open with the operating-model thesis: the interfaces stay specialised, while the work underneath becomes one connected system.', source:'Strategy document · live' },
    { id:'performance', eyebrow:'Performance', title:`${formatMetric(revenue)} revenue · ${formatMetric(attainment)} of plan`, note:`Revenue is ${Math.abs(variance.value).toFixed(1)}M ${variance.value >= 0 ? 'above' : 'below'} plan at ${formatMetric(attainment)} attainment. Lead with attainment and variance together, then use the next scene to explain which region changes the allocation decision.`, source:'Finance model · Revenue attainment · Q2 FY27 · live' },
    { id:'signal', eyebrow:'Signal', title:claim.statement, note:`Make the tradeoff explicit: ${leader.region} has the strongest growth signal, but its margin should constrain how aggressively we scale.`, source:`Finance model · Regions · ${leader.region} · live` },
    { id:'decision', eyebrow:'Decision', title:decision.title, note:decision.status === 'approved' ? 'Close by restating the approved direction and the operating constraint.' : 'Close with a crisp approval request and the evidence that still needs validation.', source:'Shared decision object · live' },
    ...(state.importedScenes ?? []).map((scene): PresentationScene => ({ id:scene.id, eyebrow:'Imported slide', title:scene.title, body:scene.body, note:scene.note ?? 'Imported speaker notes were not available for this slide.', source:scene.source, imported:true })),
  ]
}

export function buildAllPresentationScenes(workspace: WorkspaceState): PresentationScene[] {
  const state = getPresentationState(workspace)
  const byId = new Map(buildBaseScenes(workspace).map((scene) => [scene.id, scene]))
  return state.order.flatMap((id) => {
    const scene = byId.get(id)
    if (!scene) return []
    return [{ ...scene, note: state.notes[id] ?? scene.note }]
  })
}

export function buildPresentationScenes(workspace: WorkspaceState): PresentationScene[] {
  const state = getPresentationState(workspace)
  return buildAllPresentationScenes(workspace)
    .filter((scene) => !state.hiddenSceneIds.includes(scene.id))
    .map((scene, index) => ({ ...scene, eyebrow: `${String(index + 1).padStart(2, '0')} · ${scene.eyebrow}` }))
}
