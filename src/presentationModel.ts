import { formatMetric, type WorkspaceState } from './model.ts'
import { deriveGrowthLeaderClaim } from './knowledge.ts'

export type PresentationSceneId = 'thesis' | 'performance' | 'signal' | 'decision'
export type PresentationScene = { id: PresentationSceneId; eyebrow: string; title: string; note: string; source: string }

export function buildPresentationScenes(workspace: WorkspaceState): PresentationScene[] {
  const revenue = workspace.metrics.find((metric) => metric.id === 'revenue')
  const growth = workspace.metrics.find((metric) => metric.id === 'growth')
  const decision = workspace.decisions[0]
  const planRevenue = workspace.metrics.find((metric) => metric.id === 'planRevenue')
  const variance = workspace.metrics.find((metric) => metric.id === 'variance')
  const claim = deriveGrowthLeaderClaim(workspace)
  if (!revenue || !growth || !planRevenue || !variance || !decision) throw new Error('Presentation requires revenue, plan, variance, growth, and decision objects')
  const leader = workspace.regions.find((row) => claim.evidenceObjectIds.includes(`region:${row.id}`))!

  return [
    { id:'thesis', eyebrow:'01 · Thesis', title:workspace.document.title, note:'Open with the operating-model thesis: the interfaces stay specialised, while the work underneath becomes one connected system.', source:'Strategy document · live' },
    { id:'performance', eyebrow:'02 · Performance', title:`${formatMetric(revenue)} revenue`, note:`Revenue is ${Math.abs(variance.value).toFixed(1)}M ${variance.value >= 0 ? 'above' : 'below'} plan. Lead with the variance, then use the next scene to explain which region changes the allocation decision.`, source:'Finance model · Revenue · Q2 FY27 · live' },
    { id:'signal', eyebrow:'03 · Signal', title:claim.statement, note:`Make the tradeoff explicit: ${leader.region} has the strongest growth signal, but its margin should constrain how aggressively we scale.`, source:`Finance model · Regions · ${leader.region} · live` },
    { id:'decision', eyebrow:'04 · Decision', title:decision.title, note:decision.status === 'approved' ? 'Close by restating the approved direction and the operating constraint.' : 'Close with a crisp approval request and the evidence that still needs validation.', source:'Shared decision object · live' },
  ]
}
