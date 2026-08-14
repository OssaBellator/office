import { workspaceTables, type TableRelationship, type WorkspaceState } from './model.ts'

export type RelationshipIssueKind = 'missing-table' | 'missing-field' | 'duplicate-from-key' | 'duplicate-to-key' | 'unmatched-from-key' | 'unmatched-to-key'
export type RelationshipIssue = {
  kind: RelationshipIssueKind
  severity: 'error' | 'warning'
  message: string
  keys: string[]
}
export type RelationshipIntegrityReport = {
  relationship: TableRelationship
  valid: boolean
  matchedKeys: string[]
  issues: RelationshipIssue[]
}

function values(rows: Record<string, string | number>[], fieldId: string) {
  return rows.map((row) => String(row[fieldId] ?? ''))
}
function duplicates(items: string[]) {
  const counts = new Map<string, number>()
  items.forEach((item) => counts.set(item, (counts.get(item) ?? 0) + 1))
  return [...counts].filter(([,count]) => count > 1).map(([key]) => key)
}
function issue(kind: RelationshipIssueKind, severity: 'error'|'warning', message: string, keys: string[]): RelationshipIssue { return { kind,severity,message,keys } }

export function inspectRelationship(workspace: WorkspaceState, relationshipId: string): RelationshipIntegrityReport {
  const relationship = workspace.relationships.find((candidate) => candidate.id === relationshipId)
  if (!relationship) throw new Error(`Unknown relationship: ${relationshipId}`)
  const tables = workspaceTables(workspace)
  const from = tables.find((table) => table.schema.id === relationship.fromTable)
  const to = tables.find((table) => table.schema.id === relationship.toTable)
  const issues: RelationshipIssue[] = []
  if (!from) issues.push(issue('missing-table','error',`Missing relationship table: ${relationship.fromTable}`,[]))
  if (!to) issues.push(issue('missing-table','error',`Missing relationship table: ${relationship.toTable}`,[]))
  if (!from || !to) return { relationship, valid:false, matchedKeys:[], issues }
  if (!from.schema.fields.some((field) => field.id === relationship.fromField)) issues.push(issue('missing-field','error',`Missing relationship field: ${relationship.fromTable}.${relationship.fromField}`,[]))
  if (!to.schema.fields.some((field) => field.id === relationship.toField)) issues.push(issue('missing-field','error',`Missing relationship field: ${relationship.toTable}.${relationship.toField}`,[]))
  if (issues.some((item) => item.severity === 'error')) return { relationship, valid:false, matchedKeys:[], issues }

  const fromKeys = values(from.rows, relationship.fromField), toKeys = values(to.rows, relationship.toField)
  const duplicateFrom = duplicates(fromKeys), duplicateTo = duplicates(toKeys)
  if (relationship.cardinality === 'one-to-one' && duplicateFrom.length) issues.push(issue('duplicate-from-key','error',`${relationship.fromTable}.${relationship.fromField} has duplicate one-to-one keys: ${duplicateFrom.join(', ')}`,duplicateFrom))
  if (duplicateTo.length) issues.push(issue('duplicate-to-key','error',`${relationship.toTable}.${relationship.toField} must be unique for ${relationship.cardinality}: ${duplicateTo.join(', ')}`,duplicateTo))

  const fromSet = new Set(fromKeys), toSet = new Set(toKeys)
  const unmatchedFrom = [...fromSet].filter((key) => !toSet.has(key)), unmatchedTo = [...toSet].filter((key) => !fromSet.has(key))
  if (unmatchedFrom.length) issues.push(issue('unmatched-from-key','warning',`${relationship.fromTable} contains keys with no ${relationship.toTable} match: ${unmatchedFrom.join(', ')}`,unmatchedFrom))
  if (unmatchedTo.length) issues.push(issue('unmatched-to-key','warning',`${relationship.toTable} contains keys with no ${relationship.fromTable} match: ${unmatchedTo.join(', ')}`,unmatchedTo))
  const matchedKeys = [...fromSet].filter((key) => toSet.has(key)).sort()
  return { relationship, valid:!issues.some((item) => item.severity === 'error'), matchedKeys, issues }
}

export function inspectAllRelationships(workspace: WorkspaceState) {
  return workspace.relationships.map((relationship) => inspectRelationship(workspace, relationship.id))
}
