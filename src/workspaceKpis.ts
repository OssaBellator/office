import { evaluateWorkspaceFormula, type DependencyEdge, type Metric, type WorkspaceObject, type WorkspaceState } from './model.ts'

export const REVENUE_ATTAINMENT_METRIC_ID = 'attainment'
export const REVENUE_ATTAINMENT_FORMULA = 'METRIC(revenue) / METRIC(planRevenue) * 100'
const LEGACY_REVENUE_ATTAINMENT_FORMULA = 'SUM(Regions.Revenue) / SUM(Plan.Revenue) * 100'

function metricObject(): WorkspaceObject {
  return { id:`metric:${REVENUE_ATTAINMENT_METRIC_ID}`, kind:'metric', label:'Revenue attainment', surfaces:['docs','data','present'] }
}

function attainmentValue(workspace: WorkspaceState) {
  return evaluateWorkspaceFormula(workspace, REVENUE_ATTAINMENT_FORMULA, [REVENUE_ATTAINMENT_METRIC_ID]).value
}

function attainmentMetric(workspace: WorkspaceState): Metric {
  return {
    id:REVENUE_ATTAINMENT_METRIC_ID,
    label:'Revenue attainment',
    value:attainmentValue(workspace),
    previous:Number((36.6 / 41 * 100).toFixed(12)),
    format:'percent',
    source:'Finance model · Actual vs plan · Q2 FY27',
    updatedAt:'12 min ago',
    formula:REVENUE_ATTAINMENT_FORMULA,
  }
}

function edgeKey(edge: DependencyEdge) { return `${edge.from}|${edge.to}|${edge.relation}` }

export function ensureWorkspaceKpis(workspace: WorkspaceState): WorkspaceState {
  const existing = workspace.metrics.find((candidate) => candidate.id === REVENUE_ATTAINMENT_METRIC_ID)
  const migrateExisting = existing?.formula === LEGACY_REVENUE_ATTAINMENT_FORMULA
  const metrics = !existing
    ? [...workspace.metrics, attainmentMetric(workspace)]
    : migrateExisting
      ? workspace.metrics.map((metric) => metric.id === REVENUE_ATTAINMENT_METRIC_ID ? { ...metric, formula:REVENUE_ATTAINMENT_FORMULA, value:attainmentValue(workspace) } : metric)
      : workspace.metrics
  const objects = workspace.graph.objects.some((object) => object.id === `metric:${REVENUE_ATTAINMENT_METRIC_ID}`)
    ? workspace.graph.objects
    : [...workspace.graph.objects, metricObject()]
  const metricObjectId = `metric:${REVENUE_ATTAINMENT_METRIC_ID}`
  const retainedEdges = workspace.graph.edges.filter((edge) => !(edge.to === metricObjectId && edge.relation === 'derives'))
  const desiredEdges: DependencyEdge[] = [
    { from:'metric:revenue', to:metricObjectId, relation:'derives', description:'Q2 revenue contributes to revenue attainment' },
    { from:'metric:planRevenue', to:metricObjectId, relation:'derives', description:'Q2 revenue plan contributes to revenue attainment' },
    { from:metricObjectId, to:'document:strategy', relation:'renders', description:'Revenue attainment is embedded in the strategy snapshot' },
    { from:metricObjectId, to:'scene:performance', relation:'renders', description:'Revenue attainment informs the performance scene' },
  ]
  const keys = new Set(retainedEdges.map(edgeKey))
  const edges = [...retainedEdges, ...desiredEdges.filter((edge) => !keys.has(edgeKey(edge)))]
  return { ...workspace, metrics, graph:{ objects, edges } }
}
