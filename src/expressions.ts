import { evaluateSemanticFormula, parseSemanticFormula, type FormulaResult, type ParsedFormula, type TableData } from './formulas.ts'

export type SemanticExpressionResult = FormulaResult & {
  terms: ParsedFormula[]
}

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
    const value = this.parseExpression()
    this.skipWhitespace()
    if (this.index !== this.expression.length) {
      throw new Error(`Unsupported expression near: ${this.expression.slice(this.index)}`)
    }
    const rounded = Number(value.toFixed(12))
    return {
      value: Object.is(rounded, -0) ? 0 : rounded,
      dependencies: [...this.dependencies],
      terms: this.terms,
    }
  }

  private parseExpression(): number {
    let value = this.parsePrimary()
    while (true) {
      this.skipWhitespace()
      const operator = this.expression[this.index]
      if (operator !== '+' && operator !== '-') break
      this.index += 1
      const right = this.parsePrimary()
      value = operator === '+' ? value + right : value - right
    }
    return value
  }

  private parsePrimary(): number {
    this.skipWhitespace()
    const char = this.expression[this.index]
    if (char === '+') { this.index += 1; return this.parsePrimary() }
    if (char === '-') { this.index += 1; return -this.parsePrimary() }
    if (char === '(') {
      this.index += 1
      const value = this.parseExpression()
      this.skipWhitespace()
      if (this.expression[this.index] !== ')') throw new Error('Unclosed expression parenthesis')
      this.index += 1
      return value
    }
    if (char && /[0-9.]/.test(char)) return this.parseNumber()
    return this.parseAggregate()
  }

  private parseNumber() {
    const match = this.expression.slice(this.index).match(/^(?:\d+(?:\.\d+)?|\.\d+)/)
    if (!match) throw new Error(`Expected number near: ${this.expression.slice(this.index)}`)
    this.index += match[0].length
    return Number(match[0])
  }

  private parseAggregate() {
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
    this.terms.push(parsed)
    result.dependencies.forEach((dependency) => this.dependencies.add(dependency))
    return result.value
  }

  private skipWhitespace() {
    while (/\s/.test(this.expression[this.index] ?? '')) this.index += 1
  }
}

export function evaluateSemanticExpression(expression: string, tables: TableData[]): SemanticExpressionResult {
  return new ExpressionParser(expression, tables).parse()
}
