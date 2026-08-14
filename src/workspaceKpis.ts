import { evaluateSemanticExpression } from './expressions.ts'
import { workspaceTables, type DependencyEdge, type Metric, type WorkspaceObject, type WorkspaceState } from './model.ts'

export const REVENUE_ATTAINMENT_METRIC_ID = 'attainment'
export const REVENUE_ATTAINMENT_FORMULA = 'SUM(Regions.Revenue) / SUM(Plan.Revenue) * 100'

function metricObject(): WorkspaceObject {
  return { id:`metric:${REVENUE_ATTAINMENT_METRIC_ID}`, kind:'metric', label:'Revenue attainment', surfaces:['docs','data','present'] }
}

function attainmentMetric(workspace: WorkspaceState): Metric {
  const value = evaluateSemanticExpression(REVENUE_ATTAINMENT_FORMULA, workspaceTables(workspace)).value
  return {
    id:REVENUE_ATTAINMENT_METRIC_ID,
    label:'Revenue attainment',
    value,
    previous:Number((36.6 / 41 * 100).toFixed(12)),
    format:'percent',
    source:'Finance model · Actual vs plan · Q2 FY27',
    updatedAt:'12 min ago',
    formula:REVENUE_ATTAINMENT_FORMULA,
  }
}

function edgeKey(edge: DependencyEdge) { return `${edge.from}|${edge.to}|${edge.relation}` }

export function ensureWorkspaceKpis(workspace: WorkspaceState): WorkspaceState {
  const metric = workspace.metrics.find((candidate) => candidate.id === REVENUE_ATTAINMENT_METRIC_ID)
  const metrics = metric ? workspace.metrics : [...workspace.metrics, attainmentMetric(workspace)]
  const objects = workspace.graph.objects.some((object) => object.id === `metric:${REVENUE_ATTAINMENT_METRIC_ID}`)
    ? workspace.graph.objects
    : [...workspace.graph.objects, metricObject()]
  const desiredEdges: DependencyEdge[] = [
    ...workspace.regions.map((row) => ({ from:`region:${row.id}`, to:`metric:${REVENUE_ATTAINMENT_METRIC_ID}`, relation:'derives' as const, description:'Regional actual revenue contributes to revenue attainment' })),
    ...workspace.plans.map((row) => ({ from:`plan:${row.id}`, to:`metric:${REVENUE_ATTAINMENT_METRIC_ID}`, relation:'derives' as const, description:'Regional plan revenue contributes to revenue attainment' })),
    { from:`metric:${REVENUE_ATTAINMENT_METRIC_ID}`, to:'document:strategy', relation:'renders', description:'Revenue attainment is embedded in the strategy snapshot' },
    { from:`metric:${REVENUE_ATTAINMENT_METRIC_ID}`, to:'scene:performance', relation:'renders', description:'Revenue attainment informs the performance scene' },
  ]
  const keys = new Set(workspace.graph.edges.map(edgeKey))
  const edges = [...workspace.graph.edges, ...desiredEdges.filter((edge) => !keys.has(edgeKey(edge)))]
  return { ...workspace, metrics, graph:{ objects, edges } }
}
