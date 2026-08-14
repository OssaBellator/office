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

export type ParsedFormula = {
  fn: FormulaFunction
  tableId: string
  fieldId: string
}

export type FormulaResult = {
  value: number
  dependencies: string[]
}

const FORMULA_PATTERN = /^\s*(SUM|AVERAGE|MIN|MAX|COUNT)\s*\(\s*([A-Za-z][\w-]*)\.([A-Za-z][\w-]*)\s*\)\s*$/i

export function parseSemanticFormula(expression: string): ParsedFormula {
  const match = expression.match(FORMULA_PATTERN)
  if (!match) {
    throw new Error(`Unsupported formula: ${expression}`)
  }

  return {
    fn: match[1].toUpperCase() as FormulaFunction,
    tableId: match[2],
    fieldId: match[3],
  }
}

export function evaluateSemanticFormula(expression: string, tables: TableData[]): FormulaResult {
  const parsed = parseSemanticFormula(expression)
  const table = tables.find((candidate) => candidate.schema.id === parsed.tableId)
  if (!table) throw new Error(`Unknown table: ${parsed.tableId}`)

  const field = table.schema.fields.find((candidate) => candidate.id === parsed.fieldId)
  if (!field) throw new Error(`Unknown field: ${parsed.tableId}.${parsed.fieldId}`)

  const rawValues = table.rows
    .map((row) => row[parsed.fieldId])
    .filter((value) => value !== null && value !== undefined && value !== '')

  if (parsed.fn === 'COUNT') {
    return {
      value: rawValues.length,
      dependencies: [`table:${parsed.tableId}`, `field:${parsed.tableId}.${parsed.fieldId}`],
    }
  }

  if (field.type === 'text') {
    throw new Error(`Formula ${parsed.fn} requires a numeric field: ${parsed.tableId}.${parsed.fieldId}`)
  }

  const values = rawValues.map((value) => {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      throw new Error(`Non-numeric value in ${parsed.tableId}.${parsed.fieldId}`)
    }
    return value
  })

  if (values.length === 0) {
    return {
      value: 0,
      dependencies: [`table:${parsed.tableId}`, `field:${parsed.tableId}.${parsed.fieldId}`],
    }
  }

  let value: number
  switch (parsed.fn) {
    case 'SUM':
      value = values.reduce((sum, item) => sum + item, 0)
      break
    case 'AVERAGE':
      value = values.reduce((sum, item) => sum + item, 0) / values.length
      break
    case 'MIN':
      value = Math.min(...values)
      break
    case 'MAX':
      value = Math.max(...values)
      break
    default:
      value = 0
  }

  return {
    value: Number(value.toFixed(12)),
    dependencies: [`table:${parsed.tableId}`, `field:${parsed.tableId}.${parsed.fieldId}`],
  }
}
