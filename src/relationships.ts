import { workspaceTables, type TableRelationship, type WorkspaceState } from './model.ts'
import type { TableData, TableRow } from './formulas.ts'

export type RelationshipPair = { key: string | number; from: TableRow; to: TableRow }
export type RelationshipResolution = {
  relationship: TableRelationship
  fromTable: TableData
  toTable: TableData
  pairs: RelationshipPair[]
  unmatchedFrom: TableRow[]
  unmatchedTo: TableRow[]
}

function getTable(workspace: WorkspaceState, tableId: string) {
  const table = workspaceTables(workspace).find((candidate) => candidate.schema.id === tableId)
  if (!table) throw new Error(`Unknown relationship table: ${tableId}`)
  return table
}

function getField(table: TableData, fieldId: string) {
  const field = table.schema.fields.find((candidate) => candidate.id === fieldId)
  if (!field) throw new Error(`Unknown relationship field: ${table.schema.id}.${fieldId}`)
  return field
}

function normalizedKey(value: unknown) {
  if (typeof value === 'string') return value.trim().toLowerCase()
  if (typeof value === 'number') return String(value)
  return ''
}

export function resolveTableRelationship(workspace: WorkspaceState, relationshipId: string): RelationshipResolution {
  const relationship = workspace.relationships.find((candidate) => candidate.id === relationshipId)
  if (!relationship) throw new Error(`Unknown relationship: ${relationshipId}`)
  const fromTable = getTable(workspace, relationship.fromTable)
  const toTable = getTable(workspace, relationship.toTable)
  getField(fromTable, relationship.fromField)
  getField(toTable, relationship.toField)

  const toIndex = new Map<string, TableRow[]>()
  for (const row of toTable.rows) {
    const key = normalizedKey(row[relationship.toField])
    if (!key) continue
    const bucket = toIndex.get(key) ?? []
    bucket.push(row)
    toIndex.set(key, bucket)
  }
  if (relationship.cardinality === 'one-to-one') {
    for (const [key, rows] of toIndex) if (rows.length > 1) throw new Error(`Relationship ${relationship.id} expected unique target key: ${key}`)
  }

  const seenFrom = new Set<string>()
  const matchedTo = new Set<TableRow>()
  const pairs: RelationshipPair[] = []
  const unmatchedFrom: TableRow[] = []
  for (const row of fromTable.rows) {
    const rawKey = row[relationship.fromField]
    const key = normalizedKey(rawKey)
    if (!key) { unmatchedFrom.push(row); continue }
    if (relationship.cardinality === 'one-to-one' && seenFrom.has(key)) throw new Error(`Relationship ${relationship.id} expected unique source key: ${key}`)
    seenFrom.add(key)
    const matches = toIndex.get(key) ?? []
    if (matches.length === 0) { unmatchedFrom.push(row); continue }
    for (const match of matches) {
      matchedTo.add(match)
      pairs.push({ key: typeof rawKey === 'number' ? rawKey : String(rawKey), from: row, to: match })
    }
  }

  return {
    relationship,
    fromTable,
    toTable,
    pairs,
    unmatchedFrom,
    unmatchedTo: toTable.rows.filter((row) => !matchedTo.has(row)),
  }
}
