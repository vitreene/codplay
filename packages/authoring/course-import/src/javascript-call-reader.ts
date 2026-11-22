/** Represents a primitive JavaScript literal found without executing source. */
export type JavaScriptPrimitive = string | number | boolean | null

/** Represents a plain literal object found in a source callback. */
export type JavaScriptObject = Readonly<{
  kind: 'object'
  fields: Readonly<Record<string, JavaScriptExpression>>
}>

/** Represents an array literal found in a source callback. */
export type JavaScriptArray = Readonly<{
  kind: 'array'
  items: readonly JavaScriptExpression[]
}>

/** Represents a name or member expression that is not evaluated by the parser. */
export type JavaScriptIdentifier = Readonly<{ kind: 'identifier'; name: string }>

/** Represents one call with its exact callee name and parsed arguments. */
export type JavaScriptCall = Readonly<{
  kind: 'call'
  callee: string
  arguments: readonly JavaScriptExpression[]
}>

/** Represents one parsed literal, name, array, object, or call expression. */
export type JavaScriptExpression =
  | JavaScriptPrimitive
  | JavaScriptObject
  | JavaScriptArray
  | JavaScriptIdentifier
  | JavaScriptCall

/** Holds parsed calls or the first unsupported syntax location. */
export type JavaScriptCallParse = Readonly<{
  calls: readonly JavaScriptCall[]
  error?: string
}>

type Token = Readonly<{
  kind: 'identifier' | 'string' | 'number' | 'punctuation' | 'end'
  value: string
  offset: number
}>

/** Tokenizes callback text into literal-safe syntax without evaluating it. */
function tokenize(source: string): readonly Token[] {
  const tokens: Token[] = []
  let offset = 0
  while (offset < source.length) {
    const character = source[offset]!
    if (/\s/.test(character)) {
      offset += 1
      continue
    }
    if (source.startsWith('//', offset)) {
      const end = source.indexOf('\n', offset + 2)
      offset = end < 0 ? source.length : end + 1
      continue
    }
    if (source.startsWith('/*', offset)) {
      const end = source.indexOf('*/', offset + 2)
      if (end < 0) throw new SyntaxError(`Unclosed comment at offset ${offset}.`)
      offset = end + 2
      continue
    }
    if (character === "'" || character === '"') {
      const parsed = readQuotedString(source, offset)
      tokens.push({ kind: 'string', value: parsed.value, offset })
      offset = parsed.nextOffset
      continue
    }
    const number = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(source.slice(offset))
    if (number !== null) {
      tokens.push({ kind: 'number', value: number[0], offset })
      offset += number[0].length
      continue
    }
    const identifier = /^[A-Za-z_$][\w$]*/.exec(source.slice(offset))
    if (identifier !== null) {
      tokens.push({ kind: 'identifier', value: identifier[0], offset })
      offset += identifier[0].length
      continue
    }
    if ('{}()[].,:;+-'.includes(character)) {
      tokens.push({ kind: 'punctuation', value: character, offset })
      offset += 1
      continue
    }
    throw new SyntaxError(`Unsupported token ${JSON.stringify(character)} at offset ${offset}.`)
  }
  return [...tokens, { kind: 'end', value: '', offset: source.length }]
}

/** Reads one quoted JavaScript string and decodes only standard escapes. */
function readQuotedString(source: string, start: number): Readonly<{ value: string; nextOffset: number }> {
  const quote = source[start]!
  let value = ''
  let offset = start + 1
  while (offset < source.length) {
    const character = source[offset]!
    if (character === quote) return { value, nextOffset: offset + 1 }
    if (character !== '\\') {
      value += character
      offset += 1
      continue
    }
    const escaped = source[offset + 1]
    if (escaped === undefined) break
    const commonEscapes: Readonly<Record<string, string>> = {
      '0': '\0', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t', v: '\v',
      '\\': '\\', "'": "'", '"': '"',
    }
    if (escaped in commonEscapes) {
      value += commonEscapes[escaped]
      offset += 2
      continue
    }
    if (escaped === 'u' && /^[\da-fA-F]{4}$/.test(source.slice(offset + 2, offset + 6))) {
      value += String.fromCharCode(Number.parseInt(source.slice(offset + 2, offset + 6), 16))
      offset += 6
      continue
    }
    throw new SyntaxError(`Unsupported string escape at offset ${offset}.`)
  }
  throw new SyntaxError(`Unclosed string at offset ${start}.`)
}

class LiteralCallParser {
  private position = 0
  private readonly tokens: readonly Token[]

  /** Creates a parser for one tokenized callback value. */
  constructor(tokens: readonly Token[]) {
    this.tokens = tokens
  }

