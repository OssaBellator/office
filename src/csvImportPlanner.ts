import type { WorkspaceState } from './model.ts'
import type { VersionedWorkspaceCommand } from './semanticCommands.ts'

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [], cell = '', quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { cell += '"'; index += 1 }
      else if (char === '"') quoted = false
      else cell += char
      continue
    }
    if (char === '"') quoted = true
    else if (char === ',') { row.push(cell); cell = '' }
    else if (char === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
    else if (char !== '\r') cell += char
  }
  if (quoted) throw new Error('CSV contains an unclosed quoted field')
  if (cell.length || row.length) { row.push(cell); rows.push(row) }
  return rows.filter((candidate) => candidate.some((value) => value.trim().length > 0))
}

function headerIndex(header: string[], required: string[]) {
  const normalized = header.map((value) => value.trim())
  for (const field of required) if (!normalized.includes(field)) throw new Error(`CSV is missing required column: ${field}`)
  return Object.fromEntries(required.map((field) => [field, normalized.indexOf(field)])) as Record<string, number>
}

function finiteNumber(value: string, label: string) {
  const number = Number(value.trim())
  if (!Number.isFinite(number)) throw new Error(`${label} must be a finite number: ${value}`)
  return number
}

function uniqueRows(rows: string[][], regionIndex: number) {
  const seen = new Set<string>()
  for (const row of rows) {
    const region = row[regionIndex]?.trim()
    if (!region) throw new Error('CSV row is missing Region')
    if (seen.has(region)) throw new Error(`CSV contains duplicate region: ${region}`)
    seen.add(region)
  }
}

export function planRegionsCsvImport(workspace: WorkspaceState, text: string): VersionedWorkspaceCommand[] {
  const rows = parseCsv(text)
  if (rows.length < 2) throw new Error('Regions CSV must include a header and at least one data row')
  const indexes = headerIndex(rows[0], ['Region','Revenue','Growth','Margin'])
  const dataRows = rows.slice(1)
  uniqueRows(dataRows, indexes.Region)
  const commands: VersionedWorkspaceCommand[] = []
  for (const row of dataRows) {
    const regionName = row[indexes.Region]?.trim()
    const existing = workspace.regions.find((region) => region.region === regionName)
    if (!existing) throw new Error(`Unknown region in CSV: ${regionName}`)
    const revenue = finiteNumber(row[indexes.Revenue] ?? '', `${regionName} Revenue`)
    const growth = finiteNumber(row[indexes.Growth] ?? '', `${regionName} Growth`)
    const margin = finiteNumber(row[indexes.Margin] ?? '', `${regionName} Margin`)
    if (revenue !== existing.revenue) commands.push({ type:'region.update', regionId:existing.id, field:'revenue', value:revenue })
    if (growth !== existing.growth) commands.push({ type:'region.update', regionId:existing.id, field:'growth', value:growth })
    if (margin !== existing.margin) commands.push({ type:'region.update', regionId:existing.id, field:'margin', value:margin })
  }
  return commands
}

export function planPlanCsvImport(workspace: WorkspaceState, text: string): VersionedWorkspaceCommand[] {
  const rows = parseCsv(text)
  if (rows.length < 2) throw new Error('Plan CSV must include a header and at least one data row')
  const indexes = headerIndex(rows[0], ['Region','Revenue'])
  const dataRows = rows.slice(1)
  uniqueRows(dataRows, indexes.Region)
  const commands: VersionedWorkspaceCommand[] = []
  for (const row of dataRows) {
    const regionName = row[indexes.Region]?.trim()
    const existing = workspace.plans.find((plan) => plan.region === regionName)
    if (!existing) throw new Error(`Unknown plan region in CSV: ${regionName}`)
    const revenue = finiteNumber(row[indexes.Revenue] ?? '', `${regionName} Revenue`)
    if (revenue !== existing.revenue) commands.push({ type:'plan.update', planId:existing.id, field:'revenue', value:revenue })
  }
  return commands
}

export function planWorkspaceCsvImport(workspace: WorkspaceState, files: { regions?: string; plan?: string }): VersionedWorkspaceCommand[] {
  return [
    ...(files.regions ? planRegionsCsvImport(workspace, files.regions) : []),
    ...(files.plan ? planPlanCsvImport(workspace, files.plan) : []),
  ]
}
