import { materializeChart } from '../charts'
import { getEditableChart } from '../chartModel'
import type { WorkspaceState } from '../model'

export function RelationshipChart({ workspace, chartId, compact = false }: { workspace: WorkspaceState; chartId: string; compact?: boolean }) {
  const chart = materializeChart(workspace, chartId)
  const definition = getEditableChart(workspace, chartId)
  if (definition.kind === 'line') return <LineRelationshipChart chart={chart} compact={compact} />
  return <GroupedRelationshipChart chart={chart} compact={compact} />
}

function GroupedRelationshipChart({ chart, compact }: { chart: ReturnType<typeof materializeChart>; compact: boolean }) {
  const max = chart.maxValue || 1
  return <div className={compact ? 'relationship-chart compact' : 'relationship-chart'}>
    <div className="relationship-chart-plot grouped">{chart.rows.map((row) => <div className="relationship-chart-row" key={row.category}><span>{abbreviate(row.category)}</span><div className="relationship-chart-bars">{chart.definition.series.map((series) => <div className={`relationship-chart-bar series-${series.id}`} style={{ width: `${Math.max(2, (row.values[series.id] / max) * 100)}%` }} key={series.id}><small>{row.values[series.id].toFixed(1)}</small></div>)}</div></div>)}</div>
    <ChartLegend series={chart.definition.series} />
  </div>
}

function LineRelationshipChart({ chart, compact }: { chart: ReturnType<typeof materializeChart>; compact: boolean }) {
  const width = 600, height = compact ? 170 : 220, left = 36, right = 18, top = 18, bottom = 34
  const innerWidth = width - left - right, innerHeight = height - top - bottom, max = chart.maxValue || 1
  const x = (index: number) => left + (chart.rows.length <= 1 ? innerWidth / 2 : (index / (chart.rows.length - 1)) * innerWidth)
  const y = (value: number) => top + innerHeight - (value / max) * innerHeight
  return <div className={compact ? 'relationship-chart compact line' : 'relationship-chart line'}>
    <svg className="relationship-line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={chart.definition.label}>
      <line className="chart-axis" x1={left} x2={width - right} y1={top + innerHeight} y2={top + innerHeight} />
      {chart.definition.series.map((series) => {
        const points = chart.rows.map((row, index) => `${x(index)},${y(row.values[series.id])}`).join(' ')
        return <g className={`series-${series.id}`} key={series.id}><polyline className="chart-line" points={points} fill="none" />{chart.rows.map((row, index) => <circle className="chart-point" cx={x(index)} cy={y(row.values[series.id])} r={compact ? 3.5 : 4.5} key={`${series.id}:${row.category}`} />)}</g>
      })}
      {chart.rows.map((row, index) => <text className="chart-category" x={x(index)} y={height - 9} textAnchor="middle" key={row.category}>{abbreviate(row.category)}</text>)}
    </svg>
    <ChartLegend series={chart.definition.series} />
  </div>
}

function ChartLegend({ series }: { series: Array<{ id: string; label: string }> }) {
  return <div className="relationship-chart-legend">{series.map((item) => <span key={item.id}><i className={`series-${item.id}`} /> {item.label}</span>)}</div>
}

function abbreviate(region: string) {
  if (region === 'North America') return 'NA'
  if (region === 'Latin America') return 'LATAM'
  return region
}