  /** Reads a semicolon-separated list of top-level function calls. */
  parseCalls(): readonly JavaScriptCall[] {
    const calls: JavaScriptCall[] = []
    while (this.current().kind !== 'end') {
      if (this.consume(';')) continue
      const expression = this.parseExpression()
      if (!isJavaScriptCall(expression)) throw new SyntaxError(`Expected a function call at offset ${this.current().offset}.`)
      calls.push(expression)
      if (this.current().kind !== 'end' && !this.consume(';')) {
        throw new SyntaxError(`Expected a semicolon at offset ${this.current().offset}.`)
      }
    }
    return calls
  }

  /** Reads one value expression from the explicitly supported grammar. */
  private parseExpression(): JavaScriptExpression {
    const token = this.current()
    if (token.kind === 'string') {
      this.position += 1
      return token.value
    }
    if (token.kind === 'number') {
      this.position += 1
      const value = Number(token.value)
      if (!Number.isFinite(value)) throw new SyntaxError(`Non-finite number at offset ${token.offset}.`)
      return value
    }
    if (this.consume('-')) {
      const value = this.parseExpression()
      if (typeof value !== 'number') throw new SyntaxError(`Unary minus requires a number at offset ${token.offset}.`)
      return -value
    }
    if (this.consume('[')) return this.parseArray()
    if (this.consume('{')) return this.parseObject()
    if (this.consume('(')) {
      const value = this.parseExpression()
      this.expect(')')
      return value
    }
    if (token.kind !== 'identifier') throw new SyntaxError(`Unsupported expression at offset ${token.offset}.`)
    return this.parseIdentifierExpression()
  }

  /** Reads an array literal or a dotted identifier followed by a call. */
  private parseIdentifierExpression(): JavaScriptExpression {
    const names = [this.expectIdentifier()]
    while (this.consume('.')) names.push(this.expectIdentifier())
    const name = names.join('.')
    if (name === 'true') return true
    if (name === 'false') return false
    if (name === 'null') return null
    if (!this.consume('(')) return { kind: 'identifier', name }
    const args: JavaScriptExpression[] = []
    while (!this.consume(')')) {
      args.push(this.parseExpression())
      if (this.consume(')')) break
      this.expect(',')
    }
    return { kind: 'call', callee: name, arguments: args }
  }

  /** Reads one array literal without evaluating its values. */
  private parseArray(): JavaScriptArray {
    const values: JavaScriptExpression[] = []
    while (!this.consume(']')) {
      values.push(this.parseExpression())
      if (this.consume(']')) break
      this.expect(',')
      if (this.consume(']')) break
    }
    return { kind: 'array', items: values }
  }

  /** Reads one object literal with literal keys and values only. */
  private parseObject(): JavaScriptObject {
    const values: Record<string, JavaScriptExpression> = {}
    while (!this.consume('}')) {
      const key = this.current()
      if (key.kind !== 'identifier' && key.kind !== 'string' && key.kind !== 'number') {
        throw new SyntaxError(`Unsupported object key at offset ${key.offset}.`)
      }
      this.position += 1
      this.expect(':')
      values[key.value] = this.parseExpression()
      if (this.consume('}')) break
      this.expect(',')
      if (this.consume('}')) break
    }
    return { kind: 'object', fields: values }
  }

  /** Returns the current token without consuming it. */
  private current(): Token {
    return this.tokens[this.position]!
  }

  /** Consumes one punctuation token when it matches the expected value. */
  private consume(value: string): boolean {
    if (this.current().value !== value) return false
    this.position += 1
    return true
  }

  /** Consumes one exact punctuation token or reports the source offset. */
  private expect(value: string): void {
    if (!this.consume(value)) throw new SyntaxError(`Expected ${JSON.stringify(value)} at offset ${this.current().offset}.`)
  }

  /** Consumes one identifier token and returns its source name. */
  private expectIdentifier(): string {
    const token = this.current()
    if (token.kind !== 'identifier') throw new SyntaxError(`Expected an identifier at offset ${token.offset}.`)
    this.position += 1
    return token.value
  }
}

/** Parses callback call syntax into literal values and callee names. */
export function parseJavaScriptCalls(source: string): JavaScriptCallParse {
  try {
    return { calls: new LiteralCallParser(tokenize(source)).parseCalls() }
  } catch (error) {
    return { calls: [], error: error instanceof Error ? error.message : String(error) }
  }
}

/** Checks whether a parsed expression is a function call. */
export function isJavaScriptCall(expression: JavaScriptExpression): expression is JavaScriptCall {
  return typeof expression === 'object' && expression !== null && expression.kind === 'call'
}

/** Checks whether a parsed expression is a plain literal object. */
export function isJavaScriptObject(expression: JavaScriptExpression): expression is JavaScriptObject {
  return typeof expression === 'object' && expression !== null && expression.kind === 'object'
}

/** Checks whether a parsed expression is a literal array. */
export function isJavaScriptArray(expression: JavaScriptExpression): expression is JavaScriptArray {
  return typeof expression === 'object' && expression !== null && expression.kind === 'array'
}
