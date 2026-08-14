import { evaluateSemanticFormula, parseSemanticFormula, type FormulaResult, type ParsedFormula, type TableData } from './formulas.ts'

export type SemanticDimension = 'number' | 'currency' | 'percent'
export type SemanticExpressionResult = FormulaResult & {
  terms: ParsedFormula[]
  dimension: SemanticDimension
}

type DimensionedValue = { value: number; dimension: SemanticDimension }

class ExpressionParser {
  private index = 0
  private dependencies = new Set<string>()
  private terms: ParsedFormula[] = []
  private expression: string
  private tables: TableData[]

  constructor(expression: string, tables: TableData[]) {
    this.expression = expression
    this.tables = tables
  }

  parse(): SemanticExpressionResult {
    const result = this.parseExpression()
    this.skipWhitespace()
    if (this.index !== this.expression.length) {
      throw new Error(`Unsupported expression near: ${this.expression.slice(this.index)}`)
    }
    const rounded = Number(result.value.toFixed(12))
    return {
      value: Object.is(rounded, -0) ? 0 : rounded,
      dimension: result.dimension,
      dependencies: [...this.dependencies],
      terms: this.terms,
    }
  }

  private parseExpression(): DimensionedValue {
    let left = this.parseTerm()
    while (true) {
      this.skipWhitespace()
      const operator = this.expression[this.index]
      if (operator !== '+' && operator !== '-') break
      this.index += 1
      const right = this.parseTerm()
      if (left.dimension !== right.dimension) {
        throw new Error(`Cannot ${operator === '+' ? 'add' : 'subtract'} ${left.dimension} and ${right.dimension}`)
      }
      left = { value: operator === '+' ? left.value + right.value : left.value - right.value, dimension: left.dimension }
    }
    return left
  }

  private parseTerm(): DimensionedValue {
    let left = this.parsePrimary()
    while (true) {
      this.skipWhitespace()
      const operator = this.expression[this.index]
      if (operator !== '*' && operator !== '/') break
      this.index += 1
      const right = this.parsePrimary()
      left = operator === '*' ? this.multiply(left, right) : this.divide(left, right)
    }
    return left
  }

  private multiply(left: DimensionedValue, right: DimensionedValue): DimensionedValue {
    if (left.dimension === 'number') return { value: left.value * right.value, dimension: right.dimension }
    if (right.dimension === 'number') return { value: left.value * right.value, dimension: left.dimension }
    throw new Error(`Cannot multiply ${left.dimension} by ${right.dimension}`)
  }

  private divide(left: DimensionedValue, right: DimensionedValue): DimensionedValue {
    if (right.value === 0) throw new Error('Division by zero')
    if (right.dimension === 'number') return { value: left.value / right.value, dimension: left.dimension }
    if (left.dimension === right.dimension) return { value: left.value / right.value, dimension: 'number' }
    throw new Error(`Cannot divide ${left.dimension} by ${right.dimension}`)
  }

  private parsePrimary(): DimensionedValue {
    this.skipWhitespace()
    const char = this.expression[this.index]
    if (char === '+') { this.index += 1; return this.parsePrimary() }
    if (char === '-') { this.index += 1; const value = this.parsePrimary(); return { ...value, value: -value.value } }
    if (char === '(') {
      this.index += 1
      const value = this.parseExpression()
      this.skipWhitespace()
      if (this.expression[this.index] !== ')') throw new Error('Unclosed expression parenthesis')
      this.index += 1
      return value
    }
    if (char && /[0-9.]/.test(char)) return { value: this.parseNumber(), dimension: 'number' }
    return this.parseAggregate()
  }

  private parseNumber() {
    const match = this.expression.slice(this.index).match(/^(?:\d+(?:\.\d+)?|\.\d+)/)
    if (!match) throw new Error(`Expected number near: ${this.expression.slice(this.index)}`)
    this.index += match[0].length
    return Number(match[0])
  }

  private parseAggregate(): DimensionedValue {
    const start = this.index
    const name = this.expression.slice(this.index).match(/^[A-Za-z]+/)?.[0]
    if (!name) throw new Error(`Expected semantic formula near: ${this.expression.slice(this.index)}`)
    this.index += name.length
    this.skipWhitespace()
    if (this.expression[this.index] !== '(') throw new Error(`Expected aggregate call near: ${this.expression.slice(start)}`)

    let depth = 0
    let quote: string | null = null
    while (this.index < this.expression.length) {
      const char = this.expression[this.index]
      if (quote) {
        if (char === quote && this.expression[this.index - 1] !== '\\') quote = null
      } else if (char === '"' || char === "'") {
        quote = char
      } else if (char === '(') {
        depth += 1
      } else if (char === ')') {
        depth -= 1
        if (depth === 0) {
          this.index += 1
          break
        }
      }
      this.index += 1
    }
    if (depth !== 0) throw new Error('Unclosed semantic formula')

    const term = this.expression.slice(start, this.index)
    const parsed = parseSemanticFormula(term)
    const result = evaluateSemanticFormula(term, this.tables)
    const table = this.tables.find((candidate) => candidate.schema.id === parsed.tableId)
    const field = table?.schema.fields.find((candidate) => candidate.id === parsed.fieldId)
    if (!table || !field) throw new Error(`Unknown semantic field: ${parsed.tableId}.${parsed.fieldId}`)
    const dimension: SemanticDimension = parsed.fn === 'COUNT' ? 'number' : field.type === 'currency' ? 'currency' : field.type === 'percent' ? 'percent' : 'number'
    this.terms.push(parsed)
    result.dependencies.forEach((dependency) => this.dependencies.add(dependency))
    return { value: result.value, dimension }
  }

  private skipWhitespace() {
    while (/\s/.test(this.expression[this.index] ?? '')) this.index += 1
  }
}

export function evaluateSemanticExpression(expression: string, tables: TableData[]): SemanticExpressionResult {
  return new ExpressionParser(expression, tables).parse()
}
