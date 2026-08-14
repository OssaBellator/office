export type FieldType = 'text' | 'number' | 'currency' | 'percent'

export type FieldSchema = {
  id: string
  label: string
  type: FieldType
}

export type TableSchema = {
  id: string
  label: string
  fields: FieldSchema[]
}

export type TableRow = Record<string, string | number | null | undefined>

export type TableData = {
  schema: TableSchema
  rows: TableRow[]
}

export type FormulaFunction = 'SUM' | 'AVERAGE' | 'MIN' | 'MAX' | 'COUNT'
export type FormulaComparison = '=' | '!=' | '>' | '>=' | '<' | '<='

export type FormulaCondition = {
  fieldId: string
  operator: FormulaComparison
  value: string | number
}

export type ParsedFormula = {
  fn: FormulaFunction
  tableId: string
  fieldId: string
  conditions?: FormulaCondition[]
}

export type FormulaResult = {
  value: number
  dependencies: string[]
  matchedRows?: number
}

const FORMULA_PATTERN = /^\s*(SUM|AVERAGE|MIN|MAX|COUNT)\s*\(\s*([A-Za-z][\w-]*)\.([A-Za-z][\w-]*)(?:\s+WHERE\s+(.+?))?\s*\)\s*$/i
const CONDITION_PATTERN = /^\s*([A-Za-z][\w-]*)\s*(>=|<=|!=|=|>|<)\s*(?:"([^"]*)"|'([^']*)'|(-?(?:\d+(?:\.\d+)?|\.\d+)))\s*$/

function parseCondition(expression: string): FormulaCondition {
  const match = expression.match(CONDITION_PATTERN)
  if (!match) throw new Error(`Unsupported filter condition: ${expression}`)
  const value = match[3] ?? match[4] ?? Number(match[5])
  return {
    fieldId: match[1],
    operator: match[2] as FormulaComparison,
    value,
  }
}

export function parseSemanticFormula(expression: string): ParsedFormula {
  const match = expression.match(FORMULA_PATTERN)
  if (!match) throw new Error(`Unsupported formula: ${expression}`)
  const parsed: ParsedFormula = {
    fn: match[1].toUpperCase() as FormulaFunction,
    tableId: match[2],
    fieldId: match[3],
  }
  if (match[4]) parsed.conditions = match[4].split(/\s+AND\s+/i).map(parseCondition)
  return parsed
}

function compareValues(actual: string | number | null | undefined, condition: FormulaCondition) {
  if (actual === null || actual === undefined) return false
  const expected = condition.value
  if (typeof expected === 'number') {
    if (typeof actual !== 'number' || Number.isNaN(actual)) return false
    switch (condition.operator) {
      case '=': return actual === expected
      case '!=': return actual !== expected
      case '>': return actual > expected
      case '>=': return actual >= expected
      case '<': return actual < expected
      case '<=': return actual <= expected
    }
  }
  const left = String(actual)
  const right = String(expected)
  switch (condition.operator) {
    case '=': return left === right
    case '!=': return left !== right
    case '>': return left > right
    case '>=': return left >= right
    case '<': return left < right
    case '<=': return left <= right
  }
}

function dependencyList(parsed: ParsedFormula) {
  const ids = [
    `table:${parsed.tableId}`,
    `field:${parsed.tableId}.${parsed.fieldId}`,
    ...(parsed.conditions ?? []).map((condition) => `field:${parsed.tableId}.${condition.fieldId}`),
  ]
  return [...new Set(ids)]
}

export function evaluateSemanticFormula(expression: string, tables: TableData[]): FormulaResult {
  const parsed = parseSemanticFormula(expression)
  const table = tables.find((candidate) => candidate.schema.id === parsed.tableId)
  if (!table) throw new Error(`Unknown table: ${parsed.tableId}`)

  const field = table.schema.fields.find((candidate) => candidate.id === parsed.fieldId)
  if (!field) throw new Error(`Unknown field: ${parsed.tableId}.${parsed.fieldId}`)

  for (const condition of parsed.conditions ?? []) {
    const conditionField = table.schema.fields.find((candidate) => candidate.id === condition.fieldId)
    if (!conditionField) throw new Error(`Unknown filter field: ${parsed.tableId}.${condition.fieldId}`)
    if (typeof condition.value === 'number' && conditionField.type === 'text') {
      throw new Error(`Numeric filter requires a numeric field: ${parsed.tableId}.${condition.fieldId}`)
    }
  }

  const rows = table.rows.filter((row) => (parsed.conditions ?? []).every((condition) => compareValues(row[condition.fieldId], condition)))
  const rawValues = rows
    .map((row) => row[parsed.fieldId])
    .filter((value) => value !== null && value !== undefined && value !== '')
  const dependencies = dependencyList(parsed)

  if (parsed.fn === 'COUNT') return { value: rawValues.length, dependencies, matchedRows: rows.length }
  if (field.type === 'text') throw new Error(`Formula ${parsed.fn} requires a numeric field: ${parsed.tableId}.${parsed.fieldId}`)

  const values = rawValues.map((value) => {
    if (typeof value !== 'number' || Number.isNaN(value)) throw new Error(`Non-numeric value in ${parsed.tableId}.${parsed.fieldId}`)
    return value
  })

  if (values.length === 0) return { value: 0, dependencies, matchedRows: rows.length }

  let value: number
  switch (parsed.fn) {
    case 'SUM': value = values.reduce((sum, item) => sum + item, 0); break
    case 'AVERAGE': value = values.reduce((sum, item) => sum + item, 0) / values.length; break
    case 'MIN': value = Math.min(...values); break
    case 'MAX': value = Math.max(...values); break
    default: value = 0
  }

  return { value: Number(value.toFixed(12)), dependencies, matchedRows: rows.length }
}
